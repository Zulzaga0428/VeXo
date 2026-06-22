import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getPublicUrl } from "@/lib/storage"

// Gallery media — redirect to public Supabase Storage URL
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: post } = await supabase
      .from("gallery_posts")
      .select("media_url")
      .eq("id", id)
      .single()

    if (!post?.media_url) return new NextResponse("Not found", { status: 404 })

    const url = getPublicUrl(post.media_url)
    return NextResponse.redirect(url)
  } catch (error) {
    console.error("Error serving gallery media:", error)
    return new NextResponse("Failed to serve media", { status: 500 })
  }
}
