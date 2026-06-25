import { NextRequest, NextResponse } from "next/server"
import { logger, toErrStr } from "@/lib/logger"
import { timingSafeEqual } from "crypto"
import { createClient } from "@/lib/supabase/server"
import { isAdminEmail } from "@/lib/supabase/admin"
import { reconcilePendingCharges } from "@/lib/reconcile-charges"

export const dynamic = "force-dynamic"

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

// Authorize either an automated scheduler (Bearer/?key= CRON_SECRET) or an
// on-demand admin trigger (logged-in admin via cookie session).
async function authorize(request: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get("authorization") || ""
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : ""
    const key = request.nextUrl.searchParams.get("key") || ""
    if (bearer && safeEqual(bearer, secret)) return true
    if (key && safeEqual(key, secret)) return true
  }
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user && isAdminEmail(user.email)) return true
  } catch {
    // fall through to unauthorized
  }
  return false
}

async function run(request: NextRequest) {
  if (!(await authorize(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const olderThanMinutes =
    Number(request.nextUrl.searchParams.get("olderThanMinutes")) || undefined
  const limit = Number(request.nextUrl.searchParams.get("limit")) || undefined

  const summary = await reconcilePendingCharges({ olderThanMinutes, limit })
  logger.info("[reconcile] summary:", { err: toErrStr(summary) })
  return NextResponse.json({ ok: true, ...summary })
}

// GET and POST both supported so any scheduler (cron pinger, Railway scheduled
// job, manual admin fetch) can trigger the sweep.
export async function GET(request: NextRequest) {
  return run(request)
}

export async function POST(request: NextRequest) {
  return run(request)
}
