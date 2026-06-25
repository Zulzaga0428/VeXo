import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { bumpChatUsage, DAILY_CHAT_LIMIT } from "@/lib/credits"
import type { RawBlueprint, VideoBlueprint } from "@/lib/blueprint"
import { withRetry } from "@/lib/anthropic-retry"
import { cambListVoices, isCambConfigured } from "@/lib/cambai"
import { estimateSceneCredits, willStitch } from "@/lib/blueprint-costs"
import { CREDIT_COST } from "@/lib/credit-costs"

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Step 1 of Agentic Planner: get_voices tool lets Claude query the real list of
// available Mongolian voice actors before writing scripts, so it can pick an
// appropriate voice name and gender rather than guessing.
const GET_VOICES_TOOL: Anthropic.Tool = {
  name: "get_voices",
  description:
    "Returns the list of available Mongolian voice actors (name, gender, id). " +
    "Call this ONCE before writing the blueprint so you can reference a real voice " +
    "name in your reply (e.g. 'Нандин эмэгтэй хоолойтой'). Do NOT invent voice names.",
  input_schema: { type: "object" as const, properties: {}, required: [] },
}

// Step 2 of Agentic Planner: estimate_credits lets Claude calculate the exact
// credit cost of its proposed plan and mention it in the reply so the user
// knows what they're approving before hitting Generate.
const ESTIMATE_CREDITS_TOOL: Anthropic.Tool = {
  name: "estimate_credits",
  description:
    "Calculate the total credit cost for the blueprint you are about to propose. " +
    "Call this after finalizing the scene list (types + scripts + durations) but " +
    "BEFORE writing the reply, so you can tell the user the exact credit total.",
  input_schema: {
    type: "object" as const,
    properties: {
      model: { type: "string", enum: ["standard", "veo3"], description: "Quality model" },
      scenes: {
        type: "array",
        description: "Proposed scenes",
        items: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["a_roll", "b_roll"] },
            script: { type: "string", description: "Spoken text (empty string if none)" },
            durationSec: { type: "number" },
          },
          required: ["type", "script", "durationSec"],
        },
      },
    },
    required: ["model", "scenes"],
  },
}

// Step 5 of Agentic Planner: validate_scene lets Claude check each proposed
// scene for rule violations (duration cap, script length, English visualPrompt)
// before committing to the final blueprint, so it can self-correct.
const VALIDATE_SCENE_TOOL: Anthropic.Tool = {
  name: "validate_scene",
  description:
    "Check a single proposed scene for rule violations. " +
    "Call this for EVERY scene (in parallel) after planning them but before writing the blueprint. " +
    "Fix any reported issues before returning the final JSON.",
  input_schema: {
    type: "object" as const,
    properties: {
      scene_index: { type: "number", description: "0-based index for reference" },
      type: { type: "string", enum: ["a_roll", "b_roll"] },
      script: { type: "string", description: "Spoken text (empty string if none)" },
      visual_prompt: { type: "string", description: "Scene visualPrompt (must be English)" },
      duration_sec: { type: "number" },
      model: { type: "string", enum: ["standard", "veo3"] },
    },
    required: ["scene_index", "type", "script", "visual_prompt", "duration_sec", "model"],
  },
}

// The agent turns a plain-language idea into a full, editable Video Plan
// (blueprint). Unlike the old plan-episode (a bare scene list), this returns the
// whole plan: title, orientation, model, captions, and typed scenes (a_roll
// talking-head vs b_roll cinematic). NO credits are charged here — generation
// happens only after the user approves the plan in the UI.

const SCENE_GUIDE_MN = `
SCENE ТӨРӨЛ:
- "a_roll" = ТАНИЛЦУУЛАГЧ (хүн камер руу ярьж байгаа). Заавал "script" (монгол яриа) хэрэгтэй. Хэрэглэгч дараа нь царайны зураг (avatar) оруулна. Хувийн мессеж, танилцуулга, зарлал, ярьдаг реклам бол үүнийг сонго.
- "b_roll" = ДҮРСЛЭЛ (кино шиг орчин, бүтээгдэхүүн, монтаж). "script" нь нэмэлт (хоосон байж болно). Бүтээгдэхүүн харуулах, кино маягийн дүрслэл бол үүнийг сонго.
Шаардлагатай бол хольж болно.`

