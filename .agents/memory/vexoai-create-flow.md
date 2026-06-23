---
name: VexoAI Create flow (blueprint-first video generation)
description: Credit-estimate-vs-charge contract and a_roll/b_roll pipeline rules for artifacts/vexoai Create page
---

# VexoAI "Create" flow (HeyGen-style, blueprint-first)

The Create page (`/app/create`) is agent-driven: chat → agent builds an editable
`VideoBlueprint` → user edits → approve → the **browser** orchestrates the
existing server routes (each route charges credits server-side and refunds on
failure). UI lives in `components/create/*`, hooks in `hooks/use-blueprint-chat`
and `hooks/use-video-generation`, types/cost in `lib/blueprint*.ts`.

## Rule: the client estimate MUST equal the server charge
**Why:** the user approves a "Generate (N credits)" number; if it differs from
what the routes actually deduct, trust is broken and balances go wrong.
**How to apply:**
- `CREDIT_COST` has ONE source of truth in the client-safe `lib/credit-costs.ts`
  (no server imports). `lib/credits.ts` re-exports it; `lib/blueprint-costs.ts`
  estimates from the same constant. If you change a route's charge, change
  `credit-costs.ts` — never hardcode a cost in the estimator or the UI.

## Rule: scene pipeline shapes the cost
- **a_roll** (talking head) = TTS → `avatar-video` (Kling Avatar, **bills at
  `video_standard`=10 regardless of blueprint.model**, audio baked in) → poll.
  Pushed to stitch with `audioUrl=null` so stitch does not re-overlay audio.
  Requires an avatar image + non-empty script (Generate is gated on this).
- **b_roll** = optional TTS + `generate-video({generateAudio:false})` → poll.
  Pushed to stitch with its own `audioUrl` (or null if silent). Bills the
  blueprint model (standard 10 / veo3 40).
- **stitch** is always called with `lipSync:false` (NO per-scene lipsync charge):
  talking heads are already lip-synced by Kling Avatar, b_roll has no face.
  `willStitch()` = `scenes>1` OR a single b_roll that HAS narration. A single
  a_roll, or a single silent b_roll, skips stitch (use the clip directly).

**Why this matters:** an earlier design temptation was to run a separate lipsync
pass (6 credits/scene) — that would double-charge talking heads and waste
credits on faceless footage. Don't reintroduce it.

## Rule: async-job failures are refunded via `generation_charges`
**Why:** credits are deducted at SUBMISSION (deduct-first, so affordability is
checked upfront), but a FAL job can fail/time out AFTER submission while the
client polls — the status routes previously had no way to refund.
**How to apply:**
- `generate-video` / `avatar-video` call `recordCharge(requestId, userId, cost,
  kind)` after a successful submit, persisting a row in `generation_charges`
  keyed by the FAL requestId.
- `video-status` / `avatar-status` call `refundCharge(requestId)` when
  `getVideoStatus`/`getAvatarVideoStatus` return the terminal `"failed"`
  (transient FAL errors are reported as `"processing"`, so they never refund),
  and `settleCharge(requestId)` on `"succeed"` so a later spurious failure can't
  refund a paid job. Refund/settle go through SECURITY DEFINER RPCs that flip
  `pending`→`refunded`/`settled` exactly once, so polling every few seconds is
  idempotent and safe.
- All three helpers (`lib/credits.ts`) use the service-role admin client and are
  best-effort: a missing table/RPC or transient error is logged and never breaks
  the request/poll path.
**Manual step (no migrations folder):** the table + RPCs live in
`artifacts/vexoai/supabase/migrations/0001_generation_charges.sql` and MUST be
run once in Supabase (SQL Editor), same as `profiles`/`deduct_credits` were.
The whole file is idempotent (create-if-not-exists, add-column-if-not-exists,
or/replace + drop-before-create for the one return-type change) so it is safe to
RE-RUN whenever the file changes — and you must, since there is no migration
infra and no direct DB connection from this environment. Until applied, async
failures simply aren't refunded (no crash).

## Rule: two paths resolve a pending charge (poll + server sweep)
**Why:** poll-based refund only fires while the client is polling; if the user
closes the tab before the terminal poll, the charge would stay `pending`
forever. A server-side sweep closes that gap so refunds are truly automatic.
**How to apply:**
- `reconcilePendingCharges()` (`lib/reconcile-charges.ts`) scans `pending`
  rows older than N minutes, re-checks each against FAL (avatar→fixed endpoint;
  b_roll needs `model`+`mode`, now persisted on the charge row via
  `recordCharge(..., {model, mode})`), then `refundCharge`/`settleCharge`. It
  only acts on DEFINITIVE FAL signals — transient errors surface as
  `"processing"` and are left pending, so the sweep never speculatively refunds
  a job that actually succeeded or is still running.
