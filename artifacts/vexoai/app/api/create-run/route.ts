import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { clearRunState, loadRunState, saveRunState } from "@/lib/create-run-store"
import { isPersistedRun } from "@/lib/create-run"

// Per-user snapshot of an in-progress Create run, so a refresh/closed tab can be
// recovered. Stored in a private bucket and accessed only through this
// authenticated route — never publicly readable.
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const run = await loadRunState(user.id)
    return NextResponse.json({ run: run && isPersistedRun(run) ? run : null })
  } catch {
    return NextResponse.json({ error: "Failed to load run" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const body = await request.json().catch(() => null)
    const run = body?.run
    if (!isPersistedRun(run)) {
      return NextResponse.json({ error: "Invalid run payload" }, { status: 400 })
    }
    await saveRunState(user.id, run)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Failed to save run" }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    await clearRunState(user.id)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Failed to clear run" }, { status: 500 })
  }
}
