import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

// Free starter credits every new user receives on first sign-up.
// 2 standard videos (10 credits each) so they can try the product immediately.
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

    // Check if profile already exists
    const { data: existing } = await supabase
      .from("profiles")
      .select("id, credits")
      .eq("id", user.id)
      .single()

    if (existing) {
      // Already set up — return current state (idempotent)
      return NextResponse.json({ alreadyExists: true, credits: existing.credits })
    }

    // Build a unique username from email or user id
    const emailBase = user.email?.split("@")[0] ?? ""
    const safeBase = emailBase.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 16)
    const suffix = user.id.replace(/-/g, "").slice(0, 6)
    const username = safeBase ? `${safeBase}_${suffix}` : `user_${suffix}`

    const displayName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      emailBase ||
      "VexoAI User"

    // Use service role to bypass RLS for profile creation
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const { error } = await admin.from("profiles").insert({
      id: user.id,
      username,
      display_name: displayName,
      credits: STARTER_CREDITS,
      plan: "free",
    })

    if (error) {
      // Username collision — retry with longer suffix
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
        if (err2) {
          return NextResponse.json({ error: err2.message }, { status: 500 })
        }
        return NextResponse.json({ created: true, credits: STARTER_CREDITS, username: username2 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ created: true, credits: STARTER_CREDITS, username })
  } catch (err) {
    console.error("[init-profile]", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
