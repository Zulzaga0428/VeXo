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

// Refund credits after a SYNCHRONOUS failure (the action errored right after
// charging — e.g. the FAL submit threw, or validation failed post-charge).
// Unlike the requestId-keyed async refunds there is no poll/sweep here, so this
// is a one-shot credit-back with no double-refund vector — the only risk is a
// lost-update race under concurrency, which the atomic `credit_user` RPC removes.
//
// ATOMIC ONLY, by design: the credit is a single-statement increment via the
// `credit_user` RPC (service-role admin client, so a refund never depends on the
// user's session). We deliberately do NOT fall back to a client-side
// read-modify-write — that is the exact race this task removes and it would let
// a refund be lost while we report success. Returns true ONLY when the credit
// truly applied; on any error or missing profile row it logs a greppable
// REFUND_FAILED (alert on this) and returns false — never silently swallows.
//
// DEPLOY DEPENDENCY: requires `credit_user` from supabase/migrations/
// 0001_generation_charges.sql to be applied in Supabase. Until it is, refunds
// fail loudly (logged) instead of being silently mis-handled.
export async function refundCredits(userId: string, cost: number): Promise<boolean> {
  const admin = createAdminClient()
  try {
    const { data, error } = await admin.rpc("credit_user", {
      p_user_id: userId,
      p_amount: cost,
    })
    if (error) {
      console.error("[credits] REFUND_FAILED rpc error", { userId, cost, error: error.message })
      return false
    }
    if (data === null) {
      // No profile row matched (or non-positive amount) — nothing was credited.
      console.error("[credits] REFUND_FAILED no profile row", { userId, cost })
      return false
    }
    return true
  } catch (e) {
    console.error("[credits] REFUND_FAILED rpc threw", { userId, cost }, e)
    return false
  }
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Record a charge against an async job's requestId so it can be refunded later.
// `meta.model`/`meta.mode` (b_roll only) let the reconciliation sweep re-check
// the job on the correct FAL endpoint when the user stopped polling.
//
// Returns `true` once the charge row is persisted. Returns `false` if it could
// NOT be recorded after retries — the caller MUST then compensate (see
// compensateUnrecordedCharge), otherwise the user is charged for a job that no
// refund path can ever recover (no row to refund).
export async function recordCharge(
  requestId: string,
  userId: string,
  cost: number,
  kind: ChargeKind,
  meta?: { model?: string; mode?: string },
): Promise<boolean> {
  const row: Record<string, unknown> = {
    request_id: requestId,
    user_id: userId,
    cost,
    kind,
  }
  if (meta?.model) row.model = meta.model
  if (meta?.mode) row.mode = meta.mode

  try {
    const admin = createAdminClient()
    // upsert keyed by the request_id PK so a retry (or a duplicate submit) is an
    // idempotent no-op instead of a PK conflict. This is what makes retries and
    // the compensation path safe: a committed-but-lost-response insert becomes a
    // successful no-op on the next attempt rather than a false failure.
    const attempt = () =>
      admin
        .from("generation_charges")
        .upsert(row, { onConflict: "request_id", ignoreDuplicates: true })

    let { error } = await attempt()
    // Tolerate a DB still on the pre-reconciliation schema (no model/mode
    // columns) — retry without them so the charge is still recorded/refundable.
    if (error && (row.model || row.mode) && /column/i.test(error.message)) {
      delete row.model
      delete row.mode
      ;({ error } = await attempt())
    }
    // Retry transient failures a couple of times before giving up.
    for (let i = 0; error && i < 2; i++) {
      await sleep(200 * (i + 1))
      ;({ error } = await attempt())
    }
    if (error) {
      console.error("[credits] recordCharge failed:", error.message)
      return false
    }
    return true
  } catch (e) {
    console.error("[credits] recordCharge error:", e)
    return false
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

// Outcome of compensating a charge that recordCharge could not persist. Callers
// MUST inspect this — a `failed` outcome means the user is still debited with no
// automatic recovery and needs a billing-incident alert.
export type CompensationOutcome =
  // The atomic RPC inserted a refunded row and credited the user.
  | { status: "credited"; credited: number }
  // The RPC found a row already existed (recordCharge actually landed after all);
  // the poll/sweep owns that row, so it WILL be resolved — nothing lost.
  | { status: "already_recorded"; credited: 0 }
  // The RPC was unavailable, but a guarded `pending` row was persisted instead, so
  // the existing poll/sweep will refund on failure (or settle on success).
  | { status: "deferred"; credited: 0 }
  // Nothing could be written — the user is still debited. Raise a billing incident.
  | { status: "failed"; credited: 0 }

// Billing safety net for when a job was submitted (the user is already charged)
// but its charge row could NOT be persisted by recordCharge. Without a row,
// neither the status poll nor the reconciliation sweep can ever refund the
// charge, so the credits would be silently lost. This restores them.
//
// CORRECTNESS INVARIANT: credits are NEVER added outside the `request_id`
// idempotency guard. Every crediting path here resolves through a row keyed by
// request_id (the compensate RPC's ON CONFLICT DO NOTHING insert, or the
// poll/sweep refunding a pending row). We never do a raw `profiles` credit, which
// could double-refund a row that actually landed and is non-atomic under load.
//
// Tiered so a single failure can't lose credits:
//  1. The SECURITY DEFINER `compensate_unrecorded_charge` RPC (atomic, idempotent,
//     double-refund-safe via ON CONFLICT DO NOTHING), retried a few times to ride
//     out transient errors. A clean `0` means a row already exists → the poll/
//     sweep owns it → `already_recorded`, safe.
//  2. If the RPC keeps erroring, fall back to persisting a guarded `pending` row
//     (idempotent recordCharge). This does NOT credit — it hands the charge to the
//     existing poll/sweep, which refund/settle it through the same request_id
//     guard. So even if a row already landed, there is no double credit. Succeeds
//     in the partial-failure case (e.g. the RPC is missing because migration 0001
//     isn't fully applied, but plain table writes still work) → `deferred`.
//  3. If even that write fails, the generation_charges write path is unavailable
//     and nothing can be durably recorded → `failed`, so the caller raises a
//     billing incident for manual recovery. We never claim a refund that didn't
//     happen.
export async function compensateUnrecordedCharge(
  requestId: string,
  userId: string,
  cost: number,
  kind: ChargeKind,
  meta?: { model?: string; mode?: string },
): Promise<CompensationOutcome> {
  const admin = createAdminClient()

  // ── Tier 1: atomic idempotent RPC, with bounded retries on transient error ──
  let lastErr: string | undefined
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { data, error } = await admin.rpc("compensate_unrecorded_charge", {
        p_request_id: requestId,
        p_user_id: userId,
        p_cost: cost,
        p_kind: kind,
      })
      if (!error) {
        const credited = (data as number) ?? 0
        return credited > 0
          ? { status: "credited", credited }
          : { status: "already_recorded", credited: 0 }
      }
      lastErr = error.message
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e)
    }
    await sleep(200 * (attempt + 1))
  }
  console.error("[credits] compensate RPC failed after retries:", lastErr)

  // ── Tier 2: persist a guarded `pending` row so the poll/sweep recovers it ──
  // No credit happens here; recovery flows through the same request_id guard, so
  // this is double-refund-safe even if recordCharge actually landed a row earlier.
  const deferred = await recordCharge(requestId, userId, cost, kind, meta)
  if (deferred) return { status: "deferred", credited: 0 }

  // ── Tier 3: the charges table itself is unwritable — nothing can be recorded ──
  return { status: "failed", credited: 0 }
}
