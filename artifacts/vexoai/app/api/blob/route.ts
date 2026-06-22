import { type NextRequest, NextResponse } from "next/server"
import { get } from "@vercel/blob"

// Public proxy for PRIVATE blob files. The store is private, so raw blob URLs
// are not publicly reachable. Admin-curated media (showcase, voice previews,
// free prompts, landing media) is public-facing content, so anyone may read
// it through this proxy. We only stream files under known public folders to
// avoid exposing arbitrary private blobs.
const PUBLIC_PREFIXES = ["showcase/", "voice-previews/", "prompt-library/", "landing-media/"]

export async function GET(request: NextRequest) {
  try {
    const path = request.nextUrl.searchParams.get("path")
    if (!path) {
      return NextResponse.json({ error: "Missing path" }, { status: 400 })
    }

    // Legacy/external absolute URLs — just redirect.
    if (/^https?:\/\//i.test(path)) {
      return NextResponse.redirect(path)
    }

    if (!PUBLIC_PREFIXES.some((p) => path.startsWith(p))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const result = await get(path, {
      access: "private",
      ifNoneMatch: request.headers.get("if-none-match") ?? undefined,
    })

    if (!result) {
      return new NextResponse("Not found", { status: 404 })
    }

    if (result.statusCode === 304) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: result.blob.etag,
          "Cache-Control": "public, max-age=3600",
        },
      })
    }

    return new NextResponse(result.stream, {
      headers: {
        "Content-Type": result.blob.contentType || "application/octet-stream",
        ETag: result.blob.etag,
        "Cache-Control": "public, max-age=3600",
      },
    })
  } catch (error) {
    console.error("blob proxy error:", error)
    return new NextResponse("Failed to serve file", { status: 500 })
  }
}

export const runtime = "nodejs"
