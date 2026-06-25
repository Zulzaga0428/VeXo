import { NextRequest, NextResponse } from "next/server"
import { logger, toErrStr } from "@/lib/logger"
import { fal } from "@fal-ai/client"
import { getLipsyncStatus } from "@/lib/fal-video"
import { refundCharge, settleCharge, transferCharge, getCharge } from "@/lib/credits"
import { pendingLipsyncJobs } from "@/lib/lipsync-jobs"

fal.config({ credentials: process.env.FAL_KEY })

// FAL endpoints, stored in each charge row's `model` so a job can be resolved
// without in-memory state (after a restart or on another instance).
const NATURAL_ENDPOINT = "fal-ai/latentsync"
const PRO_ENDPOINT = "fal-ai/sync-lipsync/v2"

// Status poll for async lipsync jobs submitted by /api/lipsync.
// Returns one of: { status: "processing" | "done" | "fallback" | "failed" }
export const maxDuration = 30

function proInput(videoUrl: string, audioUrl: string) {
  return {
    model: "lipsync-2-pro",
    video_url: videoUrl,
    audio_url: audioUrl,
    sync_mode: "cut_off",
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const requestId = searchParams.get("requestId")
  // NOTE: the client also sends an `engine` query param, but we deliberately
  // ignore it for control flow and rely on the authoritative server-side model
  // (the in-memory job, else the durable charge row) — trusting the client could
  // let a failed pro job spawn another pro fallback instead of refunding.

  if (!requestId) {
    return NextResponse.json({ error: "requestId required" }, { status: 400 })
  }

  // Fast-path metadata cache (videoUrl/audioUrl/model) needed for the natural->
  // pro fallback. Absent after a server restart or on another instance — refund
  // correctness no longer depends on it.
  const job = pendingLipsyncJobs.get(requestId)

  // The FAL endpoint to poll: prefer the in-memory job, else recover it from the
  // durable charge row so a restarted/other instance can still resolve the job.
  let model = job?.model
  if (!model) {
    const charge = await getCharge(requestId)
    model = charge?.model ?? undefined
  }
  if (!model) {
    // No live metadata and no charge row -> nothing to resolve against. (A
    // pending row that somehow lacks a model is still handled by the reconcile
    // sweep, which defaults to the pro endpoint and refunds/settles it.)
    return NextResponse.json({
      status: "failed",
      error: "Job not found. Please retry generation.",
    })
  }

  try {
    const result = await getLipsyncStatus(requestId, model)

    if (result.status === "processing") {
      return NextResponse.json({ status: "processing" })
    }

    if (result.status === "succeed" && result.videoUrl) {
      // Settle (idempotent) so a later spurious failure poll can never refund it.
      await settleCharge(requestId)
      pendingLipsyncJobs.delete(requestId)
      return NextResponse.json({ status: "done", videoUrl: result.videoUrl })
    }

    // Terminal failure (FAILED, or COMPLETED without a usable video url). Try the
    // natural -> pro fallback exactly once, but ONLY for a natural job AND only
    // while the source media is still cached in memory to resubmit. After a
    // restart (no metadata) we degrade to a refund.
    const isNatural = model === NATURAL_ENDPOINT
    if (isNatural && job) {
      try {
        const fallback = (await fal.queue.submit(PRO_ENDPOINT, {
          input: proInput(job.videoUrl, job.audioUrl) as never,
        })) as { request_id: string }
        const newId = fallback.request_id

        // Atomically move the charge onto the new requestId. The RPC's
        // "old must still be pending" check is the cross-instance single-owner
        // gate: only ONE concurrent poll wins the transfer.
        const transferred = await transferCharge(requestId, newId, PRO_ENDPOINT)
        if (transferred) {
          pendingLipsyncJobs.delete(requestId)
          pendingLipsyncJobs.set(newId, { ...job, engine: "pro", model: PRO_ENDPOINT })
          logger.warn("[lipsync-status] falling back to lipsync-2-pro", { newRequestId: newId })
          return NextResponse.json({ status: "fallback", requestId: newId, engine: "pro" })
        }

        // We lost the ownership race (another poll/instance already resolved or
        // transferred this charge). Our pro job has no charge row — discard it as
        // an orphan and let the owner's outcome stand.
        logger.warn("[lipsync-status] fallback transfer lost ownership; discarding orphan pro job", { newId })
        pendingLipsyncJobs.delete(requestId)
        return NextResponse.json({ status: "processing" })
      } catch (e) {
        logger.warn("[lipsync-status] pro fallback submit failed", { err: toErrStr(e) })
        // Fall through to refund below.
      }
    }

    // No fallback (pro job, restart with no metadata, or the fallback submit
    // threw). Refund exactly once — idempotent across concurrent polls and
    // instances via the request_id-keyed RPC.
    await refundCharge(requestId)
    pendingLipsyncJobs.delete(requestId)
    return NextResponse.json({ status: "failed", error: "Lip-sync failed on all engines" })
  } catch (error) {
    logger.error("[lipsync-status] unexpected error", { err: toErrStr(error) })
    // Return processing so the client retries rather than hard-failing.
    return NextResponse.json({ status: "processing" })
  }
}
