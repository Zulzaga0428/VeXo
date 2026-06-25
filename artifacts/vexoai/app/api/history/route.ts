import { NextResponse } from "next/server"
import { logger, toErrStr } from "@/lib/logger"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: videos, error } = await supabase
      .from("videos")
      .select("*")
      .eq("user_id", user.id)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ videos: videos || [] })
  } catch (error) {
    logger.error("History error:", { err: toErrStr(error) })
    return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 })
  }
}
