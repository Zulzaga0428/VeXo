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

**Poll endpoints are special:** `refundCredits` is NOT idempotent, so any
endpoint that can run more than once per charge (e.g. `lipsync-status`, which
polls and tracks jobs in the in-memory `pendingLipsyncJobs` map) must claim
single ownership of the terminal transition first — `pendingLipsyncJobs.delete(requestId)`
returns true for exactly one caller in single-threaded JS — and gate BOTH the
fallback submit and the refund behind it. Branch terminal behavior on the
authoritative server-side `job.engine`, never a client-supplied param.

**Why:** The original `refundCredits` did a non-atomic read-modify-write that
lost updates under concurrency and swallowed errors; the architect rejected any
non-atomic fallback. In-memory job tracking is single-process only — the durable
fix is to key lipsync charges/refunds off `generation_charges` like video/avatar.
