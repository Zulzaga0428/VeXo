import { NextRequest, NextResponse } from "next/server"
import { createVideoGeneration, type VexoModel, type GenerationMode } from "@/lib/fal-video"
import {
  chargeCredits,
  refundCredits,
  recordCharge,
  compensateUnrecordedCharge,
  CREDIT_COST,
} from "@/lib/credits"

export async function POST(request: NextRequest) {
  try {
    const { mode, imageUrl, prompt, duration, aspectRatio, model, generateAudio } = await request.json()

    const safeMode: GenerationMode = mode === "text" ? "text" : "image"

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      )
    }
    if (safeMode === "image" && !imageUrl) {
      return NextResponse.json(
        { error: "Image is required for image-to-video" },
        { status: 400 }
      )
    }

    const validModels: VexoModel[] = ["standard", "veo3"]
    const safeModel: VexoModel = validModels.includes(model) ? model : "standard"

    const cost =
      safeModel === "veo3" ? CREDIT_COST.video_veo3 : CREDIT_COST.video_standard

    const charge = await chargeCredits(cost)
    if (!charge.ok) {
      return NextResponse.json({ error: charge.error }, { status: charge.status })
    }

    let result
    try {
      result = await createVideoGeneration({
        mode: safeMode,
        imageUrl,
        prompt,
        duration: duration || 5,
        aspectRatio: aspectRatio || "16:9",
        model: safeModel,
        generateAudio: generateAudio === true,
      })
    } catch (e) {
      // Generation failed after charging — always attempt to refund the user.
      // refundCredits is atomic and reports success, so we only tell the user
      // "(Кредит буцаагдсан)" when the credit actually went back.
      const refunded = await refundCredits(charge.userId, cost)

      // Surface a clear message when the FAL provider account is out of balance,
      // instead of a confusing "Forbidden" / 500 to the end user.
      const raw =
        (e as any)?.body?.detail ||
        (e as any)?.message ||
        ""
      const text = String(raw)
      if (
        (e as any)?.status === 403 ||
        /balance|locked|exhausted/i.test(text)
      ) {
        const base =
          "Видео үүсгэх үйлчилгээ түр боломжгүй байна. Та түр хүлээгээд дахин оролдоно уу."
        return NextResponse.json(
          { error: refunded ? `${base} (Кредит буцаагдсан)` : base },
          { status: 503 }
        )
      }
      throw e
    }

    // Record the charge keyed by requestId so /api/video-status (or the
    // reconciliation sweep) can refund it if the async job later fails or times
    // out. model/mode let the sweep re-check the right FAL endpoint.
    const recorded = await recordCharge(result.requestId, charge.userId, cost, "video", {
      model: result.model,
      mode: result.mode,
    })
    // The FAL job is already submitted, so if the charge couldn't be recorded
    // it would be untracked and unrefundable — compensate now so the user's
    // credits are never silently lost.
    if (!recorded) {
      const comp = await compensateUnrecordedCharge(result.requestId, charge.userId, cost, "video", {
        model: result.model,
        mode: result.mode,
      })
      if (comp.status === "failed") {
        // Could neither record nor refund — the user is still debited. Emit a
        // greppable incident so it can be alerted on and recovered manually.
        console.error("[generate-video] BILLING_INCIDENT charge_unrecovered", {
          requestId: result.requestId, userId: charge.userId, cost, kind: "video",
        })
      } else {
        console.error("[generate-video] CHARGE_NOT_RECORDED resolved via compensation", {
          requestId: result.requestId, userId: charge.userId, cost, outcome: comp.status,
        })
      }
    }

    return NextResponse.json({
      requestId: result.requestId,
      status: result.status,
      model: result.model,
      mode: result.mode,
    })
  } catch (error) {
    console.error("Video generation error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Видео үүсгэхэд алдаа гарлаа" },
      { status: 500 }
    )
  }
}
