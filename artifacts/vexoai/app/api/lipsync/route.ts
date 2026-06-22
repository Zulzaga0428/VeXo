import { NextRequest, NextResponse } from "next/server"
import { fal } from "@fal-ai/client"
import { chargeCredits, refundCredits, CREDIT_COST } from "@/lib/credits"

fal.config({ credentials: process.env.FAL_KEY })

export const maxDuration = 180

// Lip-sync a generated video to a narration track using FAL's sync-lipsync v2.
// The model re-times the speaker's mouth to match the audio, so the voiceover
// looks natural instead of a mouth that isn't moving while sound plays.
export async function POST(request: NextRequest) {
  // Auth + atomic credit deduction up front.
  const charge = await chargeCredits(CREDIT_COST.lipsync)
  if (!charge.ok) {
    return NextResponse.json({ error: charge.error }, { status: charge.status })
  }

  try {
    const { videoUrl, audioUrl } = await request.json()

    if (!videoUrl || !audioUrl) {
      await refundCredits(charge.userId, CREDIT_COST.lipsync)
      return NextResponse.json({ error: "videoUrl and audioUrl are required" }, { status: 400 })
    }

    // Validate URLs are https.
    for (const u of [videoUrl, audioUrl]) {
      try {
        const parsed = new URL(u)
        if (parsed.protocol !== "https:") {
          await refundCredits(charge.userId, CREDIT_COST.lipsync)
          return NextResponse.json({ error: "Only https URLs allowed" }, { status: 400 })
        }
      } catch {
        await refundCredits(charge.userId, CREDIT_COST.lipsync)
        return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
      }
    }

    const result = (await fal.subscribe("fal-ai/sync-lipsync/v2", {
      // The SDK's bundled types lag behind the live API, which now supports the
      // "lipsync-2-pro" model — so cast the input.
      input: {
        // Highest-quality model: mouth movement tracks the narration's phonemes
        // far more accurately than the default — this is the core feature.
        model: "lipsync-2-pro",
        video_url: videoUrl,
        audio_url: audioUrl,
        // If the narration is longer/shorter than the clip, cut to the video length.
        sync_mode: "cut_off",
      } as never,
      logs: false,
    })) as { data?: { video?: { url?: string }; video_url?: string } }

    const syncedUrl = result.data?.video?.url || result.data?.video_url
    if (!syncedUrl) {
      await refundCredits(charge.userId, CREDIT_COST.lipsync)
      return NextResponse.json({ error: "Lip-sync produced no video" }, { status: 502 })
    }

    return NextResponse.json({ videoUrl: syncedUrl, remaining: charge.remaining })
  } catch (error) {
    await refundCredits(charge.userId, CREDIT_COST.lipsync)
    console.error("Lip-sync error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Lip-sync failed" },
      { status: 500 },
    )
  }
}
