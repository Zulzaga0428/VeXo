import { type NextRequest, NextResponse } from "next/server"
import { get } from "@vercel/blob"
import { createClient } from "@/lib/supabase/server"

// Public proxy that streams gallery media. The blob store is private, so we
// cannot expose public blob URLs directly. Gallery posts are public content,
// so anyone (logged in or not) may view media for a published post.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: post } = await supabase
      .from("gallery_posts")
      .select("media_url")
      .eq("id", id)
      .single()

    if (!post?.media_url) {
      return new NextResponse("Not found", { status: 404 })
    }

    const src: string = post.media_url

    // Externally hosted media (e.g. legacy public URLs) — just redirect.
    if (/^https?:\/\//i.test(src)) {
      return NextResponse.redirect(src)
    }

    // Otherwise it's a private blob pathname — stream it through.
    const result = await get(src, { access: "private" })
    if (!result) return new NextResponse("Not found", { status: 404 })

    return new NextResponse(result.stream, {
      headers: {
        "Content-Type": result.blob.contentType || "application/octet-stream",
        "Cache-Control": "public, max-age=86400",
      },
    })
  } catch (error) {
    console.error("Error serving gallery media:", error)
    return new NextResponse("Failed to serve media", { status: 500 })
  }
}
