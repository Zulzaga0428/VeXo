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

-- Lock the functions down to the server only.
revoke all on function public.refund_generation_charge(text) from public, anon, authenticated;
revoke all on function public.settle_generation_charge(text) from public, anon, authenticated;
grant execute on function public.refund_generation_charge(text) to service_role;
grant execute on function public.settle_generation_charge(text) to service_role;