- Triggered by `app/api/cron/reconcile-charges` (GET+POST), authorized by
  `CRON_SECRET` (Bearer or `?key=`) OR an admin cookie session. **Operational:**
  for true background sweeps the user must set `CRON_SECRET` and point a
  Railway/cron scheduler at the route (agent can't set secrets or schedule
  Railway). Without it, only the admin manual trigger works.
- Summary counts only increment on actual RPC effect (`refunded` when credits>0,
  `settled` when rows>0); rows a concurrent poll already resolved fall into
  `alreadyResolved`, so the ops summary stays truthful.

## Rule: a charge that can't be recorded must compensate, never go silent
**Why:** every refund path (poll + sweep) keys off a `generation_charges` row.
If `recordCharge` fails AFTER a successful FAL submit, the user is charged but no
row exists, so nothing can ever refund it — credits are silently lost.
**How to apply:**
- `recordCharge` returns `boolean` and is idempotent: it `upsert`s on the
  `request_id` PK (`ignoreDuplicates`) with a couple of transient retries, so a
  committed-but-lost-response becomes a successful no-op on retry rather than a
  false failure (this is what keeps compensation double-refund-safe).
- When `recordCharge` returns `false`, both submit routes call
  `compensateUnrecordedCharge(requestId, userId, cost, kind)` and log a greppable
  `CHARGE_NOT_RECORDED` line.
- **CORRECTNESS INVARIANT:** credits are NEVER added outside the `request_id`
  idempotency guard. Every credit resolves through a row keyed by request_id (the
  compensate RPC's `ON CONFLICT DO NOTHING` insert, OR the poll/sweep refunding a
  pending row). NEVER do a raw `profiles` credit in the fallback — a direct credit
  can double-refund a row that actually landed (recordCharge can commit a row but
  return an error on a lost response, while the RPC separately fails) and is
  non-atomic under load. This exact mistake was caught in review — do not redo it.
- Compensation is TIERED and returns a discriminated `CompensationOutcome`
  (`credited` | `already_recorded` | `deferred` | `failed`) — callers MUST inspect
  it, never ignore it.
  1. **Tier 1:** `compensate_unrecorded_charge` SECURITY DEFINER RPC (atomic,
     idempotent), retried a few times to ride out transient errors. Inserts a row
     as already-`refunded` and credits the user, guarded by `ON CONFLICT
     (request_id) DO NOTHING`: if a pending row already landed it no-ops and
     credits nothing (poll/sweep owns it → `already_recorded`); else credits once
     (`credited`); a repeat returns 0. A clean `0` means "row exists", NEVER "RPC
     error".
  2. **Tier 2:** if the RPC keeps erroring, persist a guarded `pending` row via the
     idempotent `recordCharge(...)` (pass `{model,mode}` for b_roll so the sweep
     can re-check the right FAL endpoint). This does NOT credit — it hands the
     charge to the existing poll/sweep, which refund/settle through the SAME
     request_id guard, so it's double-refund-safe even if a row already landed.
     Succeeds in the partial-failure case (RPC missing because 0001 isn't fully
     applied, but plain table writes work) → `deferred`.
  3. **Tier 3:** if even the pending insert fails, the charges table is unwritable
     → `failed`; the route logs a greppable `BILLING_INCIDENT charge_unrecovered`
     line for manual recovery. You cannot durably record anything when the only
     datastore is unreachable — do not claim a refund that didn't happen.
- Net effect: the user is credited back exactly once. If an eagerly-refunded
  (Tier 1) job later succeeds the user simply keeps the credits (acceptable —
  erring toward user); deferred (Tier 2) charges refund only on actual failure.

## Rule: client generation must be resumable (no double-charge on retry)
The browser orchestrator
(`use-video-generation`) caches each succeeded scene's output keyed by a
`runKeyOf(bp)` content hash, plus the stitched final. "Retry" reuses cached
outputs and only redoes failed/unstarted scenes; the cache is discarded only
when the plan content actually changes.
**Why:** without this, retrying a partial failure regenerated already-paid
scenes and double-charged the user.
**How to apply:** never trigger a full re-run on retry; preserve `producedRef`
/`finalRef` across `run()` calls with the same key. Also freeze an
`activeBlueprint` snapshot when a run starts and disable chat while
`phase === "running"` so a revision can't swap the plan mid-generation.
