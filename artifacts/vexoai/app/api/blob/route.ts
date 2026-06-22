import { type NextRequest, NextResponse } from "next/server"
import { getPublicUrl } from "@/lib/storage"

// Legacy proxy — files are now stored in Supabase Storage as public URLs.
// This route handles old paths that may still be referenced in the DB.
export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path")
  if (!path) return NextResponse.json({ error: "Missing path" }, { status: 400 })

  // Already a full URL — redirect directly
  if (/^https?:\/\//i.test(path)) {
    return NextResponse.redirect(path)
  }

  // Construct Supabase Storage public URL from legacy path
  const url = getPublicUrl(path)
  return NextResponse.redirect(url)
}

export const runtime = "nodejs"
