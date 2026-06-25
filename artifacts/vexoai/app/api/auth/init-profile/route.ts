import { NextResponse } from "next/server"
import { logger, toErrStr } from "@/lib/logger"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

// Free starter credits every new user receives on first sign-up.
const STARTER_CREDITS = 20

export async function POST() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    // Check if profile already exists (may have been auto-created by a DB trigger)
    const { data: existing } = await admin
      .from("profiles")
      .select("id, credits")
      .eq("id", user.id)
      .single()

    if (existing) {
      // Profile exists but credits are below starter amount — top up.
      // This handles the case where a Supabase trigger creates the row with
      // a lower default (e.g. 0 or 7) before our init-profile call arrives.
      if ((existing.credits ?? 0) < STARTER_CREDITS) {
        await admin
          .from("profiles")
          .update({ credits: STARTER_CREDITS })
          .eq("id", user.id)
        return NextResponse.json({ topped_up: true, credits: STARTER_CREDITS })
      }
      return NextResponse.json({ alreadyExists: true, credits: existing.credits })
    }

    // Profile doesn't exist yet — create it fresh with starter credits.
    const emailBase = user.email?.split("@")[0] ?? ""
    const safeBase = emailBase.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 16)
    const suffix = user.id.replace(/-/g, "").slice(0, 6)
    const username = safeBase ? `${safeBase}_${suffix}` : `user_${suffix}`

    const displayName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      emailBase ||
      "VexoAI User"

    const { error } = await admin.from("profiles").insert({
      id: user.id,
      username,
      display_name: displayName,
      credits: STARTER_CREDITS,
      plan: "free",
    })

    if (error) {
      if (error.code === "23505") {
        const longerSuffix = user.id.replace(/-/g, "").slice(0, 12)
        const username2 = `user_${longerSuffix}`
        const { error: err2 } = await admin.from("profiles").insert({
          id: user.id,
          username: username2,
          display_name: displayName,
          credits: STARTER_CREDITS,
          plan: "free",
        })
        if (err2) return NextResponse.json({ error: err2.message }, { status: 500 })
        return NextResponse.json({ created: true, credits: STARTER_CREDITS, username: username2 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ created: true, credits: STARTER_CREDITS, username })
  } catch (err) {
    logger.error("[init-profile]", { err: toErrStr(err) })
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
