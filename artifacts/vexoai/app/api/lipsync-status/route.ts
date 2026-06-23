import { NextRequest, NextResponse } from "next/server"
import { fal } from "@fal-ai/client"
import { refundCredits, CREDIT_COST } from "@/lib/credits"
import { pendingLipsyncJobs, type LipsyncEngine } from "@/lib/lipsync-jobs"

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
  const engine = (searchParams.get("engine") ?? "natural") as LipsyncEngine

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

      console.warn("[lipsync-status] COMPLETED but no video url, engine:", engine, "requestId:", requestId)
    } else if (qStatus.status === "FAILED") {
      console.warn("[lipsync-status] FAL job FAILED, engine:", engine, "requestId:", requestId)
    } else {
      // Unknown status — keep polling
      return NextResponse.json({ status: "processing" })
    }

    // COMPLETED with no url, or FAILED — try fallback engine
    if (engine === "natural") {
      try {
        const fallback = (await fal.queue.submit("fal-ai/sync-lipsync/v2", {
          input: proInput(job.videoUrl, job.audioUrl) as never,
        })) as { request_id: string }

        const newId = fallback.request_id
        pendingLipsyncJobs.delete(requestId)
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
      }
    }

    // All engines exhausted — refund and report failure
    pendingLipsyncJobs.delete(requestId)
    await refundCredits(job.userId, CREDIT_COST.lipsync)
    return NextResponse.json({ status: "failed", error: "Lip-sync failed on all engines" })
  } catch (error) {
    console.error("[lipsync-status] unexpected error:", error)
    // Return processing so the client retries rather than hard-failing
    return NextResponse.json({ status: "processing" })
  }
}
