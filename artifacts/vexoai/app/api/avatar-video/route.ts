import { NextRequest, NextResponse } from "next/server"
import { logger, toErrStr } from "@/lib/logger"
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
      const comp = await compensateUnrecordedCharge(result.requestId, charge.userId, cost, "avatar")
      if (comp.status === "failed") {
        logger.error("[avatar-video] BILLING_INCIDENT charge_unrecovered", {
          requestId: result.requestId, userId: charge.userId, cost, kind: "avatar",
        })
      } else {
        logger.error("[avatar-video] CHARGE_NOT_RECORDED resolved via compensation", {
          requestId: result.requestId, userId: charge.userId, cost, outcome: comp.status,
        })
      }
    }

    return NextResponse.json({ requestId: result.requestId })
  } catch (error) {
    logger.error("[avatar-video] error:", { err: toErrStr(error) })
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
