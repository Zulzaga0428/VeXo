import { NextRequest, NextResponse } from "next/server"
import { fal } from "@fal-ai/client"
import { refundCredits, CREDIT_COST } from "@/lib/credits"
import { pendingLipsyncJobs } from "@/lib/lipsync-jobs"

fal.config({ credentials: process.env.FAL_KEY })

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
  // ignore it for control flow and use the authoritative server-side job.engine
  // below — trusting the client could let a failed pro job spawn another pro
  // fallback instead of refunding.

  if (!requestId) {
    return NextResponse.json({ error: "requestId required" }, { status: 400 })
  }

  const job = pendingLipsyncJobs.get(requestId)
  if (!job) {
    // Server may have restarted and lost in-memory state
    return NextResponse.json({
      status: "failed",
      error: "Job not found (server restarted?). Please retry generation.",
    })
  }

  try {
    const qStatus = (await fal.queue.status(job.model, {
      requestId,
      logs: false,
    })) as { status: string }

    if (qStatus.status === "IN_QUEUE" || qStatus.status === "IN_PROGRESS") {
      return NextResponse.json({ status: "processing" })
    }

    if (qStatus.status === "COMPLETED") {
      const result = (await fal.queue.result(job.model, { requestId })) as {
        data?: { video?: { url?: string }; video_url?: string }
      }
      const videoUrl = result.data?.video?.url || result.data?.video_url

      if (videoUrl) {
        pendingLipsyncJobs.delete(requestId)
        return NextResponse.json({ status: "done", videoUrl })
      }

      console.warn("[lipsync-status] COMPLETED but no video url, engine:", job.engine, "requestId:", requestId)
    } else if (qStatus.status === "FAILED") {
      console.warn("[lipsync-status] FAL job FAILED, engine:", job.engine, "requestId:", requestId)
    } else {
      // Unknown status — keep polling
      return NextResponse.json({ status: "processing" })
    }

    // Terminal: COMPLETED-without-url or FAILED. This is a POLL endpoint, so two
    // concurrent polls can reach here for the same requestId. Claim EXCLUSIVE
    // ownership of the transition BEFORE doing anything terminal — otherwise both
    // polls could submit a pro fallback (duplicate FAL jobs for one charge) and
    // later both refund (refundCredits is not idempotent). Map.delete() is
    // synchronous/atomic in single-threaded JS: only the poll that removes the
    // entry owns the transition. Losers return "processing" and let the owner's
    // outcome (fallback newId or refund) stand. (Jobs live in a per-instance
    // in-memory map, so this single-process gate matches the lipsync design.)
    const owns = pendingLipsyncJobs.delete(requestId)
    if (!owns) {
      return NextResponse.json({ status: "processing" })
    }

    // We own this requestId — try the natural -> pro fallback exactly once.
    // Branch on the authoritative server-side job.engine (NOT the client query
    // param): a terminal pro job must refund here, never spawn another pro job.
    if (job.engine === "natural") {
      try {
        const fallback = (await fal.queue.submit("fal-ai/sync-lipsync/v2", {
          input: proInput(job.videoUrl, job.audioUrl) as never,
        })) as { request_id: string }

        const newId = fallback.request_id
        pendingLipsyncJobs.set(newId, {
          ...job,
          engine: "pro",
          model: "fal-ai/sync-lipsync/v2",
        })
        console.warn("[lipsync-status] falling back to lipsync-2-pro, new requestId:", newId)
        return NextResponse.json({ status: "fallback", requestId: newId, engine: "pro" })
      } catch (e) {
        console.warn(
          "[lipsync-status] pro fallback submit also failed:",
          e instanceof Error ? e.message : e,
        )
        // We already own (removed) this requestId, so fall through and refund now
        // rather than relying on a later poll of an id that no longer exists.
      }
    }

    // All engines exhausted (or the fallback submit failed). We own the
    // requestId, so this refunds exactly once.
    await refundCredits(job.userId, CREDIT_COST.lipsync)
    return NextResponse.json({ status: "failed", error: "Lip-sync failed on all engines" })
  } catch (error) {
    console.error("[lipsync-status] unexpected error:", error)
    // Return processing so the client retries rather than hard-failing
    return NextResponse.json({ status: "processing" })
  }
}
