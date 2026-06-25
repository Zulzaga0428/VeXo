import { NextResponse } from "next/server"
import { logger, toErrStr } from "@/lib/logger"
import { fal } from "@fal-ai/client"

fal.config({ credentials: process.env.FAL_KEY })

export const maxDuration = 60

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Upload to FAL storage so the model can fetch it directly via a short URL.
    // This avoids sending huge base64 data URLs through our API (which the
    // platform firewall/body-limit rejects with a 403 HTML page).
    const url = await fal.storage.upload(file)

    return NextResponse.json({ url })
  } catch (error) {
    logger.error("[v0] Image upload error:", { err: toErrStr(error) })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Зураг оруулахад алдаа гарлаа" },
      { status: 500 }
    )
  }
}
