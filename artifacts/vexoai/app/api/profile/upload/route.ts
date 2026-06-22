import { createClient } from "@/lib/supabase/server"
import { uploadFile } from "@/lib/storage"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const form = await req.formData()
  const file = form.get("file") as File | null
  const kind = (form.get("kind") as string | null) || "avatar"
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 })
  if (!["avatar", "banner"].includes(kind)) {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 })
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only images allowed" }, { status: 400 })
  }
  if (file.size > 4 * 1024 * 1024) {
    return NextResponse.json({ error: "Max 4MB" }, { status: 400 })
  }

  const ext = file.name.split(".").pop() || "jpg"
  const path = `profiles/${user.id}/${kind}-${Date.now()}.${ext}`
  const url = await uploadFile(path, file, file.type)

  const column = kind === "avatar" ? "avatar_url" : "banner_url"
  await supabase.from("profiles").update({ [column]: url }).eq("id", user.id)

  return NextResponse.json({ url })
}
