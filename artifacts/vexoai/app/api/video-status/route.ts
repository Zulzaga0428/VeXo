import { NextRequest, NextResponse } from "next/server"
import { getVideoStatus, type VexoModel, type GenerationMode } from "@/lib/fal-video"

export async function GET(request: NextRequest) {
  try {
    const requestId = request.nextUrl.searchParams.get("requestId")
    const model = (request.nextUrl.searchParams.get("model") || "standard") as VexoModel
    const mode = (request.nextUrl.searchParams.get("mode") || "image") as GenerationMode

    if (!requestId) {
      return NextResponse.json(
        { error: "Request ID is required" },
        { status: 400 }
      )
    }

    const result = await getVideoStatus(requestId, model, mode)

    return NextResponse.json({
      status: result.status,
      progress: result.progress || 50,
      videoUrl: result.videoUrl,
    })
  } catch (error) {
    console.error("Video status error:", error)
    return NextResponse.json(
      { error: "Failed to check video status" },
      { status: 500 }
    )
  }
}
