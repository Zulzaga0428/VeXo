import { NextRequest, NextResponse } from "next/server"
import { getAvatarVideoStatus } from "@/lib/fal-video"
import { refundCharge, settleCharge } from "@/lib/credits"

export async function GET(request: NextRequest) {
  try {
    const requestId = request.nextUrl.searchParams.get("requestId")
    if (!requestId) {
      return NextResponse.json({ error: "requestId is required" }, { status: 400 })
    }

    const result = await getAvatarVideoStatus(requestId)

    // Settle on success / refund on terminal failure (both idempotent).
    if (result.status === "succeed") {
      await settleCharge(requestId)
    } else if (result.status === "failed") {
      await refundCharge(requestId)
    }

    return NextResponse.json({
      status: result.status,
      progress: result.progress ?? 30,
      videoUrl: result.videoUrl,
    })
  } catch (error) {
    console.error("[avatar-status] error:", error)
    return NextResponse.json({ error: "Failed to check status" }, { status: 500 })
  }
}
