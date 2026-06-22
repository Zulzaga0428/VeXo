import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const url = new URL(req.url)
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "24"), 50)
  const cursor = url.searchParams.get("cursor")

  let query = supabase
    .from("gallery_posts")
    .select("id,user_id,title,description,media_url,media_type,thumbnail_url,likes_count,comments_count,created_at")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (cursor) query = query.lt("created_at", cursor)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // get author display info (no email exposure)
  const userIds = Array.from(new Set((data ?? []).map((p) => p.user_id)))
  let users: Record<string, { display_name: string | null; username: string | null; avatar_url: string | null }> = {}
  if (userIds.length) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id,display_name,username,avatar_url")
      .in("id", userIds)
    if (profs) {
      for (const p of profs) {
        users[(p as any).id] = {
          display_name: (p as any).display_name ?? null,
          username: (p as any).username ?? null,
          avatar_url: (p as any).avatar_url ?? null,
        }
      }
    }
  }

  // get current user's likes for these posts
  const {
    data: { user },
  } = await supabase.auth.getUser()
  let likedSet = new Set<string>()
  if (user && data?.length) {
    const { data: likes } = await supabase
      .from("gallery_likes")
      .select("post_id")
      .eq("user_id", user.id)
      .in(
        "post_id",
        data.map((p) => p.id),
      )
    if (likes) for (const l of likes) likedSet.add(l.post_id as string)
  }

  return NextResponse.json({
    items: (data ?? []).map((p) => {
      // New posts store a full public CDN URL (served directly, no proxy load).
      // Legacy posts store a private blob pathname => use the proxy route.
      const isPublicUrl = typeof p.media_url === "string" && p.media_url.startsWith("http")
      const served = isPublicUrl ? p.media_url : `/api/gallery/media/${p.id}`
      return {
        ...p,
        media_url: served,
        thumbnail_url: p.media_type === "image" ? served : p.thumbnail_url,
        author: users[p.user_id] ?? { display_name: null, username: null, avatar_url: null },
        liked_by_me: likedSet.has(p.id),
      }
    }),
    nextCursor: data && data.length === limit ? data[data.length - 1].created_at : null,
    currentUserId: user?.id ?? null,
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body?.media_url) return NextResponse.json({ error: "media_url required" }, { status: 400 })

  const { data, error } = await supabase
    .from("gallery_posts")
    .insert({
      user_id: user.id,
      title: (body.title ?? "").toString().slice(0, 200),
      description: (body.description ?? "").toString().slice(0, 2000),
      media_url: body.media_url,
      media_type: body.media_type === "video" ? "video" : "image",
      thumbnail_url: body.thumbnail_url ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const isPublicUrl = typeof data.media_url === "string" && data.media_url.startsWith("http")
  const served = isPublicUrl ? data.media_url : `/api/gallery/media/${data.id}`
  return NextResponse.json({
    item: {
      ...data,
      media_url: served,
      thumbnail_url: data.media_type === "image" ? served : data.thumbnail_url,
    },
  })
}
