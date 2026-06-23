import { NextRequest, NextResponse } from "next/server"
import { createAvatarVideo } from "@/lib/fal-video"
import {
  chargeCredits,
  refundCredits,
  recordCharge,
  compensateUnrecordedCharge,
  CREDIT_COST,
} from "@/lib/credits"

export async function POST(request: NextRequest) {
  try {
    const { imageUrl, audioUrl, prompt } = await request.json()

    if (!imageUrl || !audioUrl) {
      return NextResponse.json(
        { error: "imageUrl and audioUrl are required" },
        { status: 400 },
      )
    }

    const cost = CREDIT_COST.video_standard
    const charge = await chargeCredits(cost)
    if (!charge.ok) {
      return NextResponse.json({ error: charge.error }, { status: charge.status })
    }

    let result
    try {
      result = await createAvatarVideo({ imageUrl, audioUrl, prompt })
    } catch (e) {
      await refundCredits(charge.userId, cost)
      const raw = (e as any)?.body?.detail || (e as any)?.message || ""
      const text = String(raw)
      if ((e as any)?.status === 403 || /balance|locked|exhausted/i.test(text)) {
        return NextResponse.json(
          { error: "FAL account balance exhausted. Please top up." },
          { status: 402 },
        )
      }
      return NextResponse.json({ error: "Avatar video submission failed" }, { status: 500 })
    }

    // Record the charge keyed by requestId so /api/avatar-status can refund it
    // if the async job later fails or times out.
    const recorded = await recordCharge(result.requestId, charge.userId, cost, "avatar")
    // Untracked submitted job -> compensate so the user's credits aren't lost.
    if (!recorded) {
      console.error(
        "[avatar-video] CHARGE_NOT_RECORDED — compensating to avoid lost credits",
        { requestId: result.requestId, userId: charge.userId, cost },
      )
      await compensateUnrecordedCharge(result.requestId, charge.userId, cost, "avatar")
    }

    return NextResponse.json({ requestId: result.requestId })
  } catch (error) {
    console.error("[avatar-video] error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
