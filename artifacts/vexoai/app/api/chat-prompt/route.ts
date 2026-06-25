import { NextRequest, NextResponse } from "next/server"
import { logger, toErrStr } from "@/lib/logger"
import Anthropic from "@anthropic-ai/sdk"
import { bumpChatUsage, DAILY_CHAT_LIMIT } from "@/lib/credits"

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

type ChatMessage = {
  role: "user" | "assistant"
  content: string
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      messages,
      locale = "mn",
      sceneIndex = 0,
      previousPrompts = [],
    } = body as {
      messages: ChatMessage[]
      locale?: "mn" | "en"
      sceneIndex?: number
      previousPrompts?: string[]
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "messages required" }, { status: 400 })
    }

    // Free AI chat: enforce a per-user daily limit to prevent abuse.
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

    const previousContext = previousPrompts.length
      ? previousPrompts
          .map((p, i) => `Scene ${i + 1}: ${p}`)
          .join("\n")
      : locale === "mn"
        ? "(Өмнөх scene байхгүй — энэ бол эхний scene)"
        : "(No previous scenes — this is the first scene)"

    const systemPrompt =
      locale === "mn"
        ? `Чи VexoAi видео рекламын мэргэжлийн найруулагч-туслах. Хэрэглэгчтэй найрсаг ярилцаж, тэдний санааг нь тодорхой видео prompt болгож тусална.

Чи одоо Scene ${sceneIndex + 1}-ийн prompt бэлдэж байна.

Өмнөх scene-үүдийн prompt:
${previousContext}

Дүрэм:
- Хэрэглэгчтэй Монгол хэлээр найрсаг ярилц
- Богино, тодорхой асуултаар санааг нь гарга (нэг удаад 1-2 асуулт)
- Өмнөх scene-үүдтэй уялдсан, тасралтгүй story болгож бод
- Хэрэглэгч "бэлэн" эсвэл "хийе" гэх мэт хэлвэл, эцсийн prompt-г өгнө
- Эцсийн prompt өгөхдөө зөвхөн дараах форматаар бич:
  
  PROMPT: <англи хэл дээрх 2-4 өгүүлбэрт prompt>

- Prompt-д камерын хөдөлгөөн (zoom, pan, tracking), гэрэлтүүлэг, уур амьсгал, хөдөлгөөн оруул
- Өмнөх scene-тэй ижил хэв маяг, өнгө, character, орчинг хадгал`
        : `You are VexoAi's professional video ad director assistant. Have a friendly conversation with the user to help them turn their idea into a clear video prompt.

You are now preparing the prompt for Scene ${sceneIndex + 1}.

Previous scene prompts:
${previousContext}

Rules:
- Chat in a friendly tone
- Ask short, focused questions (1-2 at a time)
- Maintain visual continuity with previous scenes
- When the user says "ready" or "let's go", output the final prompt only in this format:

  PROMPT: <2-4 sentence English prompt>

- Include camera movement (zoom, pan, tracking), lighting, atmosphere, motion
- Match style, color, characters, environment of previous scenes`

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 600,
      system: systemPrompt,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    })

    const text =
      message.content[0].type === "text" ? message.content[0].text : ""

    // Detect if assistant emitted a final PROMPT
    const promptMatch = text.match(/PROMPT:\s*([\s\S]+?)$/i)
    const finalPrompt = promptMatch ? promptMatch[1].trim() : null

    return NextResponse.json({
      reply: text,
      finalPrompt,
      chatRemaining: limit.remaining,
    })
  } catch (error) {
    logger.error("Chat API error:", { err: toErrStr(error) })
    return NextResponse.json(
      { error: "Failed to chat" },
      { status: 500 }
    )
  }
}
