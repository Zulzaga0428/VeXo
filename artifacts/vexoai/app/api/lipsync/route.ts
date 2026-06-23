import { NextRequest, NextResponse } from "next/server"
import { fal } from "@fal-ai/client"
import { chargeCredits, refundCredits, CREDIT_COST } from "@/lib/credits"
import { pendingLipsyncJobs, type LipsyncEngine } from "@/lib/lipsync-jobs"

fal.config({ credentials: process.env.FAL_KEY })

// Submit only — returns requestId immediately so the client can poll
// /api/lipsync-status without holding this HTTP connection open for 1-3 min.
// (Long synchronous fal.subscribe calls are killed by Railway's proxy timeout.)
export const maxDuration = 30

function engineEndpoint(engine: LipsyncEngine): string {
  return engine === "natural" ? "fal-ai/latentsync" : "fal-ai/sync-lipsync/v2"
}

function engineInput(engine: LipsyncEngine, videoUrl: string, audioUrl: string) {
  if (engine === "natural") {
    return {
      video_url: videoUrl,
      audio_url: audioUrl,
      guidance_scale: 2.5,
      inference_steps: 40,
    }
  }
  return {
    model: "lipsync-2-pro",
    video_url: videoUrl,
    audio_url: audioUrl,
    sync_mode: "cut_off",
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    videoUrl?: string
    audioUrl?: string
    engine?: LipsyncEngine
  }
  const { videoUrl, audioUrl, engine = "natural" } = body

  if (!videoUrl || !audioUrl) {
    return NextResponse.json({ error: "videoUrl and audioUrl are required" }, { status: 400 })
  }

  // Validate URLs before charging credits
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

  const charge = await chargeCredits(CREDIT_COST.lipsync)
  if (!charge.ok) {
    return NextResponse.json({ error: charge.error }, { status: charge.status })
  }

  try {
    let requestId: string | undefined
    let activeEngine: LipsyncEngine = engine

    try {
      const ep = engineEndpoint(activeEngine)
      const result = (await fal.queue.submit(ep, {
        input: engineInput(activeEngine, videoUrl, audioUrl) as never,
      })) as { request_id: string }
      requestId = result.request_id
    } catch (e) {
      if (activeEngine === "natural") {
        // LatentSync submit failed — try lipsync-2-pro immediately
        console.warn(
          "[lipsync] LatentSync submit failed, falling back to lipsync-2-pro:",
          e instanceof Error ? e.message : e,
        )
        activeEngine = "pro"
        const result = (await fal.queue.submit("fal-ai/sync-lipsync/v2", {
          input: engineInput("pro", videoUrl, audioUrl) as never,
        })) as { request_id: string }
        requestId = result.request_id
      } else {
        throw e
      }
    }

    if (!requestId) throw new Error("FAL queue submit returned no request_id")

    // Register the job so /api/lipsync-status can look it up
    pendingLipsyncJobs.set(requestId, {
      videoUrl,
      audioUrl,
      userId: charge.userId,
      engine: activeEngine,
      model: engineEndpoint(activeEngine),
    })

    return NextResponse.json({ requestId, engine: activeEngine })
  } catch (error) {
    await refundCredits(charge.userId, CREDIT_COST.lipsync)
    console.error("[lipsync] submit error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Lip-sync submit failed" },
      { status: 500 },
    )
  }
}
