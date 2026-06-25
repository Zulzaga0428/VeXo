import { NextRequest, NextResponse } from "next/server"
import { logger, toErrStr } from "@/lib/logger"
import { createInvoice } from "@/lib/qpay"
import { createClient } from "@/lib/supabase/server"

const PLANS = {
  credits_10: { amount: 40000, description: "VexoAi 75 кредит", credits: 75 },
  credits_30: { amount: 60000, description: "VexoAi 95 кредит", credits: 95 },
  credits_100: { amount: 80000, description: "VexoAi 180 кредит", credits: 180 },
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { planType } = await request.json()

    if (!planType || !PLANS[planType as keyof typeof PLANS]) {
      return NextResponse.json({ error: "Invalid plan type" }, { status: 400 })
    }

    const plan = PLANS[planType as keyof typeof PLANS]

    const invoice = await createInvoice({
      amount: plan.amount,
      description: plan.description,
      userId: user.id,
      planType: planType as any,
    })

    // Store pending payment in database
    await supabase.from("payments").insert({
      user_id: user.id,
      invoice_id: invoice.invoice_id,
      plan_type: planType,
      amount: plan.amount,
      credits: plan.credits,
      status: "pending",
    })

    return NextResponse.json({
      invoiceId: invoice.invoice_id,
      qrText: invoice.qr_text,
      qrImage: invoice.qr_image,
      bankUrls: invoice.urls,
      amount: plan.amount,
      description: plan.description,
    })
  } catch (error) {
    logger.error("Payment create error:", { err: toErrStr(error) })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Payment creation failed" },
      { status: 500 }
    )
  }
}
