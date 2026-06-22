import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient, isAdminEmail } from "@/lib/supabase/admin"

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!isAdminEmail(user?.email)) return null
  return user
}

// GET — full list (including inactive) for the admin manager.
export async function GET() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("prompt_library")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ prompts: data ?? [] })
}

// POST — create a new free prompt entry (admin only).
export async function POST(req: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

  const body = await req.json()
  const { title, prompt_text, category, media_url, media_type, poster_url, sort_order } = body
  if (!prompt_text || typeof prompt_text !== "string") {
    return NextResponse.json({ error: "prompt_text required" }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("prompt_library")
    .insert({
      title: title ?? "",
      prompt_text,
      category: category ?? "",
      media_url: media_url ?? "",
      media_type: media_type === "video" ? "video" : "image",
      poster_url: poster_url ?? null,
      sort_order: typeof sort_order === "number" ? sort_order : 0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ prompt: data })
}

// PATCH — update an entry (admin only). Body must include id.
export async function PATCH(req: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

  const body = await req.json()
  const { id, ...fields } = body
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  const allowed: Record<string, unknown> = {}
  for (const k of ["title", "prompt_text", "category", "media_url", "media_type", "poster_url", "sort_order", "is_active"]) {
    if (k in fields) allowed[k] = fields[k]
  }
  allowed.updated_at = new Date().toISOString()

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("prompt_library")
    .update(allowed)
    .eq("id", id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ prompt: data })
}

// DELETE — remove an entry (admin only). ?id=...
export async function DELETE(req: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

  const url = new URL(req.url)
  const id = url.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from("prompt_library").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
