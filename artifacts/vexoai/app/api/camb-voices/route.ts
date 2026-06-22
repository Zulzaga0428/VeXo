import { NextResponse } from "next/server"
import { cambListVoices, isCambConfigured } from "@/lib/cambai"

// camb.ai voices are shared studio voices (owner account). Keep the cache
// short so newly cloned VEXO voices show up almost immediately.
export const revalidate = 20

// camb language id -> our short code.
function shortLang(id: number): string {
  if (id === 100) return "mn"
  if (id === 1) return "en"
  return "other"
}

export async function GET() {
  if (!isCambConfigured()) {
    return NextResponse.json({ voices: [] })
  }
  try {
    const all = await cambListVoices()
    // Only surface the owner's own voices (cloned / VEXO folder). camb's public
    // catalog returns thousands of voices; ours are the Mongolian ones (id 100).
    const voices = all
      .filter((v) => v.language === 100 || shortLang(v.language) === "mn")
      .map((v) => ({
        id: v.id,
        name: v.name,
        // camb: 0 = unknown, 1 = male, 2 = female.
        gender: v.gender === 1 ? "male" : v.gender === 2 ? "female" : "unknown",
        language: shortLang(v.language),
        description: v.description,
      }))
      // Stable order (by id) so the list never appears to "shuffle" between loads.
      .sort((a, b) => a.id - b.id)
    return NextResponse.json({ voices })
  } catch (err) {
    console.error("[v0] camb-voices error:", err instanceof Error ? err.message : err)
    return NextResponse.json({ voices: [] })
  }
}
