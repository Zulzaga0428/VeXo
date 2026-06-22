import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

// Public list of admin-curated free prompts. Cached for a short window so the
// page stays fast even with many concurrent visitors (like the gallery).
export const revalidate = 60

export async function GET() {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from("prompt_library")
      .select("id, title, prompt_text, category, media_url, media_type, poster_url")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })
    if (error) return NextResponse.json({ prompts: [] })
    return NextResponse.json({ prompts: data ?? [] })
  } catch {
    return NextResponse.json({ prompts: [] })
  }
}

// POST — increment copy_count when a user copies a prompt. Best-effort, no auth.
export async function POST(req: Request) {
  try {
    const { id } = await req.json()
    if (!id) return NextResponse.json({ ok: false })
    const admin = createAdminClient()
    await admin.rpc("increment_prompt_copy", { row_id: id })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false })
  }
}
