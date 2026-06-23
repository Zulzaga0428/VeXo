import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { bumpChatUsage, DAILY_CHAT_LIMIT } from "@/lib/credits"
import type { RawBlueprint, VideoBlueprint } from "@/lib/blueprint"

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

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

/** Retry up to `maxAttempts` times on transient 5xx errors from Anthropic. */
async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 2): Promise<T> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err: unknown) {
      const isLast = attempt === maxAttempts - 1
      const status = (err as Record<string, unknown>)?.status
      if (!isLast && typeof status === "number" && status >= 500 && status < 600) {
        await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)))
        continue
      }
      throw err
    }
  }
  /* istanbul ignore next */
  throw new Error("unreachable")
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

    const message = await withRetry(() =>
      anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 3000,
        system: buildSystemPrompt(locale, safeModel),
        messages: [{ role: "user", content: userContent }],
      }),
    )

    const text = message.content[0]?.type === "text" ? message.content[0].text : ""
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
