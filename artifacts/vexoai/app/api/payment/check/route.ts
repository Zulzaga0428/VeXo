import { NextRequest, NextResponse } from "next/server"
import { logger, toErrStr } from "@/lib/logger"
import { checkPayment } from "@/lib/qpay"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const invoiceId = request.nextUrl.searchParams.get("invoiceId")

    if (!invoiceId) {
      return NextResponse.json({ error: "Invoice ID required" }, { status: 400 })
    }

    const result = await checkPayment(invoiceId)

    if (result.paid) {
      // Update payment status
      const { data: payment } = await supabase
        .from("payments")
        .update({ status: "paid", payment_id: result.payment_id })
        .eq("invoice_id", invoiceId)
        .eq("user_id", user.id)
        .eq("status", "pending") // only credit once — guards against double crediting
        .select()
        .single()

      if (payment) {
        // Update user credits (only on the first pending → paid transition)
        const { data: profile } = await supabase
          .from("profiles")
          .select("credits")
          .eq("id", user.id)
          .single()

        const newCredits = (profile?.credits || 0) + payment.credits

        await supabase
          .from("profiles")
          .update({ credits: newCredits })
          .eq("id", user.id)
      }
    }

    return NextResponse.json({ paid: result.paid })
  } catch (error) {
    logger.error("Payment check error:", { err: toErrStr(error) })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Payment check failed" },
      { status: 500 }
    )
  }
}
