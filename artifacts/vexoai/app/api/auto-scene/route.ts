import { NextRequest, NextResponse } from "next/server"
import { logger, toErrStr } from "@/lib/logger"
import Anthropic from "@anthropic-ai/sdk"
import { chargeCredits, refundCredits, CREDIT_COST } from "@/lib/credits"

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Fetch a remote image and return its base64 + media type for Claude vision.
async function fetchImageAsBase64(
  url: string,
): Promise<{ data: string; mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" }> {
  const res = await fetch(url)
  if (!res.ok) throw new Error("Could not fetch image")
  const contentType = res.headers.get("content-type") || "image/jpeg"
  const buf = Buffer.from(await res.arrayBuffer())
  let mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" = "image/jpeg"
  if (contentType.includes("png")) mediaType = "image/png"
  else if (contentType.includes("webp")) mediaType = "image/webp"
  else if (contentType.includes("gif")) mediaType = "image/gif"
  return { data: buf.toString("base64"), mediaType }
}

export async function POST(req: NextRequest) {
  try {
    const {
      imageUrl,
      locale = "mn",
      voiceGender, // "male" | "female" — the picked voice acts as a command
      sceneIndex = 0,
      totalScenes = 1,
      context, // optional: what the series is about, prior scene prompts
    } = await req.json()

    if (!imageUrl || typeof imageUrl !== "string") {
      return NextResponse.json({ error: "imageUrl is required" }, { status: 400 })
    }

    const positionNote =
      totalScenes > 1
        ? locale === "mn"
          ? `Энэ бол ${totalScenes} хэсэгтэй цувралын ${sceneIndex + 1}-р хэсэг. Цувралын урсгалд тохируул (эхлэл/дунд/төгсгөл).`
          : `This is scene ${sceneIndex + 1} of a ${totalScenes}-part series. Fit the narrative flow (intro/middle/closing).`
        : ""

    const genderNote = voiceGender
      ? locale === "mn"
        ? `Сонгосон хоолой ${voiceGender === "male" ? "эрэгтэй" : "эмэгтэй"}. Narration-ийг тэр өнгө аястай бич.`
        : `The selected voice is ${voiceGender}. Match the narration tone.`
      : ""

    const systemPrompt =
      locale === "mn"
        ? `Чи видео рекламын мэргэжлийн найруулагч агент. Хэрэглэгчийн өгсөн зургийг хараад, тэр зургаас видео хийхэд тохирсон 2 зүйлийг гарга:

1. "prompt" — AI видео загварт зориулсан АНГЛИ prompt. Зурган дээрх юмыг хөдөлгөөнд оруул: камерын хөдөлгөөн (zoom, pan, tracking), гэрэлтүүлэг, уур амьсгал, дүрийн хөдөлгөөн. 2-3 өгүүлбэр.
2. "narration" — зурагт тохирсон МОНГОЛ хоолойны текст (зар сурталчилгааны өгүүлэгч ярих). Богино, татам, 1-2 өгүүлбэр.

${positionNote}
${genderNote}

ЗӨВХӨН дараах JSON форматаар хариул, өөр юм бичихгүй:
{"prompt": "...", "narration": "..."}`
        : `You are a professional video ad director agent. Look at the user's image and produce 2 things for turning it into a video:

1. "prompt" — an ENGLISH prompt for the AI video model. Bring the image to life: camera movement (zoom, pan, tracking), lighting, atmosphere, subject motion. 2-3 sentences.
2. "narration" — a short, catchy voiceover line that fits the image (what an ad narrator would say). 1-2 sentences.

${positionNote}
${genderNote}

Respond with ONLY this JSON format, nothing else:
{"prompt": "...", "narration": "..."}`

    const charge = await chargeCredits(CREDIT_COST.autoscene)
    if (!charge.ok) {
      return NextResponse.json({ error: charge.error }, { status: charge.status })
    }

    let message
    try {
      const img = await fetchImageAsBase64(imageUrl)
      message = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 500,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: img.mediaType, data: img.data },
              },
              {
                type: "text",
                text: context
                  ? `Series context: ${context}\n\nDescribe this scene.`
                  : "Describe this scene for a video ad.",
              },
            ],
          },
        ],
      })
    } catch (e) {
      await refundCredits(charge.userId, CREDIT_COST.autoscene)
      throw e
    }

    const raw = message.content[0].type === "text" ? message.content[0].text : ""

    // Be tolerant of code fences or stray text around the JSON.
    let parsed: { prompt?: string; narration?: string } = {}
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {}
    } catch {
      // Fall back: treat the whole thing as the prompt.
      parsed = { prompt: raw.trim(), narration: "" }
    }

    if (!parsed.prompt) {
      await refundCredits(charge.userId, CREDIT_COST.autoscene)
      return NextResponse.json({ error: "Could not read the image" }, { status: 502 })
    }

    return NextResponse.json({
      prompt: parsed.prompt.trim(),
      narration: (parsed.narration || "").trim(),
    })
  } catch (error) {
    logger.error("Auto-scene error:", { err: toErrStr(error) })
    return NextResponse.json({ error: "Failed to analyze image" }, { status: 500 })
  }
}
