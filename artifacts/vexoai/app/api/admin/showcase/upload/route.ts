import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isAdminEmail } from "@/lib/supabase/admin"
import { uploadPublicMedia } from "@/lib/blob-upload"

// Server-side upload for showcase media. Private store -> public proxy URL.
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

    const { url } = await uploadPublicMedia("showcase", file)
    const isVideo = (file.type || "").startsWith("video")
    return NextResponse.json({ url, media_type: isVideo ? "video" : "image" })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed"
    console.error("showcase upload error:", message)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export const runtime = "nodejs"
export const maxDuration = 60
