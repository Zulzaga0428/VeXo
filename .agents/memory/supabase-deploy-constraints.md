---
name: Supabase deploy constraints (VexoAI)
description: How DB/schema changes reach production for the vexoai artifact — there is no automation.
---

VexoAI (`artifacts/vexoai`) uses Supabase for auth + DB + Storage and deploys on
Railway. There is **no migration runner** wired into the app or deploy, and the
agent has **no direct DB connection**.

**Rule:** Any new SQL — new RPCs, tables, columns, grants, anything in
`supabase/migrations/*.sql` — must be run **manually by the user in the Supabase
SQL Editor**. Editing/adding a migration file does NOT apply it anywhere.

**Why:** The deploy flow is "user pushes to GitHub manually"; nothing executes
migrations. Code that depends on a not-yet-applied object (e.g. a new RPC) will
fail at runtime until the SQL is pasted into Supabase.

**How to apply:** When a change adds/edits SQL, call it out explicitly in the
commit message and to the user as a required manual step, and prefer designs
that **fail loudly** (logged error, no silent fallback) when the object is
missing, so a forgotten migration is visible rather than silently wrong.

**Pending manual SQL:** `supabase/migrations/0001_generation_charges.sql`
defines `transfer_generation_charge` (atomic natural→pro charge hand-off used by
both video/avatar and lip-sync via `transferCharge`). Must be pasted into the
Supabase SQL Editor or the lip-sync fallback transfer logs an error and falls
through to refunding the original charge.
