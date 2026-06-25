import { NextRequest, NextResponse } from "next/server"
import { logger, toErrStr } from "@/lib/logger"
import Anthropic from "@anthropic-ai/sdk"
import { withRetry } from "@/lib/anthropic-retry"

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

type ClarifyQuestion = {
  question: string // the question to ask the user
  options: string[] // 2-4 short suggested answers (chips)
}

// Looks at the user's video idea and, only when it's genuinely vague, returns
// 1-2 quick questions (with suggested chip answers) to sharpen the brief.
// If the idea is already clear, it returns needsClarification:false so the
// pipeline starts immediately — we never block a good prompt.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { idea, locale = "mn" } = body as { idea?: string; locale?: "mn" | "en" }

    if (!idea || !idea.trim()) {
      return NextResponse.json({ error: "idea required" }, { status: 400 })
    }

    const systemPrompt =
      locale === "mn"
        ? `Чи VexoAi видео рекламын найруулагчийн туслах. Хэрэглэгчийн видео санааг хараад, илүү сайн видео хийхэд ШААРДЛАГАТАЙ мэдээлэл дутуу байвал 1-2 богино асуулт гаргана.

Зөвхөн ҮНЭХЭЭР хэрэгтэй үед асуу. Жишээ нь зорилтот үзэгч, өнгө аяс (хөгжилтэй/нухацтай), brand өнгө, гол мессеж тодорхойгүй бол. Хэрэв санаа аль хэдийн тодорхой, дэлгэрэнгүй бол асуулт АСУУХГҮЙ (needsClarification: false).

Дүрэм:
- Дээд тал нь 2 асуулт. Богино, ойлгомжтой.
- Асуулт бүрд 2-4 богино санал болгох хариулт (options) өг — хэрэглэгч дарахад л болохоор.
- Зөвхөн JSON буцаа, өөр тайлбар бүү бич.

Формат (яг ийм):
{"needsClarification": true, "questions": [{"question": "Хэнд зориулсан бэ?", "options": ["Залуучууд", "Бизнес эрхлэгчид", "Гэр бүл"]}]}
эсвэл санаа тодорхой бол:
{"needsClarification": false, "questions": []}`
        : `You are an assistant to VexoAi's video ad director. Look at the user's video idea and, ONLY if information truly needed to make a better video is missing, produce 1-2 short questions.

Only ask when genuinely useful — e.g. unclear target audience, tone (fun/serious), brand color, or core message. If the idea is already clear and detailed, DO NOT ask (needsClarification: false).

Rules:
- At most 2 questions. Short and clear.
- Each question gets 2-4 short suggested answers (options) the user can tap.
- Return ONLY JSON, no other text.

Format (exactly this):
{"needsClarification": true, "questions": [{"question": "Who is it for?", "options": ["Young adults", "Business owners", "Families"]}]}
or if the idea is clear:
{"needsClarification": false, "questions": []}`

    const message = await withRetry(() =>
      anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 600,
        system: systemPrompt,
        messages: [{ role: "user", content: idea.trim() }],
      })
    )

    const text = message.content[0].type === "text" ? message.content[0].text : ""
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    // If we can't parse a question set, fail open — just skip clarification.
    if (!jsonMatch) {
      return NextResponse.json({ needsClarification: false, questions: [] })
    }

    let parsed: { needsClarification?: boolean; questions?: ClarifyQuestion[] }
    try {
      parsed = JSON.parse(jsonMatch[0])
    } catch {
      return NextResponse.json({ needsClarification: false, questions: [] })
    }

    const questions = Array.isArray(parsed.questions)
      ? parsed.questions
          .slice(0, 2)
          .filter((q) => q && typeof q.question === "string")
          .map((q) => ({
            question: q.question,
            options: Array.isArray(q.options) ? q.options.slice(0, 4).filter((o) => typeof o === "string") : [],
          }))
      : []

    return NextResponse.json({
      needsClarification: Boolean(parsed.needsClarification) && questions.length > 0,
      questions,
    })
  } catch (err) {
    logger.error("[v0] clarify-idea error:", { err: toErrStr(err) })
    // Fail open: never block generation because clarification errored.
    return NextResponse.json({ needsClarification: false, questions: [] })
  }
}
