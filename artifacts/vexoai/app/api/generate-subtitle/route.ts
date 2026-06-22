import { NextResponse } from "next/server"
import { fal } from "@fal-ai/client"

fal.config({
  credentials: process.env.FAL_KEY,
})

export async function POST(request: Request) {
  try {
    const { videoUrl, language = "mn" } = await request.json()

    if (!videoUrl) {
      return NextResponse.json(
        { error: "Video URL is required" },
        { status: 400 }
      )
    }

    // Map language codes to Whisper's expected format
    const langMap: Record<string, string> = {
      mn: "mn",
      en: "en",
      ko: "ko",
      zh: "zh",
      ja: "ja",
      ru: "ru",
    }

    const res = (await fal.subscribe("fal-ai/whisper", {
      input: {
        audio_url: videoUrl,
        task: "transcribe",
        language: langMap[language] || "en",
        chunk_level: "segment",
        version: "3",
      } as any,
      logs: false,
    })) as {
      data: {
        text: string
        chunks?: Array<{
          timestamp: [number, number]
          text: string
        }>
      }
    }

    const result = res.data

    // Convert chunks to subtitle format
    const subtitles = (result.chunks || []).map((chunk, index) => ({
      id: index + 1,
      start: chunk.timestamp[0],
      end: chunk.timestamp[1],
      text: chunk.text.trim(),
    }))

    return NextResponse.json({
      text: result.text,
      subtitles,
    })
  } catch (error) {
    console.error("[v0] Subtitle generation error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate subtitles" },
      { status: 500 }
    )
  }
}
