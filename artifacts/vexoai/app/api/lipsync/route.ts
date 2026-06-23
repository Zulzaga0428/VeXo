import { NextRequest, NextResponse } from "next/server"
import { fal } from "@fal-ai/client"
import {
  chargeCredits,
  refundCredits,
  recordCharge,
  compensateUnrecordedCharge,
  CREDIT_COST,
} from "@/lib/credits"
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

    const falEndpoint = engineEndpoint(activeEngine)

    // Persist the charge durably so refunds survive restarts/scaling — the
    // status poll and the reconcile sweep refund/settle by this requestId. If the
    // row can't be written, compensate so the user is never charged for a job no
    // refund path can recover. (refundCredits below is only for the pre-record
    // submit-throw path, where no charge row exists yet.)
    const recorded = await recordCharge(
      requestId,
      charge.userId,
      CREDIT_COST.lipsync,
      "lipsync",
      { model: falEndpoint },
    )
    if (!recorded) {
      const outcome = await compensateUnrecordedCharge(
        requestId,
        charge.userId,
        CREDIT_COST.lipsync,
        "lipsync",
        { model: falEndpoint },
      )
      if (outcome.status === "credited") {
        // The charge couldn't be tracked, so it was refunded now. Do NOT return a
        // requestId — a tracked refund plus a pollable job would let the user get
        // a free result after already being credited back.
        return NextResponse.json(
          {
            error:
              "Lip-sync could not be started. Your credits were refunded — please try again.",
          },
          { status: 503 },
        )
      }
      if (outcome.status === "failed") {
        // Nothing recorded and nothing credited: the user is still debited with
        // no automatic recovery. Surface loudly for manual reconciliation.
        console.error("[lipsync] BILLING_INCIDENT charge unrecorded and uncompensated", {
          requestId,
          userId: charge.userId,
          cost: CREDIT_COST.lipsync,
        })
        return NextResponse.json(
          {
            error:
              "Lip-sync could not be started. Please contact support if your credits were not returned.",
          },
          { status: 500 },
        )
      }
      // already_recorded | deferred -> a pending row exists; safe to proceed.
    }

    // Fast-path metadata cache for the natural->pro fallback (videoUrl/audioUrl).
    // NOT authoritative for refunds — the generation_charges row above is. Lost on
    // restart, which only disables the fallback (the job then refunds), never a
    // refund itself.
    pendingLipsyncJobs.set(requestId, {
      videoUrl,
      audioUrl,
      userId: charge.userId,
      engine: activeEngine,
      model: falEndpoint,
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
