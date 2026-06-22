import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, username, bio, avatar_url, banner_url, website, location, credits")
    .eq("id", user.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ profile: { ...data, email: user.email } })
}

export async function PATCH(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const allowed: Record<string, any> = {}
  for (const key of ["display_name", "username", "bio", "avatar_url", "banner_url", "website", "location"]) {
    if (key in body) allowed[key] = body[key] === "" ? null : body[key]
  }

  if (allowed.username) {
    const u = String(allowed.username).trim().toLowerCase()
    if (!/^[a-z0-9_]{3,20}$/.test(u)) {
      return NextResponse.json({ error: "Username must be 3-20 chars (a-z, 0-9, _)" }, { status: 400 })
    }
    allowed.username = u
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(allowed)
    .eq("id", user.id)
    .select()
    .single()

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Username already taken" }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ profile: data })
}
