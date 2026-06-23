// Next.js runs `register()` once per server process at boot. We use it to start
// the in-process reconciliation sweep so abandoned generation jobs (video,
// avatar, lip-sync) get refunded/settled on a schedule with no user polling.
export async function register() {
  // Only run in the Node.js server runtime (not edge, not the browser).
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  const { startReconcileScheduler } = await import("@/lib/reconcile-scheduler")
  startReconcileScheduler()
}
