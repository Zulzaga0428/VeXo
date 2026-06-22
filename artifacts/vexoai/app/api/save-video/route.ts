import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { uploadFile } from "@/lib/storage"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { videoUrl, prompt, voice, seriesCount, sceneIndex } = await request.json()

    if (!videoUrl) {
      return NextResponse.json({ error: "No video URL provided" }, { status: 400 })
    }

    let parsed: URL
    try {
      parsed = new URL(videoUrl)
    } catch {
      return NextResponse.json({ error: "Invalid video URL" }, { status: 400 })
    }
    if (parsed.protocol !== "https:") {
      return NextResponse.json({ error: "Only https URLs allowed" }, { status: 400 })
    }

    // Download the generated video and upload to Vercel Blob
    const videoResponse = await fetch(videoUrl)
    if (!videoResponse.ok) {
      return NextResponse.json({ error: "Failed to fetch video" }, { status: 400 })
    }
    const contentType = videoResponse.headers.get("content-type") || ""
    if (!contentType.startsWith("video/")) {
      return NextResponse.json({ error: "URL is not a video" }, { status: 400 })
    }
    const contentLength = Number(videoResponse.headers.get("content-length") || 0)
    if (contentLength > 200 * 1024 * 1024) {
      return NextResponse.json({ error: "Video too large (max 200MB)" }, { status: 400 })
    }
    const videoBuffer = await videoResponse.blob()

    const filename = `videos/${user.id}/${Date.now()}-scene${sceneIndex}.mp4`
    const publicUrl = await uploadFile(filename, videoBuffer, "video/mp4")

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    const { data, error } = await supabase
      .from("videos")
      .insert({
        user_id: user.id,
        prompt,
        voice: voice || "professional",
        video_url: publicUrl,
        status: "completed",
        series_count: seriesCount || 1,
        scene_index: sceneIndex || 0,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ video: data, pathname: publicUrl })
  } catch (error) {
    console.error("Save video error:", error)
    return NextResponse.json({ error: "Failed to save video" }, { status: 500 })
  }
}