const SCENE_GUIDE_EN = `
SCENE TYPES:
- "a_roll" = PRESENTER (a person talking to camera). REQUIRES "script" (the spoken line). The user will add a face image (avatar) afterwards. Use for personal messages, intros, announcements, talking ads.
- "b_roll" = CINEMATIC (scenic environments, product shots, montage). "script" is optional (can be empty). Use for product showcases and cinematic visuals.
You may mix types when it serves the story.`

function buildSystemPrompt(locale: "mn" | "en", model: "standard" | "veo3"): string {
  const engine =
    model === "veo3"
      ? "ENGINE: Google Veo 3.1 Cinematic — rich, layered, photorealistic cinematography. visualPrompt-д кино шиг нарийн дэлгэрэнгүй бич."
      : "ENGINE: Kling 3.0 Standard — fluid, photorealistic motion. visualPrompt-д нэг гол subject, зөөлөн хөдөлгөөн, natural lighting."

  if (locale === "mn") {
    return `Чи VexoAi-н видео найруулагч. Хэрэглэгчийн санааг бүрэн "Видео төлөвлөгөө" (blueprint) болгож хувиргана.

ХАМГИЙН ЧУХАЛ: Хэрэглэгчийн санааг ДАГА. Тэдний хүссэнийг хий — нэмэлт реклам/уриалга бүү зохио. Санаа тодорхой бол хадгалж scene болгон задал.

${engine}
${SCENE_GUIDE_MN}

БАГАЖ ХЭРЭГСЭЛ (tools):
Дараах дарааллаар ашигла (нэг зэрэг дуудаж болно):
1. get_voices() — бодит хоолойнуудын жагсаалт авна. reply дотор хоолойн нэр дурдах.
2. estimate_credits() — нийт кредит тооцоолно. reply дотор "X кредит шаардана" гэж хэл.
3. validate_scene() — scene БҮРТ зэрэг дуудна. Олдсон алдааг засна.
Эдгээр tool-уудыг дуусгасны ДАРАА л JSON буцаа.

ДҮРЭМ:
- 1-5 scene. Scene бүр 5-15 секунд (стандарт: 8-12 с; богино агшин 5-7 с; урт тайлбар 13-15 с).
- visualPrompt үргэлж АНГЛИАР (видео модель англиар ажилладаг).
- script (яриа) МОНГОЛоор.
- durationSec-г script-ийн уртад тааруул: 2.5 үг/секунд хэмнэлтэй. Яриагүй b_roll бол 8-12 секунд.
- description: scene бүрт 5-8 үгийн монгол тайлбар (хэрэглэгчид харуулна). Жишээ: "Танилцуулагч камер руу ярьж байна", "Бариста кофе бэлдэж байна".
- category: реклам ангилал монголоор. Жишээ: "Богино реклам", "Брэнд танилцуулга", "Бүтээгдэхүүний реклам", "Сурталчилгаа", "Компанийн танилцуулга".
- orientation: богино/нийгмийн сүлжээ бол "9:16", өргөн/YouTube бол "16:9".
- "reply" монголоор, 3-5 өгүүлбэр:
  1. Реклам ангилал + хоолойн нэр + scene тоо
  2. Scene тус бүрийн тайлбарыг bullet-аар жагсаа: "• Scene N (Xс): тайлбар"
  3. Нийт кредит

Дараах JSON БҮТЦИЙГ л буцаа (tools дуусгасны дараа):
{"reply":"...","blueprint":{"title":"...","category":"Богино реклам","language":"mn","orientation":"9:16","model":"${model}","captions":false,"scenes":[{"type":"a_roll","durationSec":10,"description":"Танилцуулагч камер руу ярьж байна","script":"...","visualPrompt":"..."}]}}`
  }

  return `You are VexoAi's video director. Turn the user's idea into a complete, editable Video Plan (blueprint).

MOST IMPORTANT: FOLLOW the user's idea. Don't invent extra ads or CTAs. If the idea is detailed, preserve it and split into scenes.

${engine}
${SCENE_GUIDE_EN}

TOOLS (call these before writing the blueprint):
Use them in this order (may call in parallel when possible):
1. get_voices() — get the real list of Mongolian voice actors; mention the chosen voice in the reply.
2. estimate_credits() — calculate total credits; say "X credits required" in the reply.
3. validate_scene() — call for EVERY scene simultaneously; fix all reported issues before finalising.
Only write the JSON after ALL tools are done.

RULES:
- 1-5 scenes. Each 5-15 seconds (typical: 8-12 s; quick cutaway 5-7 s; detailed narration 13-15 s).
- visualPrompt always in ENGLISH (the video model is English-driven).
- script (spoken line) in the user's language.
- Match durationSec to script length: ~2.5 words/second speaking pace. Silent b_roll scenes: 8-12 s.
- description: 5-8 word Mongolian label per scene shown in the UI. e.g. "Танилцуулагч камер руу ярьж байна".
- category: short Mongolian category for the ad. e.g. "Богино реклам", "Брэнд танилцуулга", "Бүтээгдэхүүний реклам".
- orientation: "9:16" for short/social, "16:9" for wide/YouTube.
- "reply" in Mongolian, 3-5 sentences:
  1. Category + chosen voice + scene count
  2. Bullet list of scenes: "• Scene N (Xs): Mongolian description"
  3. Total credits

After tools are done, return ONLY this JSON structure:
{"reply":"...","blueprint":{"title":"...","category":"Богино реклам","language":"en","orientation":"9:16","model":"${model}","captions":false,"scenes":[{"type":"a_roll","durationSec":10,"description":"Танилцуулагч камер руу ярьж байна","script":"...","visualPrompt":"..."}]}}`
}


