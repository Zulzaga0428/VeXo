import { NextResponse, type NextRequest } from "next/server"
import { put } from "@vercel/blob"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  if (!file) return NextResponse.json({ error: "no file" }, { status: 400 })

  // 50MB max
  if (file.size > 50 * 1024 * 1024) return NextResponse.json({ error: "file too large (max 50MB)" }, { status: 400 })

  const isVideo = file.type.startsWith("video/")
  const ext = file.name.split(".").pop() || (isVideo ? "mp4" : "jpg")
  const key = `gallery/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  // Private store — keep the pathname; gallery serves it via /api/gallery/media/[id]
  const blob = await put(key, file, { access: "private", addRandomSuffix: false })

  return NextResponse.json({
    url: blob.pathname,
    media_type: isVideo ? "video" : "image",
  })
}
