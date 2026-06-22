import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient, isAdminEmail } from "@/lib/supabase/admin"

async function ensureAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, status: 401, supabase }
  if (!isAdminEmail(user.email)) return { ok: false as const, status: 403, supabase }
  return { ok: true as const, supabase, user }
}

export async function GET() {
  const auth = await ensureAdmin()
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status })
  const admin = createAdminClient()
  const { data, error } = await admin.from("landing_media").select("*").order("slot")
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data ?? [] })
}

export async function POST(req: Request) {
  const auth = await ensureAdmin()
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })

  const slot = String(body.slot || "").trim()
  const media_url = String(body.media_url || "").trim()
  const media_type = body.media_type === "video" ? "video" : "image"
  const caption = body.caption ? String(body.caption).trim() : null

  if (!slot) return NextResponse.json({ error: "slot required" }, { status: 400 })
  if (!media_url) return NextResponse.json({ error: "media_url required" }, { status: 400 })

  const payload = {
    slot,
    media_url,
    media_type,
    caption,
    updated_at: new Date().toISOString(),
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("landing_media")
    .upsert(payload, { onConflict: "slot" })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ item: data })
}

export async function DELETE(req: Request) {
  const auth = await ensureAdmin()
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status })
  const { searchParams } = new URL(req.url)
  const slot = searchParams.get("slot")
  if (!slot) return NextResponse.json({ error: "slot required" }, { status: 400 })
  const admin = createAdminClient()
  const { error } = await admin.from("landing_media").delete().eq("slot", slot)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
