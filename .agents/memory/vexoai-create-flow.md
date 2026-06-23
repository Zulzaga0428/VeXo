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
Until then async failures simply aren't refunded (no crash).
**Known gap:** refunds only fire while the client is polling. If the user closes
the tab before the terminal poll, the charge stays `pending` and is never
refunded — needs a server-side reconciliation sweep (proposed follow-up).

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
