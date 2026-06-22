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

// GET — public map of voice_id -> audio_url so the picker can play previews
// without spending TTS credits.
export async function GET() {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("voice_previews")
    .select("voice_id, audio_url, label")
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ previews: data ?? [] })
}

// POST — upsert a preview clip for a voice (admin only).
export async function POST(req: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

  const body = await req.json()
  const { voice_id, audio_url, label } = body
  if (!voice_id || !audio_url) {
    return NextResponse.json({ error: "voice_id and audio_url required" }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("voice_previews")
    .upsert(
      { voice_id, audio_url, label: label ?? "", updated_at: new Date().toISOString() },
      { onConflict: "voice_id" },
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ preview: data })
}

// DELETE — remove a preview clip for a voice (admin only). ?voice_id=...
export async function DELETE(req: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

  const url = new URL(req.url)
  const voiceId = url.searchParams.get("voice_id")
  if (!voiceId) return NextResponse.json({ error: "voice_id required" }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from("voice_previews").delete().eq("voice_id", voiceId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
