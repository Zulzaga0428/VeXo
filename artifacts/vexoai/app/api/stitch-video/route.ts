import { NextRequest, NextResponse } from "next/server"
import { fal } from "@fal-ai/client"
import { chargeCredits, refundCredits, CREDIT_COST } from "@/lib/credits"

if (process.env.FAL_KEY) {
  fal.config({ credentials: process.env.FAL_KEY })
}

export const maxDuration = 300

type AspectRatio = "16:9" | "9:16" | "1:1"

const RESOLUTION_MAP: Record<AspectRatio, string> = {
  "16:9": "landscape_16_9",
  "9:16": "portrait_9_16",
  "1:1": "square",
}

// Lip-sync one scene's video to its own audio so the mouth matches the voice.
// Returns the synced video URL, or null if lip-sync isn't possible for this clip
// (e.g. no face on screen) so the caller can fall back to a plain overlay.
async function lipSyncScene(videoUrl: string, audioUrl: string): Promise<string | null> {
  try {
    const result = await fal.subscribe("fal-ai/sync-lipsync/v2", {
      // The SDK's bundled types lag behind the live API, which now supports the
      // "lipsync-2-pro" model — so cast the input.
      input: {
        // "lipsync-2-pro" gives noticeably more accurate, natural mouth movement
        // that tracks the actual phonemes of the narration — the highest quality
        // option. Worth the extra cost for the core feature of the product.
        model: "lipsync-2-pro",
        video_url: videoUrl,
        audio_url: audioUrl,
        // "silence" => when the audio is quiet, the mouth stays still instead of
        // looping/guessing. This stops the "talking while silent" problem.
        sync_mode: "silence",
      } as never,
      logs: false,
    })
    const url = (result.data as { video?: { url: string } })?.video?.url
    return url ?? null
  } catch (e) {
    console.error("[v0] lipSyncScene failed, will fall back to overlay:", e)
    return null
  }
}

// Plain audio overlay (no lip movement) — used when lip-sync is off or fails.
async function overlayAudio(videoUrl: string, audioUrl: string): Promise<string> {
  try {
    const result = await fal.subscribe("fal-ai/ffmpeg-api/merge-audio-video", {
      input: { video_url: videoUrl, audio_url: audioUrl, start_offset: 0 },
      logs: false,
    })
    return (result.data as { video?: { url: string } })?.video?.url || videoUrl
  } catch {
    return videoUrl
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      videoUrls,
      aspectRatio = "16:9",
      audioUrls = [],
      lipSync = true,
    } = body as {
      videoUrls: string[]
      aspectRatio?: AspectRatio
      audioUrls?: (string | null)[]
      lipSync?: boolean
    }

    if (!Array.isArray(videoUrls) || videoUrls.length === 0) {
      return NextResponse.json({ error: "videoUrls is required" }, { status: 400 })
    }

    // Count how many scenes will actually get voice work (have both video + audio).
    const scenesWithAudio = videoUrls.filter(
      (v, i) => typeof v === "string" && typeof audioUrls[i] === "string" && (audioUrls[i] as string).length > 0,
    ).length

    // Charge: base stitch + lip-sync per voiced scene (only if lip-sync is on).
    const cost = CREDIT_COST.stitch + (lipSync ? scenesWithAudio * CREDIT_COST.lipsync : 0)
    const charge = await chargeCredits(cost)
    if (!charge.ok) {
      return NextResponse.json({ error: charge.error }, { status: charge.status })
    }

    try {
      // Step 1: For each scene, attach its voice — lip-synced (default) or overlaid.
      const processedVideos: string[] = []
      for (let i = 0; i < videoUrls.length; i++) {
        const v = videoUrls[i]
        const a = audioUrls[i]
        if (!v) continue
        const hasAudio = typeof a === "string" && a.length > 0
        if (!hasAudio) {
          processedVideos.push(v)
          continue
        }
        if (lipSync) {
          const synced = await lipSyncScene(v, a as string)
          // Fall back to overlay if lip-sync couldn't process this clip.
          processedVideos.push(synced ?? (await overlayAudio(v, a as string)))
        } else {
          processedVideos.push(await overlayAudio(v, a as string))
        }
      }

      if (processedVideos.length === 0) {
        await refundCredits(charge.userId, cost)
        return NextResponse.json({ error: "No valid scenes to stitch" }, { status: 400 })
      }

      // Step 2: Merge all processed scene videos into one final video.
      if (processedVideos.length === 1) {
        return NextResponse.json({ videoUrl: processedVideos[0] })
      }

      const mergeResult = await fal.subscribe("fal-ai/ffmpeg-api/merge-videos", {
        input: {
          video_urls: processedVideos,
          target_fps: 30,
          resolution: (RESOLUTION_MAP[aspectRatio] ?? "landscape_16_9") as never,
        },
        logs: false,
      })
      const mergedVideoUrl = (mergeResult.data as { video?: { url: string } })?.video?.url

      if (!mergedVideoUrl) {
        // Merge failed but scenes were processed — return the first processed clip
        // rather than charging for nothing.
        return NextResponse.json({ videoUrl: processedVideos[0] })
      }

      return NextResponse.json({ videoUrl: mergedVideoUrl })
    } catch (e) {
      await refundCredits(charge.userId, cost)
      throw e
    }
  } catch (error) {
    console.error("Stitch error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Stitch failed" },
      { status: 500 },
    )
  }
}
