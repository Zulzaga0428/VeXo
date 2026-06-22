import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient, isAdminEmail } from "@/lib/supabase/admin"

export async function PATCH(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id, plan, credits } = await req.json()
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 })
  }

  const admin = createAdminClient()
  const update: Record<string, unknown> = {}
  if (typeof plan === "string") update.plan = plan
  if (typeof credits === "number") update.credits = credits

  const { error } = await admin.from("profiles").update(update).eq("id", id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
