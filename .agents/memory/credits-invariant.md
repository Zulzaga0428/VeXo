---
name: Credits atomicity & idempotency invariant (VexoAI)
description: How credit charges/refunds must be implemented to stay correct under concurrency.
---

**Rule:** Every mutation of a user's credit balance must be atomic and
idempotent at the DB layer — done through a `SECURITY DEFINER` Postgres RPC,
never a client-side read-modify-write (read balance → compute → update).

- Atomic increment/decrement via RPC (e.g. `credit_user`), executed through the
  service-role admin client. Such RPCs must be `service_role`-only with a fixed
  `search_path` and revoked from public/anon/authenticated (no self-credit path).
- Refund helpers (`refundCredits`) return a truthful **boolean** and log a
  greppable `[credits] REFUND_FAILED` on any non-crediting outcome (error,
  throw, or NULL). Callers must only tell the user a refund happened when the
  helper returned true.
- Idempotent, charge-keyed refunds (`refund_generation_charge`,
  `compensate_unrecorded_charge`) are keyed by requestId/charge row.

**Poll endpoints & sweeps refund/settle durably (no in-memory ownership gate):**
Any endpoint or background sweep that can run more than once per charge
(`lipsync-status`, the reconcile sweep, video/avatar status) must refund/settle
through the requestId-keyed idempotent RPCs (`refund_generation_charge`,
`settle_generation_charge`). These are exactly-once across processes AND
instances, so they do NOT need a single-owner election — every kind of generation
(video, avatar, lipsync) records a `generation_charges` row at submit and resolves
by requestId. Branch terminal behavior on the authoritative stored `model`, never
a client-supplied param.

**Fallback that mints a new requestId uses `transfer_generation_charge`:** when a
natural lipsync job fails and we resubmit to pro under a NEW requestId, move the
charge atomically (settle old + insert successor pending), gated on the old row
still being `pending`. That "old must still be pending" check is the
cross-instance single-owner election for the fallback: exactly one concurrent
poll/instance wins; losers discard their orphan FAL job and let the winner stand.

**`pendingLipsyncJobs` is cache-only now:** it holds only the fallback source
media (videoUrl/audioUrl) needed to resubmit. Losing it on restart/other instance
just disables the fallback (the job then refunds via the durable RPC) — it can
NEVER break or duplicate a refund. The status route recovers the FAL endpoint from
the charge row (`getCharge`) when the map is empty.

**Known best-effort gap (billing-safe):** if two pollers race the same natural
failure, the transfer loser returns `processing` then later sees `failed` while
the winner's paid pro successor may still settle — a charged *result* orphan, not
a double-charge/double-refund. Fixing the UX needs a `superseded_by_request_id`
link so old polls can redirect; out of scope for refund durability.

**Why:** The original `refundCredits` did a non-atomic read-modify-write that lost
updates under concurrency and swallowed errors; in-memory `pendingLipsyncJobs`
ownership was single-process only, so refunds were lost on restart/scale-out. The
durable fix keys lipsync charges/refunds off `generation_charges` like
video/avatar. `refundCredits` (non-idempotent) now survives ONLY for the
pre-record submit-throw path, where no charge row exists yet.