export async function POST(req: NextRequest) {
  let locale: "mn" | "en" = "mn"
  try {
    const body = await req.json()
    const {
      idea,
      locale: bodyLocale = "mn",
      model = "standard",
      currentBlueprint,
    } = body as {
      idea?: string
      locale?: "mn" | "en"
      model?: "standard" | "veo3"
      currentBlueprint?: VideoBlueprint
    }
    locale = bodyLocale

    if (!idea || !idea.trim()) {
      return NextResponse.json({ error: "idea required" }, { status: 400 })
    }

    const safeModel: "standard" | "veo3" = model === "veo3" ? "veo3" : "standard"

    const limit = await bumpChatUsage()
    if (!limit.ok) {
      if (limit.status === 429) {
        return NextResponse.json(
          {
            error: "daily_chat_limit",
            limit: DAILY_CHAT_LIMIT,
            message:
              locale === "mn"
                ? `Өдрийн чатын хязгаарт (${DAILY_CHAT_LIMIT}) хүрлээ. Маргааш дахин оролдоно уу.`
                : `You've reached the daily chat limit (${DAILY_CHAT_LIMIT}). Please try again tomorrow.`,
          },
          { status: 429 },
        )
      }
      return NextResponse.json({ error: limit.error }, { status: limit.status })
    }

    // When revising, give the model the current plan so it edits rather than
    // starting over. Only the editable fields are passed (no runtime state).
    let userContent = idea.trim()
    if (currentBlueprint && Array.isArray(currentBlueprint.scenes)) {
      const slim = {
        title: currentBlueprint.title,
        orientation: currentBlueprint.orientation,
        model: currentBlueprint.model,
        captions: currentBlueprint.captions,
        scenes: currentBlueprint.scenes.map((s) => ({
          type: s.type,
          durationSec: s.durationSec,
          script: s.script,
          visualPrompt: s.visualPrompt,
        })),
      }
      userContent =
        (locale === "mn"
          ? `Одоогийн төлөвлөгөө (JSON):\n${JSON.stringify(slim)}\n\nХэрэглэгчийн өөрчлөлт: `
          : `Current plan (JSON):\n${JSON.stringify(slim)}\n\nUser's change request: `) + idea.trim()
    }

    // Step 4 of Agentic Planner: stream SSE events so the UI can show real-time
    // status ("Хоолой шалгаж байна…", "Кредит тооцоолж байна…") instead of a
    // plain spinner. The agentic loop itself is unchanged — only the delivery
    // mechanism switches from a single JSON response to a ReadableStream.
    const encoder = new TextEncoder()
    const chatRemaining = limit.remaining

    const sseStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          try {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
          } catch {
            // controller already closed — ignore
          }
        }

        try {
          const THINKING_BUDGET = 8000
          const msgs: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: userContent }]
          let message: Anthropic.Beta.BetaMessage | null = null

          for (let turn = 0; turn < 6; turn++) {
            message = await withRetry(() =>
              anthropic.beta.messages.create({
                model: "claude-sonnet-4-5",
                max_tokens: 12000,
                thinking: { type: "enabled", budget_tokens: THINKING_BUDGET },
                betas: ["interleaved-thinking-2025-05-14"],
                system: buildSystemPrompt(locale, safeModel),
                tools: [GET_VOICES_TOOL, ESTIMATE_CREDITS_TOOL, VALIDATE_SCENE_TOOL],
                messages: msgs,
              }),
            )

            if (message.stop_reason !== "tool_use") break

            const toolBlocks = message.content.filter(
              (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use",
            )
            if (toolBlocks.length === 0) break

            msgs.push({ role: "assistant", content: message.content })

            // Emit a status event for each tool call so the UI can name them.
            // Collapse multiple validate_scene calls into one status message.
            let hasValidate = false
            for (const tb of toolBlocks) {
              if (tb.name === "get_voices") {
                send("status", {
                  message: locale === "mn" ? "Монгол хоолойнуудыг шалгаж байна…" : "Checking available voices…",
                })
              } else if (tb.name === "estimate_credits") {
                send("status", {
                  message: locale === "mn" ? "Кредит тооцоолж байна…" : "Estimating credits…",
                })
              } else if (tb.name === "validate_scene") {
                hasValidate = true
              }
            }
            if (hasValidate) {
              send("status", {
                message: locale === "mn" ? "Scene бүрийг шалгаж байна…" : "Validating scenes…",
              })
            }

            const toolResults: Anthropic.Beta.BetaToolResultBlockParam[] = await Promise.all(
              toolBlocks.map(async (toolBlock) => {
                if (toolBlock.name === "get_voices") {
                  let voices: Array<{ id: number; name: string; gender: string }> = []
                  if (isCambConfigured()) {
                    try {
                      const all = await cambListVoices()
                      voices = all
                        .filter((v) => v.language === 100)
                        .map((v) => ({
                          id: v.id,
                          name: v.name,
                          gender: v.gender === 1 ? "male" : "female",
                        }))
                    } catch {
                      voices = []
                    }
                  }
                  return {
                    type: "tool_result" as const,
                    tool_use_id: toolBlock.id,
                    content: JSON.stringify(voices.length ? voices : [{ note: "No voices found" }]),
                  }
                }

                if (toolBlock.name === "estimate_credits") {
                  const input = toolBlock.input as {
                    model?: string
                    scenes?: Array<{ type?: string; script?: string; durationSec?: number }>
                  }
                  const safeScenes = Array.isArray(input.scenes) ? input.scenes : []
                  const bpModel = input.model === "veo3" ? "veo3" : "standard"
                  let total = 0
                  const breakdown: Array<{ scene: number; credits: number }> = []
                  safeScenes.forEach((s, idx) => {
                    const cost = estimateSceneCredits(
                      { type: s.type === "b_roll" ? "b_roll" : "a_roll", script: s.script ?? "" } as Parameters<typeof estimateSceneCredits>[0],
                      bpModel,
                    )
                    breakdown.push({ scene: idx + 1, credits: cost })
                    total += cost
                  })
                  if (safeScenes.length > 1) total += CREDIT_COST.stitch
                  return {
                    type: "tool_result" as const,
                    tool_use_id: toolBlock.id,
                    content: JSON.stringify({ total, breakdown, stitchIncluded: safeScenes.length > 1 }),
                  }
                }

                if (toolBlock.name === "validate_scene") {
                  const inp = toolBlock.input as {
                    scene_index?: number
                    type?: string
                    script?: string
                    visual_prompt?: string
                    duration_sec?: number
                    model?: string
                  }
                  const issues: string[] = []
                  const bpModel = inp.model === "veo3" ? "veo3" : "standard"
                  const durationCap = bpModel === "veo3" ? 8 : 15
                  const dur = typeof inp.duration_sec === "number" ? inp.duration_sec : 0

                  // Duration cap
                  if (dur > durationCap) {
                    issues.push(
                      `durationSec ${dur}s exceeds ${bpModel} cap of ${durationCap}s — reduce to ≤${durationCap}s`,
                    )
                  }
                  if (dur < 3) {
                    issues.push(`durationSec ${dur}s is too short — minimum 3s`)
                  }

                  // Script length vs duration (≈2.5 words/sec spoken pace)
                  const script = inp.script ?? ""
                  const wordCount = script.trim() ? script.trim().split(/\s+/).length : 0
                  const maxWords = Math.ceil(dur * 2.5)
                  if (wordCount > maxWords) {
                    issues.push(
                      `script has ${wordCount} words but ${dur}s allows ~${maxWords} words at normal speaking pace — shorten the script`,
                    )
                  }

                  // visualPrompt must be English (ASCII-dominant)
                  const vp = inp.visual_prompt ?? ""
                  if (vp.trim()) {
                    const asciiCount = [...vp].filter((c) => c.charCodeAt(0) < 128).length
                    const ratio = asciiCount / vp.length
                    if (ratio < 0.8) {
                      issues.push(`visualPrompt appears to contain non-English text — write it in English only`)
                    }
                  } else {
                    issues.push(`visualPrompt is empty — provide a descriptive English scene description`)
                  }

                  // b_roll should have empty script
                  if (inp.type === "b_roll" && wordCount > 0) {
                    issues.push(
                      `b_roll scene has a script ("${script.slice(0, 40)}…") — b_roll is cinematic footage with no voiceover; move spoken lines to an a_roll scene or clear the script`,
                    )
                  }

                  return {
                    type: "tool_result" as const,
                    tool_use_id: toolBlock.id,
                    content: JSON.stringify(
                      issues.length
                        ? { valid: false, scene_index: inp.scene_index, issues }
                        : { valid: true, scene_index: inp.scene_index },
                    ),
                  }
                }

                return { type: "tool_result" as const, tool_use_id: toolBlock.id, content: "unknown tool" }
              }),
            )

            msgs.push({ role: "user", content: toolResults })
          }

          const textBlock = message?.content.find((b) => b.type === "text")
          const text = textBlock && "text" in textBlock ? (textBlock.text as string) : ""
          const jsonMatch = text.match(/\{[\s\S]*\}/)
          if (!jsonMatch) {
            send("error", {
              statusCode: 502,
              message:
                locale === "mn"
                  ? "Төлөвлөгөө гаргахад алдаа гарлаа. Дахин оролдоно уу."
                  : "Could not build a plan. Please try again.",
            })
            return
          }

          let parsed: { reply?: string; blueprint?: RawBlueprint }
          try {
            parsed = JSON.parse(jsonMatch[0])
          } catch {
            send("error", {
              statusCode: 502,
              message:
                locale === "mn"
                  ? "Төлөвлөгөөний формат буруу байна. Дахин оролдоно уу."
                  : "Could not parse the plan. Please try again.",
            })
            return
          }

          if (!parsed.blueprint || !Array.isArray(parsed.blueprint.scenes)) {
            send("error", {
              statusCode: 502,
              message: locale === "mn" ? "Хоосон төлөвлөгөө. Дахин оролдоно уу." : "Empty plan. Please try again.",
            })
            return
          }

          const reply =
            typeof parsed.reply === "string" && parsed.reply.trim()
              ? parsed.reply.trim()
              : locale === "mn"
                ? "Видео төлөвлөгөөг бэлдлээ. Зүүн талд хянаад, засаад үүсгэнэ үү."
                : "Here's your video plan. Review it, edit anything, then generate."

          send("done", { reply, blueprint: parsed.blueprint, chatRemaining })
        } catch (err) {
          const status = (err as Record<string, unknown>)?.status
          const isAnthropicDown = typeof status === "number" && status >= 500 && status < 600
          send("error", {
            statusCode: 500,
            message:
              locale === "mn"
                ? isAnthropicDown
                  ? "AI сервер түр зуур доголдоод байна. Хэдэн минутын дараа дахин оролдоно уу."
                  : "Төлөвлөгөө гаргахад алдаа гарлаа. Дахин оролдоно уу."
                : isAnthropicDown
                  ? "AI service is temporarily unavailable. Please try again in a few minutes."
                  : "Failed to build plan. Please try again.",
          })
        } finally {
          controller.close()
        }
      },
    })

    return new Response(sseStream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    })
  } catch (error) {
    // Handles synchronous errors before the stream is created (body parse, auth, etc.)
    void error
    const status = (error as Record<string, unknown>)?.status
    const isAnthropicDown = typeof status === "number" && status >= 500 && status < 600
    const message =
      locale === "mn"
        ? isAnthropicDown
          ? "AI сервер түр зуур доголдоод байна. Хэдэн минутын дараа дахин оролдоно уу."
          : "Төлөвлөгөө гаргахад алдаа гарлаа. Дахин оролдоно уу."
        : isAnthropicDown
          ? "AI service is temporarily unavailable. Please try again in a few minutes."
          : "Failed to build plan. Please try again."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
