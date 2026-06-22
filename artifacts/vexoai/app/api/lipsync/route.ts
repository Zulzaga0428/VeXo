import { NextRequest, NextResponse } from "next/server"
import { fal } from "@fal-ai/client"
import { chargeCredits, refundCredits, CREDIT_COST } from "@/lib/credits"

fal.config({ credentials: process.env.FAL_KEY })

export const maxDuration = 180

// Two lipsync engines available:
//
//  "natural"  — LatentSync (diffusion-based). Generates the mouth region from
//               scratch in the latent space so there's no visible blend seam.
//               Looks the most organic / least "AI" — recommended for close-up
//               talking-head shots. Slightly slower (~30–60 s more).
//
//  "pro"      — Sync Labs lipsync-2-pro. Fast, phoneme-accurate, handles wide
//               shots and motion well. Best when the face is small in frame.
//
// Default is "natural" so new users get the best result without having to pick.
type LipsyncEngine = "natural" | "pro"

export async function POST(request: NextRequest) {
  const charge = await chargeCredits(CREDIT_COST.lipsync)
  if (!charge.ok) {
    return NextResponse.json({ error: charge.error }, { status: charge.status })
  }

  try {
    const { videoUrl, audioUrl, engine = "natural" } = await request.json() as {
      videoUrl?: string
      audioUrl?: string
      engine?: LipsyncEngine
    }

    if (!videoUrl || !audioUrl) {
      await refundCredits(charge.userId, CREDIT_COST.lipsync)
      return NextResponse.json({ error: "videoUrl and audioUrl are required" }, { status: 400 })
    }

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

    let syncedUrl: string | undefined

    if (engine === "natural") {
      // ── LatentSync ────────────────────────────────────────────────────────
      // Diffusion-based: synthesises the mouth region in latent space so there
      // is no hard edge between the original face and the lip area. Produces
      // the most natural, human-looking result especially on close-up shots.
      const result = await fal.subscribe("fal-ai/latentsync", {
        input: {
          video_url: videoUrl,
          audio_url: audioUrl,
          // guidance_scale controls how strictly the model follows the audio
          // phonemes. 2.5 is the sweet spot — higher values over-animate.
          guidance_scale: 2.5,
          // inference_steps: more steps = smoother but slower. 40 is optimal.
          inference_steps: 40,
        } as never,
        logs: false,
      }) as { data?: { video?: { url?: string }; video_url?: string } }

      syncedUrl = result.data?.video?.url || result.data?.video_url

      // LatentSync can occasionally fail on difficult angles — fall back to pro.
      if (!syncedUrl) {
        console.warn("[lipsync] LatentSync returned no video, falling back to lipsync-2-pro")
        const fallback = await fal.subscribe("fal-ai/sync-lipsync/v2", {
          input: {
            model: "lipsync-2-pro",
            video_url: videoUrl,
            audio_url: audioUrl,
            sync_mode: "cut_off",
          } as never,
          logs: false,
        }) as { data?: { video?: { url?: string }; video_url?: string } }
        syncedUrl = fallback.data?.video?.url || fallback.data?.video_url
      }
    } else {
      // ── Sync Labs lipsync-2-pro ───────────────────────────────────────────
      // Phoneme-accurate, fast. Better for wide shots where the face is small.
      const result = await fal.subscribe("fal-ai/sync-lipsync/v2", {
        input: {
          model: "lipsync-2-pro",
          video_url: videoUrl,
          audio_url: audioUrl,
          sync_mode: "cut_off",
        } as never,
        logs: false,
      }) as { data?: { video?: { url?: string }; video_url?: string } }

      syncedUrl = result.data?.video?.url || result.data?.video_url
    }

    if (!syncedUrl) {
      await refundCredits(charge.userId, CREDIT_COST.lipsync)
      return NextResponse.json({ error: "Lip-sync produced no video" }, { status: 502 })
    }

    return NextResponse.json({ videoUrl: syncedUrl, remaining: charge.remaining, engine })
  } catch (error) {
    await refundCredits(charge.userId, CREDIT_COST.lipsync)
    console.error("Lip-sync error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Lip-sync failed" },
      { status: 500 },
    )
  }
}
