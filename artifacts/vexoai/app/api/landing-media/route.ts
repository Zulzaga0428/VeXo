import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("landing_media")
    .select("slot, media_url, media_type, caption, updated_at")
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const map: Record<string, any> = {}
  for (const row of data ?? []) map[row.slot] = row
  return NextResponse.json({ items: data ?? [], map })
}
