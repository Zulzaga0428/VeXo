import { NextRequest, NextResponse } from "next/server"
import { logger, toErrStr } from "@/lib/logger"
import Anthropic from "@anthropic-ai/sdk"
import { chargeCredits, refundCredits, CREDIT_COST } from "@/lib/credits"
import { withRetry } from "@/lib/anthropic-retry"

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(req: NextRequest) {
  try {
    const { prompt, locale } = await req.json()

    if (!prompt || !prompt.trim()) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 })
    }

    const systemPrompt = locale === "mn"
      ? `Чи AI видео үүсгэх загварт зориулж prompt сайжруулдаг туслах.

Хамгийн чухал: хэрэглэгчийн санааг ДАГА. Тэдний хүссэн зүйлийг л тодорхой болго — шинэ үзэгдэл, реклам, уриалга БҮҮ нэм. Зөвхөн тэдний бичсэнийг видео загварт ойлгомжтой болгож дэлгэрүүл.

Дүрэм:
- Англи хэл дээр бич (AI видео загвар англиар илүү сайн ойлгодог)
- Хэрэглэгчийн дурдсан визуал зүйлд камерын хөдөлгөөн, гэрэлтүүлэг, уур амьсгал нэм
- Реалист, жинхэнэ амьдрал шиг (мультфильм/CGI биш)
- 2-4 өгүүлбэрт багтаа
- Зөвхөн сайжруулсан prompt-г буцаа, нэмэлт тайлбар бичихгүй`
      : `You help improve prompts for an AI video generation model.

Most important: FOLLOW the user's idea. Just clarify what they asked for — don't add new scenes, ads, or CTAs. Only expand what they wrote so the video model understands it.

Rules:
- Write in English (the video model understands English better)
- Add camera movement, lighting, and atmosphere to the visuals the user mentioned
- Photorealistic, true to life (not cartoon/CGI)
- Keep it to 2-4 sentences
- Return ONLY the enhanced prompt, no extra explanation`

    const charge = await chargeCredits(CREDIT_COST.enhance)
    if (!charge.ok) {
      return NextResponse.json({ error: charge.error }, { status: charge.status })
    }

    let message
    try {
      message = await withRetry(() =>
        anthropic.messages.create({
          model: "claude-sonnet-4-5",
          max_tokens: 300,
          messages: [
            {
              role: "user",
              content: `Enhance this for a video ad: "${prompt}"`,
            },
          ],
          system: systemPrompt,
        })
      )
    } catch (e) {
      await refundCredits(charge.userId, CREDIT_COST.enhance)
      throw e
    }

    const enhancedText = message.content[0].type === "text" 
      ? message.content[0].text 
      : ""

    return NextResponse.json({ enhanced: enhancedText })
  } catch (error) {
    logger.error("Claude API error:", { err: toErrStr(error) })
    return NextResponse.json(
      { error: "Failed to enhance prompt" },
      { status: 500 }
    )
  }
}
