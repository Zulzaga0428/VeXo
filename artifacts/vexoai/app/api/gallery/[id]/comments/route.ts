import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("gallery_comments")
    .select("id,user_id,content,created_at")
    .eq("post_id", id)
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const userIds = Array.from(new Set((data ?? []).map((c) => c.user_id)))
  const authors: Record<string, { display_name: string | null; username: string | null; avatar_url: string | null }> = {}
  if (userIds.length) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id,display_name,username,avatar_url")
      .in("id", userIds)
    if (profs) {
      for (const p of profs) {
        authors[(p as any).id] = {
          display_name: (p as any).display_name ?? null,
          username: (p as any).username ?? null,
          avatar_url: (p as any).avatar_url ?? null,
        }
      }
    }
  }

  return NextResponse.json({
    items: (data ?? []).map((c) => ({
      ...c,
      author: authors[c.user_id] ?? { display_name: null, username: null, avatar_url: null },
    })),
  })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const content = (body?.content ?? "").toString().trim().slice(0, 1000)
  if (!content) return NextResponse.json({ error: "empty" }, { status: 400 })

  const { data, error } = await supabase
    .from("gallery_comments")
    .insert({ post_id: id, user_id: user.id, content })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // fetch current user's display info
  const { data: prof } = await supabase
    .from("profiles")
    .select("display_name,username,avatar_url")
    .eq("id", user.id)
    .single()

  return NextResponse.json({
    item: {
      ...data,
      author: {
        display_name: prof?.display_name ?? null,
        username: prof?.username ?? null,
        avatar_url: prof?.avatar_url ?? null,
      },
    },
  })
}
