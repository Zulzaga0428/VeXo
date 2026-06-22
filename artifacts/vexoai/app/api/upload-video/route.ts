import { NextResponse } from "next/server"
import { uploadFile } from "@/lib/storage"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const key = `videos/${Date.now()}-${file.name.replace(/[^a-z0-9._-]/gi, "_")}`
    const url = await uploadFile(key, file, file.type)

    return NextResponse.json({ url })
  } catch (error) {
    console.error("[v0] Upload error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    )
  }
}
