import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(_req: Request, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  const supabase = await createClient()

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, display_name, username, bio, avatar_url, banner_url, website, location, created_at")
    .eq("username", username.toLowerCase())
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { data: posts } = await supabase
    .from("gallery_posts")
    .select("id, title, media_url, media_type, thumbnail_url, likes_count, comments_count, created_at")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(60)

  const totalLikes = (posts || []).reduce((s, p) => s + (p.likes_count || 0), 0)

  // Serve media through the public proxy (private blob store)
  const mappedPosts = (posts || []).map((p) => ({
    ...p,
    media_url: `/api/gallery/media/${p.id}`,
    thumbnail_url: p.media_type === "image" ? `/api/gallery/media/${p.id}` : p.thumbnail_url,
  }))

  return NextResponse.json({
    profile,
    posts: mappedPosts,
    stats: {
      posts: mappedPosts.length,
      likes: totalLikes,
    },
  })
}
