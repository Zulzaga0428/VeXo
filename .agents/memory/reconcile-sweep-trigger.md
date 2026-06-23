---
name: Reconcile sweep scheduled trigger (VexoAI)
description: How the generation_charges reconciliation sweep is triggered on a schedule in production.
---

**Rule:** The reconciliation sweep (`lib/reconcile-charges.ts`,
`reconcilePendingCharges`) is triggered two ways, both kept:
1. In-process timer started from Next's `instrumentation.ts` `register()` hook
   (`lib/reconcile-scheduler.ts`). This is the primary always-on scheduler.
2. The `/api/cron/reconcile-charges` route (CRON_SECRET bearer/?key= or admin
   cookie) for external cron pingers / manual admin runs.

**Why in-process instead of an external cron:** VexoAI deploys on Railway as a
long-lived `next start` process and there is no external scheduler infra wired
up (vercel.json has no `crons`, railway.json has no cron). The Next
`register()` hook runs once per server boot in the nodejs runtime, so a
`setInterval` there is a reliable schedule with zero extra infra. Safe on
multiple instances because the sweep resolves via requestId-keyed idempotent
RPCs (see credits-invariant.md) — concurrent sweeps can't double-refund.

**How to apply / config (env, all optional):**
- `RECONCILE_SWEEP_ENABLED` — `true`/`false` override; default ON only when
  `NODE_ENV==='production'` (so local Replit dev stays quiet).
- `RECONCILE_SWEEP_INTERVAL_MINUTES` (default 15),
  `RECONCILE_SWEEP_OLDER_THAN_MINUTES` (default 30),
  `RECONCILE_SWEEP_LIMIT` (default 100).
- The scheduler imports `reconcile-charges` lazily inside the tick so the module
  top level has no `@/` alias import and its pure helpers stay unit-testable
  under `node --test`.
