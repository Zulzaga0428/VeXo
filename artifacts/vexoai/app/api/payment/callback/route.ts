import { NextRequest, NextResponse } from "next/server"
import { logger, toErrStr } from "@/lib/logger"
import { createClient } from "@supabase/supabase-js"
import { checkPayment } from "@/lib/qpay"

export async function GET(request: NextRequest) {
  return handleCallback(request)
}

export async function POST(request: NextRequest) {
  return handleCallback(request)
}

async function handleCallback(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get("user_id")
    const planType = searchParams.get("plan")

    if (!userId || !planType) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 })
    }

    // Use service role for callback (no user session)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Find the most recent pending payment for this user + plan
    const { data: payment } = await supabase
      .from("payments")
      .select("*")
      .eq("user_id", userId)
      .eq("plan_type", planType)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    if (!payment) {
      // No pending payment = already processed or spoofed call
      return NextResponse.json({ success: true })
    }

    // CRITICAL: verify the real payment with QPay
    const verify = await checkPayment(payment.invoice_id)
    if (!verify.paid) {
      return NextResponse.json({ success: false, reason: "not paid" })
    }

    // Make sure the paid amount matches the expected amount
    if (verify.paid_amount != null && verify.paid_amount < payment.amount) {
      return NextResponse.json({ success: false, reason: "amount mismatch" })
    }

    // IDEMPOTENT: only add credits if this row transitions pending → paid
    const { data: updated } = await supabase
      .from("payments")
      .update({ status: "paid", payment_id: verify.payment_id })
      .eq("id", payment.id)
      .eq("status", "pending") // guards against race condition / double crediting
      .select()
      .single()

    if (!updated) {
      // Another request already marked it paid — don't add credits again
      return NextResponse.json({ success: true, alreadyProcessed: true })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("credits")
      .eq("id", userId)
      .single()

    const newCredits = (profile?.credits || 0) + updated.credits
    await supabase.from("profiles").update({ credits: newCredits }).eq("id", userId)

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error("Payment callback error:", { err: toErrStr(error) })
    return NextResponse.json({ error: "Callback failed" }, { status: 500 })
  }
}
