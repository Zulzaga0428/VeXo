import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getPublicUrl } from "@/lib/storage"

// Serve user video — verify ownership then redirect to public Supabase URL
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const pathname = request.nextUrl.searchParams.get("pathname")
    if (!pathname) return NextResponse.json({ error: "Missing pathname" }, { status: 400 })

    // Verify the video belongs to this user
    const { data: video } = await supabase
      .from("videos")
      .select("id, video_url")
      .eq("user_id", user.id)
      .or(`video_url.eq.${pathname},id.eq.${pathname}`)
      .single()

    if (!video) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const url = getPublicUrl(video.video_url)
    return NextResponse.redirect(url)
  } catch (error) {
    console.error("Error serving video:", error)
    return NextResponse.json({ error: "Failed to serve video" }, { status: 500 })
  }
}
