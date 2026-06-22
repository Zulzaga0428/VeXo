import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient, isAdminEmail } from "@/lib/supabase/admin"

// Admin-only: add credits on top of a user's existing balance.
// Uses a Supabase RPC so the increment is atomic (no read-modify-write race).
export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { userId, amount } = await req.json()
  if (!userId || typeof amount !== "number" || amount <= 0 || amount > 100_000) {
    return NextResponse.json({ error: "userId and positive amount required" }, { status: 400 })
  }

  const admin = createAdminClient()

  // Atomic increment — avoids race conditions between concurrent requests.
  const { data, error } = await admin.rpc("add_credits", {
    p_user_id: userId,
    p_amount: Math.round(amount),
  })

  if (error) {
    // Fallback: if the RPC doesn't exist yet, do a manual read-then-update.
    // (The RPC is the preferred path once the Supabase function is deployed.)
    const { data: profile } = await admin
      .from("profiles")
      .select("credits")
      .eq("id", userId)
      .single()

    if (!profile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const newCredits = (profile.credits ?? 0) + Math.round(amount)
    const { error: updateErr } = await admin
      .from("profiles")
      .update({ credits: newCredits })
      .eq("id", userId)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, newCredits })
  }

  return NextResponse.json({ ok: true, newCredits: data })
}
