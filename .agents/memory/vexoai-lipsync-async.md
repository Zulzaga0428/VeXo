---
name: VexoAI lipsync async architecture
description: Why lipsync was converted from fal.subscribe (sync) to submit+poll (async), and how it works.
---

## Rule
Lipsync MUST use async `fal.queue.submit` → `/api/lipsync-status` poll pattern, NOT `fal.subscribe`.

**Why:** `fal.subscribe` holds one HTTP connection open for 1-3 min while LatentSync runs. Railway (and most production proxies) have HTTP idle/request timeouts well under 3 min. The long connection gets killed → lipsync throws → silent plain-merge fallback → user sees woman breathing with voice separate. Video generation already uses submit+poll (requestId from `/api/generate-video`, polled by `/api/video-status`) — lipsync must match this pattern.

**How to apply:**
- `/api/lipsync` — validate URLs, charge credits, `fal.queue.submit`, register job in `pendingLipsyncJobs` (lib/lipsync-jobs.ts), return `{requestId, engine}`. maxDuration=30.
- `/api/lipsync-status` — GET with requestId+engine query params, checks `fal.queue.status`, on COMPLETED fetches result. If LatentSync has no url or FAILED → submits pro fallback, returns `{status:"fallback", requestId, engine}`. On total failure → refundCredits → `{status:"failed"}`. maxDuration=30.
- `page.tsx` produceScene — submit, then poll every 3s up to 60× (3 min cap). Handle "done"/"fallback"/"failed"/"processing" statuses. `synced=true` only on "done".

## Credit handling (durable, exactly-once)
- Debited at submit, then a `generation_charges` row is recorded (`kind="lipsync"`,
  `model`=FAL endpoint) via `recordCharge` — same durable path as video/avatar.
- Refunds/settles go through the requestId-keyed idempotent RPCs
  (`refund_generation_charge`, `settle_generation_charge`), so they survive
  restarts and multiple instances. The reconcile sweep also resolves lipsync rows.
- Natural→pro fallback mints a new requestId, so it moves the charge atomically
  with `transfer_generation_charge` (gated on the old row still pending).
- No double-charge: submit records once; status/sweep only refund/settle/transfer.
- See `credits-invariant.md` for the full exactly-once + ownership reasoning.

## Shared state (cache only)
`lib/lipsync-jobs.ts` exports `pendingLipsyncJobs: Map<string, LipsyncJob>` —
module-level, single-process. It is NO LONGER authoritative for refunds: it only
caches the fallback source media (videoUrl/audioUrl). Losing it on restart/other
instance just disables the fallback (the job refunds instead), never a refund.
