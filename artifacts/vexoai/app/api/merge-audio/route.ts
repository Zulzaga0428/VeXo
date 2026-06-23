import { NextRequest, NextResponse } from "next/server"
import { fal } from "@fal-ai/client"
import { createClient } from "@/lib/supabase/server"

fal.config({ credentials: process.env.FAL_KEY })

export const maxDuration = 120

// Merge a generated video with a TTS voice track into a single mp4 using
// FAL's ffmpeg compose API. The original video audio (if any) is replaced
// by the narration track so the Mongolian voice is what the viewer hears.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { videoUrl, audioUrl, audioStartOffset } = await request.json()

    if (!videoUrl || !audioUrl) {
      return NextResponse.json({ error: "videoUrl and audioUrl are required" }, { status: 400 })
    }

    // How long the speaker stays silent before the voice begins. Defaults to
    // 0.5s (mouth has time to open). Clamped to a sane 0–5s range; a NaN or
    // non-finite value falls back to the default rather than breaking compose.
    const rawOffset =
      typeof audioStartOffset === "number" && Number.isFinite(audioStartOffset) ? audioStartOffset : 0.5
    const startOffset = Math.min(5, Math.max(0, rawOffset))

    // Validate URLs are https.
    for (const u of [videoUrl, audioUrl]) {
      try {
        const parsed = new URL(u)
        if (parsed.protocol !== "https:") {
          return NextResponse.json({ error: "Only https URLs allowed" }, { status: 400 })
        }
      } catch {
        return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
      }
    }

    const result = (await fal.subscribe("fal-ai/ffmpeg-api/compose", {
      input: {
        tracks: [
          {
            id: "video",
            type: "video",
            keyframes: [{ timestamp: 0, duration: 0, url: videoUrl }],
          },
          {
            id: "voice",
            type: "audio",
            // Delay (seconds) so the speaker's mouth has time to open before the
            // voice starts — prevents the "audio playing before lips move" effect.
            // User-adjustable per scene via the audio-start slider.
            keyframes: [{ timestamp: startOffset, duration: 0, url: audioUrl }],
          },
        ],
      },
      logs: false,
    })) as { data?: { video_url?: string } }

    const mergedUrl = result.data?.video_url
    if (!mergedUrl) {
      return NextResponse.json({ error: "Merge produced no video" }, { status: 502 })
    }

    return NextResponse.json({ videoUrl: mergedUrl })
  } catch (error) {
    console.error("Merge audio error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Merge failed" },
      { status: 500 }
    )
  }
}
