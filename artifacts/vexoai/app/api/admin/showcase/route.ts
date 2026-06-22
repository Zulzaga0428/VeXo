import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient, isAdminEmail } from "@/lib/supabase/admin"

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!isAdminEmail(user?.email)) return null
  return user
}

// GET — public list (active only) OR admin list (all)
export async function GET(req: Request) {
  const url = new URL(req.url)
  const all = url.searchParams.get("all") === "true"
  const admin = createAdminClient()
  let query = admin.from("showcase_items").select("*").order("sort_order", { ascending: true })
  if (!all) query = query.eq("is_active", true)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data ?? [] })
}

// POST — create new showcase item
export async function POST(req: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

  const body = await req.json()
  const { title_mn, title_en, media_url, media_type, poster_url, sort_order, is_active } = body

  if (!media_url) return NextResponse.json({ error: "media_url required" }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("showcase_items")
    .insert({
      title_mn: title_mn ?? "",
      title_en: title_en ?? "",
      media_url,
      media_type: media_type ?? "image",
      poster_url: poster_url ?? null,
      sort_order: sort_order ?? 0,
      is_active: is_active ?? true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ item: data })
}
