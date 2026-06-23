-- ============================================================================
-- generation_charges — async credit refund tracking
-- ============================================================================
-- Run this once in your Supabase project (SQL Editor) — the same place the
-- existing `profiles` table and `deduct_credits` / `bump_chat_usage` functions
-- were created. It is safe to re-run (idempotent).
--
-- Why this exists:
--   Credits are deducted the moment a video/avatar job is SUBMITTED to FAL.ai,
--   but a job can still fail or time out AFTER submission while the client
--   polls /api/video-status or /api/avatar-status. Those status routes had no
--   way to refund. This table records each charge keyed by the FAL requestId so
--   a terminal failure can be refunded EXACTLY ONCE (and a success marks the
--   charge settled so it can never be refunded afterwards).
--
-- Access model:
--   Only the server (service_role) reads/writes this. RLS is enabled with NO
--   policies, which blocks anon/authenticated entirely. The refund/settle
--   functions are SECURITY DEFINER and executable only by service_role.
-- ============================================================================

create table if not exists public.generation_charges (
  request_id  text primary key,
  user_id     uuid not null,
  cost        integer not null check (cost >= 0),
  kind        text not null default 'video',   -- 'video' | 'avatar'
  model       text,                            -- b_roll only: 'standard' | 'veo3'
  mode        text,                            -- b_roll only: 'image' | 'text'
  status      text not null default 'pending', -- 'pending' | 'settled' | 'refunded'
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.generation_charges enable row level security;

-- Backfill columns + index for projects that created this table before the
-- server-side reconciliation sweep existed. Safe to re-run. model/mode let the
-- sweep re-check a b_roll job against the correct FAL endpoint; the index speeds
-- up the "stale pending" scan.
alter table public.generation_charges add column if not exists model text;
alter table public.generation_charges add column if not exists mode  text;
create index if not exists generation_charges_status_created_idx
  on public.generation_charges (status, created_at);

-- Atomically refund a still-pending charge exactly once and credit the user
-- back. Returns the number of credits refunded (0 if nothing was pending —
-- already settled, already refunded, or unknown requestId), so it is safe to
-- call on every poll.
create or replace function public.refund_generation_charge(p_request_id text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_cost    integer;
begin
  update public.generation_charges
     set status = 'refunded', resolved_at = now()
   where request_id = p_request_id
     and status = 'pending'
  returning user_id, cost into v_user_id, v_cost;

  if v_user_id is null then
    return 0;  -- nothing pending -> idempotent no-op
  end if;

  update public.profiles
     set credits = coalesce(credits, 0) + v_cost
   where id = v_user_id;

  return coalesce(v_cost, 0);
end;
$$;

-- Mark a charge settled once its job has succeeded, so a later (spurious)
-- failure poll can never refund it. Idempotent. Returns the number of rows it
-- actually settled (0 if already resolved) so callers can report truthfully.
-- (DROP first: a CREATE OR REPLACE cannot change a function's return type.)
drop function if exists public.settle_generation_charge(text);
create function public.settle_generation_charge(p_request_id text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.generation_charges
     set status = 'settled', resolved_at = now()
   where request_id = p_request_id
     and status = 'pending';
  get diagnostics v_count = row_count;
  return coalesce(v_count, 0);
end;
$$;

-- Compensate a charge that could NOT be recorded by recordCharge after a
-- successful FAL submit. In that case the user was already debited but no row
-- was written, so neither the status poll nor the reconciliation sweep could
-- ever refund it. This atomically records the charge as already-'refunded' AND
-- credits the user back — but ONLY if no row already exists for this requestId.
--
-- Double-refund-safe by construction: ON CONFLICT (request_id) DO NOTHING means
-- that if a row DID land (pending/settled/refunded) we credit nothing and leave
-- the normal poll/sweep to own it. Idempotent: a repeat call conflicts and
-- returns 0. Atomic: the insert + credit happen in one transaction, so a caller
-- that gets a non-zero result KNOWS the credit was applied. Returns the credits
-- restored (cost on the first compensation, 0 otherwise).
create or replace function public.compensate_unrecorded_charge(
  p_request_id text,
  p_user_id    uuid,
  p_cost       integer,
  p_kind       text default 'video'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted integer;
begin
  insert into public.generation_charges
    (request_id, user_id, cost, kind, status, resolved_at)
  values
    (p_request_id, p_user_id, p_cost, coalesce(p_kind, 'video'), 'refunded', now())
  on conflict (request_id) do nothing;

  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    return 0;  -- a row already exists -> poll/sweep owns it; do NOT double-credit
  end if;

  update public.profiles
     set credits = coalesce(credits, 0) + p_cost
   where id = p_user_id;

  return coalesce(p_cost, 0);
end;
$$;

-- Atomically credit a user's balance by a POSITIVE amount in a SINGLE statement
-- so concurrent credit changes (one refund racing another refund, or racing an
-- atomic deduct_credits) can't clobber each other through a read-modify-write.
-- Used by refundCredits() to return credits after a SYNCHRONOUS failure (the
-- action errored right after charging). Unlike the requestId-keyed async refunds
-- there is no poll/sweep here, so this is a one-shot credit-back with no
-- idempotency key and no double-refund vector — its only job is to be atomic.
-- Returns the new balance, or NULL if no such profile row exists or the amount
-- is not positive, so the caller can tell whether the credit really applied.
create or replace function public.credit_user(
  p_user_id uuid,
  p_amount  integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_credits integer;
begin
  if p_amount is null or p_amount <= 0 then
    return null;  -- nothing to credit
  end if;

  update public.profiles
     set credits = coalesce(credits, 0) + p_amount
   where id = p_user_id
  returning credits into v_credits;

  return v_credits;  -- NULL if no row matched -> caller treats as failure
end;
$$;

-- Lock the functions down to the server only.
revoke all on function public.refund_generation_charge(text) from public, anon, authenticated;
revoke all on function public.settle_generation_charge(text) from public, anon, authenticated;
revoke all on function public.compensate_unrecorded_charge(text, uuid, integer, text) from public, anon, authenticated;
revoke all on function public.credit_user(uuid, integer) from public, anon, authenticated;
grant execute on function public.refund_generation_charge(text) to service_role;
grant execute on function public.settle_generation_charge(text) to service_role;
grant execute on function public.compensate_unrecorded_charge(text, uuid, integer, text) to service_role;
grant execute on function public.credit_user(uuid, integer) to service_role;
