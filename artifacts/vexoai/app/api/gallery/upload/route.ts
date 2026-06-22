import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { uploadFile } from "@/lib/storage"

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

  const url = await uploadFile(key, file, file.type)

  return NextResponse.json({
    url,
    media_type: isVideo ? "video" : "image",
  })
}
