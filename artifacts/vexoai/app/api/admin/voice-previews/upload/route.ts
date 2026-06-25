import { NextResponse } from "next/server"
import { logger, toErrStr } from "@/lib/logger"
import { createClient } from "@/lib/supabase/server"
import { isAdminEmail } from "@/lib/supabase/admin"
import { uploadPublicMedia } from "@/lib/blob-upload"

// Server-side upload for admin-recorded voice preview clips (short mp3/wav).
// The Blob store is private, so we upload via put(access:"private") and return
// a public proxy URL that the client persists via /api/admin/voice-previews.
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!isAdminEmail(user?.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const { url } = await uploadPublicMedia("voice-previews", file)
    return NextResponse.json({ url })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed"
    logger.error("voice-preview upload error:", { err: toErrStr(message) })
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export const runtime = "nodejs"
export const maxDuration = 60
