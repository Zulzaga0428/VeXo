import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// Cost per action in credits — single source of truth lives in the client-safe
// module so the UI estimate and the server charge can never drift apart.
export { CREDIT_COST } from "@/lib/credit-costs"

type Result =
  | { ok: true; userId: string; remaining: number }
  | { ok: false; status: number; error: string }

// Verify auth, then deduct credits ATOMICALLY (deduct-first)
export async function chargeCredits(cost: number): Promise<Result> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, status: 401, error: "Unauthorized" }

  const { data, error } = await supabase.rpc("deduct_credits", {
    p_user_id: user.id,
    p_amount: cost,
  })
  if (error) return { ok: false, status: 500, error: "Credit error" }
  if (data === -1 || data === null) {
    return { ok: false, status: 402, error: "Кредит хүрэлцэхгүй байна" }
  }
  return { ok: true, userId: user.id, remaining: data as number }
}

// Free AI chat is rate-limited per user per day to prevent abuse.
export const DAILY_CHAT_LIMIT = 30

type ChatLimitResult =
  | { ok: true; userId: string; used: number; remaining: number }
  | { ok: false; status: number; error: string }

// Verify auth, then atomically count one chat message against the daily cap.
export async function bumpChatUsage(): Promise<ChatLimitResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, status: 401, error: "Unauthorized" }

  const { data, error } = await supabase.rpc("bump_chat_usage", {
    p_user_id: user.id,
    p_limit: DAILY_CHAT_LIMIT,
  })
  if (error) return { ok: false, status: 500, error: "Chat usage error" }
  if (data === -1 || data === null) {
    return { ok: false, status: 429, error: "daily_chat_limit" }
  }
  const used = data as number
  return { ok: true, userId: user.id, used, remaining: Math.max(0, DAILY_CHAT_LIMIT - used) }
}

// Refund credits if generation fails after charging
export async function refundCredits(userId: string, cost: number) {
  const supabase = await createClient()
  const { data: profile } = await supabase.from("profiles").select("credits").eq("id", userId).single()
  await supabase
    .from("profiles")
    .update({ credits: (profile?.credits || 0) + cost })
    .eq("id", userId)
}

export type ChargeKind = "video" | "avatar"

// ── Async-job refund tracking ───────────────────────────────────────────────
// Credits are deducted at SUBMISSION, but a FAL job can still fail/time out
// while the client polls the status routes. We record each charge keyed by the
// FAL requestId so the status route can refund it exactly once on terminal
// failure (and mark it settled on success). Requires the `generation_charges`
// table + RPCs from supabase/migrations/0001_generation_charges.sql. All three
// helpers are best-effort: a missing table or transient error is logged and
// never breaks the request/poll path.

// Record a charge against an async job's requestId so it can be refunded later.
// `meta.model`/`meta.mode` (b_roll only) let the reconciliation sweep re-check
// the job on the correct FAL endpoint when the user stopped polling.
export async function recordCharge(
  requestId: string,
  userId: string,
  cost: number,
  kind: ChargeKind,
  meta?: { model?: string; mode?: string },
) {
  try {
    const admin = createAdminClient()
    const row: Record<string, unknown> = {
      request_id: requestId,
      user_id: userId,
      cost,
      kind,
    }
    if (meta?.model) row.model = meta.model
    if (meta?.mode) row.mode = meta.mode

    let { error } = await admin.from("generation_charges").insert(row)
    // Tolerate a DB still on the pre-reconciliation schema (no model/mode
    // columns) — retry without them so the charge is still recorded/refundable.
    if (error && (row.model || row.mode) && /column/i.test(error.message)) {
      delete row.model
      delete row.mode
      ;({ error } = await admin.from("generation_charges").insert(row))
    }
    if (error) console.error("[credits] recordCharge failed:", error.message)
  } catch (e) {
    console.error("[credits] recordCharge error:", e)
  }
}

// Refund a previously-recorded charge exactly once (idempotent server-side).
// Returns the number of credits refunded (0 if nothing was pending).
export async function refundCharge(requestId: string): Promise<number> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc("refund_generation_charge", {
      p_request_id: requestId,
    })
    if (error) {
      console.error("[credits] refundCharge rpc error:", error.message)
      return 0
    }
    return (data as number) ?? 0
  } catch (e) {
    console.error("[credits] refundCharge error:", e)
    return 0
  }
}

// Mark a charge settled once its job succeeds so it can never be refunded later.
// Returns the number of rows actually settled (0 if already resolved). Note: a
// DB still on the pre-reconciliation schema returns void -> data is null -> 0,
// which is harmless (the update still runs; only the count is under-reported).
export async function settleCharge(requestId: string): Promise<number> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc("settle_generation_charge", {
      p_request_id: requestId,
    })
    if (error) {
      console.error("[credits] settleCharge rpc error:", error.message)
      return 0
    }
    return (data as number) ?? 0
  } catch (e) {
    console.error("[credits] settleCharge error:", e)
    return 0
  }
}
