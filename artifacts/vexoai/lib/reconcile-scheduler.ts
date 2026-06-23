let started = false
let running = false

export function parseEnvInt(
  raw: string | undefined,
  fallback: number,
): number {
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : fallback
}

/**
 * Decide whether the in-process sweep should run. Enabled by default in
 * production (where the app runs as a long-lived `next start` process on
 * Railway). `RECONCILE_SWEEP_ENABLED` is an explicit override for either
 * direction so the sweep can be force-enabled in a non-prod check or disabled
 * in production without a code change.
 */
export function isSchedulerEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const flag = env.RECONCILE_SWEEP_ENABLED?.toLowerCase()
  if (flag === "true" || flag === "1") return true
  if (flag === "false" || flag === "0") return false
  return env.NODE_ENV === "production"
}

/**
 * Start the in-process reconciliation sweep on a timer. This is the scheduled
 * trigger that lets abandoned jobs (owner closed the tab, lost connection) get
 * refunded/settled with no user present. The sweep itself is idempotent and
 * keyed by requestId, so it is safe to run on every instance concurrently.
 *
 * Idempotent: calling this more than once is a no-op after the first start.
 */
export function startReconcileScheduler(): void {
  if (started) return

  if (!isSchedulerEnabled()) {
    console.log(
      "[reconcile] scheduler disabled (set RECONCILE_SWEEP_ENABLED=true to enable outside production)",
    )
    return
  }
  started = true

  const intervalMinutes = parseEnvInt(
    process.env.RECONCILE_SWEEP_INTERVAL_MINUTES,
    15,
  )
  const olderThanMinutes = parseEnvInt(
    process.env.RECONCILE_SWEEP_OLDER_THAN_MINUTES,
    30,
  )
  const limit = parseEnvInt(process.env.RECONCILE_SWEEP_LIMIT, 100)

  const tick = async () => {
    // Skip if a previous sweep is still in flight so slow runs never pile up.
    if (running) return
    running = true
    try {
      // Imported lazily so this module's top level stays free of `@/` aliased
      // imports, keeping the pure helpers unit-testable under `node --test`.
      const { reconcilePendingCharges } = await import("@/lib/reconcile-charges")
      const summary = await reconcilePendingCharges({ olderThanMinutes, limit })
      if (summary.scanned > 0 || summary.errors > 0) {
        console.log("[reconcile] scheduled sweep:", summary)
      }
    } catch (e) {
      console.error("[reconcile] scheduled sweep error:", e)
    } finally {
      running = false
    }
  }

  const interval = setInterval(tick, intervalMinutes * 60_000)
  // Don't keep the process alive solely for the sweep.
  if (typeof interval.unref === "function") interval.unref()

  // Kick off a first sweep shortly after boot (delayed so startup isn't blocked).
  const kickoff = setTimeout(tick, 30_000)
  if (typeof kickoff.unref === "function") kickoff.unref()

  console.log(
    `[reconcile] scheduler started: every ${intervalMinutes}m, olderThan=${olderThanMinutes}m, limit=${limit}`,
  )
}
