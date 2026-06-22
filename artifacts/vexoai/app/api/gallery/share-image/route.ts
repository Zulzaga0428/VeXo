import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { put } from "@vercel/blob"

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { imageUrl, title, description } = body as {
    imageUrl?: string
    title?: string
    description?: string
  }
  if (!imageUrl) return NextResponse.json({ error: "imageUrl required" }, { status: 400 })

  // FAL image URLs expire, so re-host to our (private) blob store. We store the
  // private pathname and serve it publicly via /api/gallery/media/[id].
  let mediaRef = imageUrl
  try {
    const r = await fetch(imageUrl)
    if (!r.ok) throw new Error("fetch failed")
    const buf = await r.arrayBuffer()
    const ct = r.headers.get("content-type") || "image/png"
    const ext = ct.includes("jpeg") ? "jpg" : ct.includes("webp") ? "webp" : "png"
    const blob = await put(`gallery/${user.id}/${Date.now()}.${ext}`, Buffer.from(buf), {
      access: "private",
      contentType: ct,
      addRandomSuffix: false,
    })
    mediaRef = blob.pathname
  } catch (e) {
    return NextResponse.json({ error: "Failed to save image" }, { status: 500 })
  }

  // Prevent duplicate share of the same image
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
      title: (title || "").slice(0, 200) || "AI Image",
      description: (description || "").slice(0, 1000),
      media_url: mediaRef,
      media_type: "image",
      thumbnail_url: mediaRef,
    })
    .select("id")
    .single()

  if (insErr || !post) {
    return NextResponse.json({ error: insErr?.message || "insert failed" }, { status: 500 })
  }

  return NextResponse.json({ ok: true, postId: post.id })
}
