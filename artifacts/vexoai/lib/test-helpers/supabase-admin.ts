// Test double for `@/lib/supabase/admin`. The resolve hook in test/alias-hooks
// redirects that import here at runtime, so the real `credits.ts` /
// `reconcile-charges.ts` exercise their actual logic against the in-memory
// fake-state instead of a live Supabase service-role client.
import { callRpc, state, type ChargeRow, type RpcResult } from "./fake-state.ts"

interface SelectBuilder {
  select(columns?: string): SelectBuilder
  eq(column: string, value: unknown): SelectBuilder
  lt(column: string, value: unknown): SelectBuilder
  order(column: string, opts?: unknown): SelectBuilder
  limit(count: number): Promise<{ data: ChargeRow[]; error: { message: string } | null }>
  maybeSingle(): Promise<{ data: ChargeRow | null; error: { message: string } | null }>
}

interface FromBuilder extends SelectBuilder {
  upsert(row: Record<string, unknown>, opts?: unknown): Promise<{ error: { message: string } | null }>
}

interface FakeAdmin {
  rpc(fn: string, args: Record<string, unknown>): Promise<RpcResult>
  from(table: string): FromBuilder
}

function matches(row: ChargeRow, filters: Array<[string, unknown]>): boolean {
  const record = row as unknown as Record<string, unknown>
  return filters.every(([column, value]) => record[column] === value)
}

export function createAdminClient(): FakeAdmin {
  return {
    rpc(fn, args) {
      return Promise.resolve(callRpc(fn, args))
    },
    from(_table) {
      const filters: Array<[string, unknown]> = []
      const builder: FromBuilder = {
        upsert(row) {
          if (state.failUpsert) {
            return Promise.resolve({ error: { message: "generation_charges write failed (simulated)" } })
          }
          // onConflict(request_id) + ignoreDuplicates -> idempotent no-op insert.
          const id = row.request_id as string
          if (!state.charges.has(id)) {
            state.charges.set(id, {
              request_id: id,
              user_id: row.user_id as string,
              cost: row.cost as number,
              kind: (row.kind as string) || "video",
              model: (row.model as string) ?? null,
              mode: (row.mode as string) ?? null,
              status: "pending",
            })
          }
          return Promise.resolve({ error: null })
        },
        select() {
          return builder
        },
        eq(column, value) {
          filters.push([column, value])
          return builder
        },
        lt() {
          return builder
        },
        order() {
          return builder
        },
        limit() {
          const rows = [...state.charges.values()].filter((row) => matches(row, filters))
          return Promise.resolve({ data: rows, error: null })
        },
        maybeSingle() {
          const row = [...state.charges.values()].find((candidate) => matches(candidate, filters)) ?? null
          return Promise.resolve({ data: row, error: null })
        },
      }
      return builder
    },
  }
}

export function isAdminEmail(_email: string | null | undefined): boolean {
  return false
}
