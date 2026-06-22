import { NextResponse } from "next/server"
import { get, put } from "@vercel/blob"
import { createClient } from "@/lib/supabase/server"

export const maxDuration = 60

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { videoId, title, description } = body as {
    videoId?: string
    title?: string
    description?: string
  }
  if (!videoId) return NextResponse.json({ error: "videoId required" }, { status: 400 })

  // Fetch the user's video to get its stored pathname + verify ownership
  const { data: video, error: vErr } = await supabase
    .from("videos")
    .select("id, video_url, prompt, user_id")
    .eq("id", videoId)
    .single()

  if (vErr || !video) return NextResponse.json({ error: "video not found" }, { status: 404 })
  if (video.user_id !== user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 })
  if (!video.video_url) return NextResponse.json({ error: "video has no media" }, { status: 400 })

  // The source video lives in a PRIVATE blob (per-user history). For the public
  // gallery we re-host a PUBLIC copy so it can be served straight from the CDN
  // (no per-view serverless proxy => near-zero load/cost at scale).
  let mediaRef: string
  try {
    // Read the private blob, then stream its bytes into a new PUBLIC blob.
    const src = await get(video.video_url, { access: "private" })
    if (!src || src.statusCode !== 200 || !src.stream) throw new Error("source blob not found")

    const publicName = `gallery/${user.id}/${Date.now()}.mp4`
    const publicBlob = await put(publicName, src.stream, {
      access: "public",
      contentType: src.blob.contentType || "video/mp4",
    })
    mediaRef = publicBlob.url // full public CDN URL
  } catch (e) {
    console.error("[v0] gallery public re-host failed:", e)
    // Fallback: keep the private pathname (served via /api/gallery/media/[id]).
    mediaRef = video.video_url
  }

  // Check if already shared
  const { data: existing } = await supabase
    .from("gallery_posts")
    .select("id")
    .eq("user_id", user.id)
    .eq("media_url", mediaRef)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ ok: true, postId: existing.id, alreadyShared: true })
  }

  const { data: post, error: insErr } = await supabase
    .from("gallery_posts")
    .insert({
      user_id: user.id,
      title: (title || "").slice(0, 200) || (video.prompt || "").slice(0, 80),
      description: (description || "").slice(0, 1000),
      media_url: mediaRef,
      media_type: "video",
    })
    .select("id")
    .single()

  if (insErr || !post) {
    return NextResponse.json({ error: insErr?.message || "insert failed" }, { status: 500 })
  }

  return NextResponse.json({ ok: true, postId: post.id })
}
