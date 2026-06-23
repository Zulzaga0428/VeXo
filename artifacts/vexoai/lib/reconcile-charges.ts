import { createAdminClient } from "@/lib/supabase/admin"
import {
  getVideoStatus,
  getAvatarVideoStatus,
  type VexoModel,
  type GenerationMode,
} from "@/lib/fal-video"
import { refundCharge, settleCharge } from "@/lib/credits"

export interface ReconcileResult {
  scanned: number
  refunded: number
  settled: number
  stillRunning: number
  alreadyResolved: number
  errors: number
  refundedCredits: number
}

interface ChargeRow {
  request_id: string
  kind: string | null
  model: string | null
  mode: string | null
}

/**
 * Sweep stale `pending` rows in `generation_charges` and resolve them against
 * FAL, so a job whose owner stopped polling (closed the tab, lost connection)
 * still gets refunded on terminal failure or settled on success.
 *
 * Designed to run without a user present (scheduled cron or admin trigger). It
 * uses the service-role admin client, is best-effort per row, and degrades
 * gracefully if the table/RPCs are missing (returns zeros, logs, never throws).
 *
 * Only acts on definitive FAL signals: "failed" -> refund, "succeed" -> settle.
 * Jobs still reported as "processing" (including transient FAL errors, which
 * `getVideoStatus`/`getAvatarVideoStatus` report as "processing") are left
 * pending for a later sweep — we never speculatively refund.
 */
export async function reconcilePendingCharges(opts?: {
  olderThanMinutes?: number
  limit?: number
}): Promise<ReconcileResult> {
  const olderThanMinutes = clamp(opts?.olderThanMinutes ?? 30, 1, 1440)
  const limit = clamp(opts?.limit ?? 100, 1, 500)
  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000).toISOString()

  const result: ReconcileResult = {
    scanned: 0,
    refunded: 0,
    settled: 0,
    stillRunning: 0,
    alreadyResolved: 0,
    errors: 0,
    refundedCredits: 0,
  }

  let rows: ChargeRow[] = []
  try {
    const admin = createAdminClient()
    // select("*") (not explicit columns) so a DB still missing model/mode does
    // not 400 the whole query.
    const { data, error } = await admin
      .from("generation_charges")
      .select("*")
      .eq("status", "pending")
      .lt("created_at", cutoff)
      .order("created_at", { ascending: true })
      .limit(limit)
    if (error) {
      console.error("[reconcile] query failed:", error.message)
      return result
    }
    rows = (data ?? []) as ChargeRow[]
  } catch (e) {
    console.error("[reconcile] query error:", e)
    return result
  }

  for (const row of rows) {
    result.scanned++
    try {
      let status: string
      if (row.kind === "avatar") {
        ;({ status } = await getAvatarVideoStatus(row.request_id))
      } else {
        const model = (row.model as VexoModel) || "standard"
        const mode = (row.mode as GenerationMode) || "image"
        ;({ status } = await getVideoStatus(row.request_id, model, mode))
      }

      if (status === "failed") {
        const credits = await refundCharge(row.request_id)
        if (credits > 0) {
          result.refunded++
          result.refundedCredits += credits
        } else {
          // RPC no-op: a concurrent poll already resolved this row.
          result.alreadyResolved++
        }
      } else if (status === "succeed") {
        const settled = await settleCharge(row.request_id)
        if (settled > 0) result.settled++
        else result.alreadyResolved++
      } else {
        result.stillRunning++
      }
    } catch (e) {
      result.errors++
      console.error(`[reconcile] row ${row.request_id} error:`, e)
    }
  }

  return result
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min
  return Math.min(Math.max(Math.round(n), min), max)
}
