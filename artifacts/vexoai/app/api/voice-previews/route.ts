import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

// Public list of admin-uploaded voice preview clips. The picker uses this to
// play a real sample on demand instead of calling TTS (saves credits).
export const revalidate = 30

export async function GET() {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from("voice_previews")
      .select("voice_id, audio_url, label")
    if (error) return NextResponse.json({ previews: [] })
    return NextResponse.json({ previews: data ?? [] })
  } catch {
    return NextResponse.json({ previews: [] })
  }
}
