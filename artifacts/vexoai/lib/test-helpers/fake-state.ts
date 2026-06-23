// In-memory test doubles for the durable-credit boundary.
//
// The fake faithfully mirrors the SECURITY DEFINER RPC semantics in
// supabase/migrations/0001_generation_charges.sql so the lip-sync route +
// credits orchestration is exercised against the SAME exactly-once /
// single-owner guarantees the real Postgres functions provide.
//
// Atomicity model: every RPC body below is fully SYNCHRONOUS (no await), which
// mirrors Postgres statement/row-lock atomicity — concurrent JS callers can
// interleave only at `await` points in the code under test, never in the middle
// of an RPC. That is what lets the concurrency tests prove "no double refund".

export type ChargeStatus = "pending" | "settled" | "refunded"

export interface ChargeRow {
  request_id: string
  user_id: string
  cost: number
  kind: string
  model: string | null
  mode: string | null
  status: ChargeStatus
}

export interface RpcResult {
  data: unknown
  error: { message: string } | null
}

interface FalState {
  submitIds: string[]
  submitCounter: number
  statusById: Map<string, string>
  resultById: Map<string, { videoUrl?: string }>
}

interface FakeState {
  credits: Map<string, number>
  charges: Map<string, ChargeRow>
  user: { id: string } | null
  failUpsert: boolean
  failCompensateRpc: boolean
  fal: FalState
}

export const state: FakeState = {
  credits: new Map(),
  charges: new Map(),
  user: null,
  failUpsert: false,
  failCompensateRpc: false,
  fal: { submitIds: [], submitCounter: 0, statusById: new Map(), resultById: new Map() },
}

export function resetState(opts?: { user?: { id: string } | null; credits?: Record<string, number> }): void {
  state.credits = new Map()
  state.charges = new Map()
  state.user = opts?.user !== undefined ? opts.user : { id: "u1" }
  state.failUpsert = false
  state.failCompensateRpc = false
  state.fal = { submitIds: [], submitCounter: 0, statusById: new Map(), resultById: new Map() }
  const credits = opts?.credits ?? { u1: 0 }
  for (const [userId, amount] of Object.entries(credits)) state.credits.set(userId, amount)
}

export function setUser(user: { id: string } | null): void {
  state.user = user
}

export function setCredits(userId: string, amount: number): void {
  state.credits.set(userId, amount)
}

export function getCredits(userId: string): number {
  return state.credits.get(userId) ?? 0
}

export function seedCharge(row: {
  request_id: string
  user_id: string
  cost: number
  kind?: string
  model?: string | null
  mode?: string | null
  status?: ChargeStatus
}): void {
  state.charges.set(row.request_id, {
    request_id: row.request_id,
    user_id: row.user_id,
    cost: row.cost,
    kind: row.kind ?? "lipsync",
    model: row.model ?? null,
    mode: row.mode ?? null,
    status: row.status ?? "pending",
  })
}

export function getChargeRow(requestId: string): ChargeRow | undefined {
  return state.charges.get(requestId)
}

export function setFailUpsert(value: boolean): void {
  state.failUpsert = value
}

export function setFailCompensateRpc(value: boolean): void {
  state.failCompensateRpc = value
}

// Pre-queue the requestId(s) FAL "queue.submit" should hand back, in order.
export function queueSubmitId(id: string): void {
  state.fal.submitIds.push(id)
}

export function setFalStatus(requestId: string, status: string): void {
  state.fal.statusById.set(requestId, status)
}

export function setFalResult(requestId: string, result: { videoUrl?: string }): void {
  state.fal.resultById.set(requestId, result)
}

// ── Faithful in-memory mirror of migration 0001's RPCs ──────────────────────
export function callRpc(fn: string, args: Record<string, unknown>): RpcResult {
  switch (fn) {
    // deduct_credits: atomic spend. Returns remaining, or -1 if insufficient.
    case "deduct_credits": {
      const userId = args.p_user_id as string
      const amount = args.p_amount as number
      const balance = state.credits.get(userId) ?? 0
      if (balance < amount) return { data: -1, error: null }
      const remaining = balance - amount
      state.credits.set(userId, remaining)
      return { data: remaining, error: null }
    }
    // credit_user: positive-only atomic credit. NULL if no profile / bad amount.
    case "credit_user": {
      const userId = args.p_user_id as string
      const amount = args.p_amount as number
      if (amount == null || amount <= 0) return { data: null, error: null }
      if (!state.credits.has(userId)) return { data: null, error: null }
      const balance = (state.credits.get(userId) ?? 0) + amount
      state.credits.set(userId, balance)
      return { data: balance, error: null }
    }
    // refund_generation_charge: pending -> refunded + credit, exactly once.
    case "refund_generation_charge": {
      const row = state.charges.get(args.p_request_id as string)
      if (!row || row.status !== "pending") return { data: 0, error: null }
      row.status = "refunded"
      state.credits.set(row.user_id, (state.credits.get(row.user_id) ?? 0) + row.cost)
      return { data: row.cost, error: null }
    }
    // settle_generation_charge: pending -> settled (so it can never be refunded).
    case "settle_generation_charge": {
      const row = state.charges.get(args.p_request_id as string)
      if (!row || row.status !== "pending") return { data: 0, error: null }
      row.status = "settled"
      return { data: 1, error: null }
    }
    // transfer_generation_charge: settle old (must be pending) + insert pending
    // successor in one atomic unit, gated on old-pending and successor-absent.
    // Exactly one concurrent caller wins; the rest get 0.
    case "transfer_generation_charge": {
      const oldRow = state.charges.get(args.p_old_request_id as string)
      if (!oldRow || oldRow.status !== "pending") return { data: 0, error: null }
      const newId = args.p_new_request_id as string
      if (state.charges.has(newId)) return { data: 0, error: null }
      state.charges.set(newId, {
        request_id: newId,
        user_id: oldRow.user_id,
        cost: oldRow.cost,
        kind: oldRow.kind || "lipsync",
        model: args.p_new_model as string,
        mode: null,
        status: "pending",
      })
      oldRow.status = "settled"
      return { data: 1, error: null }
    }
    // compensate_unrecorded_charge: ON CONFLICT DO NOTHING insert of a refunded
    // row + credit. Returns 0 (no credit) if a row already exists.
    case "compensate_unrecorded_charge": {
      if (state.failCompensateRpc) {
        return { data: null, error: { message: "compensate unavailable (simulated)" } }
      }
      const id = args.p_request_id as string
      if (state.charges.has(id)) return { data: 0, error: null }
      const userId = args.p_user_id as string
      const cost = args.p_cost as number
      state.charges.set(id, {
        request_id: id,
        user_id: userId,
        cost,
        kind: (args.p_kind as string) || "video",
        model: null,
        mode: null,
        status: "refunded",
      })
      state.credits.set(userId, (state.credits.get(userId) ?? 0) + cost)
      return { data: cost, error: null }
    }
    default:
      return { data: null, error: { message: `unknown rpc ${fn}` } }
  }
}
