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

ДҮРЭМ:
- 1-5 scene. Scene бүр 5-12 секунд.
- visualPrompt үргэлж АНГЛИАР (видео модель англиар ажилладаг).
- script (яриа) МОНГОЛоор.
- "reply" талбарт хэрэглэгчид зориулсан 1-2 өгүүлбэр найрсаг хариу (монголоор) — юу төлөвлөснөө товч хэл.
- orientation: богино/нийгмийн сүлжээ бол "9:16", өргөн/YouTube бол "16:9".

Зөвхөн дараах JSON буцаа, өөр текст бүү нэм:
{"reply":"...","blueprint":{"title":"...","language":"mn","orientation":"9:16","model":"${model}","captions":false,"scenes":[{"type":"a_roll","durationSec":8,"script":"...","visualPrompt":"..."}]}}`
  }

  return `You are VexoAi's video director. Turn the user's idea into a complete, editable Video Plan (blueprint).

MOST IMPORTANT: FOLLOW the user's idea. Don't invent extra ads or CTAs. If the idea is detailed, preserve it and split into scenes.

${engine}
${SCENE_GUIDE_EN}

RULES:
- 1-5 scenes. Each 5-12 seconds.
- visualPrompt always in ENGLISH (the video model is English-driven).
- script (spoken line) in the user's language.
- "reply" is a friendly 1-2 sentence message to the user summarizing the plan.
- orientation: "9:16" for short/social, "16:9" for wide/YouTube.

Return ONLY this JSON, no other text:
{"reply":"...","blueprint":{"title":"...","language":"en","orientation":"9:16","model":"${model}","captions":false,"scenes":[{"type":"a_roll","durationSec":8,"script":"...","visualPrompt":"..."}]}}`
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

    // Agentic loop — max 3 turns so Claude can call get_voices once, then reply.
    const msgs: Anthropic.MessageParam[] = [{ role: "user", content: userContent }]
    let message: Anthropic.Message | null = null

    for (let turn = 0; turn < 3; turn++) {
      message = await withRetry(() =>
        anthropic.messages.create({
          model: "claude-sonnet-4-5",
          max_tokens: 3000,
          system: buildSystemPrompt(locale, safeModel),
          tools: [GET_VOICES_TOOL, ESTIMATE_CREDITS_TOOL],
          messages: msgs,
        }),
      )

      if (message.stop_reason !== "tool_use") break

      // Claude may call multiple tools in one turn — handle all of them.
      const toolBlocks = message.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
      )
      if (toolBlocks.length === 0) break

      msgs.push({ role: "assistant", content: message.content })

      // Build all tool results in parallel then push as one user message.
      const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
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

          // Unknown tool — return empty result so the loop doesn't stall.
          return { type: "tool_result" as const, tool_use_id: toolBlock.id, content: "unknown tool" }
        }),
      )

      msgs.push({ role: "user", content: toolResults })
    }

    const text = message?.content.find((b) => b.type === "text")?.text ?? ""
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: "Could not build a plan. Please try again." }, { status: 502 })
    }

    let parsed: { reply?: string; blueprint?: RawBlueprint }
    try {
      parsed = JSON.parse(jsonMatch[0])
    } catch {
      return NextResponse.json({ error: "Could not parse the plan. Please try again." }, { status: 502 })
    }

    if (!parsed.blueprint || !Array.isArray(parsed.blueprint.scenes)) {
      return NextResponse.json({ error: "Empty plan. Please try again." }, { status: 502 })
    }

    const reply =
      typeof parsed.reply === "string" && parsed.reply.trim()
        ? parsed.reply.trim()
        : locale === "mn"
          ? "Видео төлөвлөгөөг бэлдлээ. Зүүн талд хянаад, засаад үүсгэнэ үү."
          : "Here's your video plan. Review it, edit anything, then generate."

    return NextResponse.json({
      reply,
      blueprint: parsed.blueprint,
      chatRemaining: limit.remaining,
    })
  } catch (error) {
    console.error("Blueprint error:", error)
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
