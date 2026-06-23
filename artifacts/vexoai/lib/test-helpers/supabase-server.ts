// Test double for `@/lib/supabase/server` (the request-scoped client used by
// chargeCredits/bumpChatUsage). Shares the same fake-state singleton as the
// admin double so a deduct (server) and a credit (admin) operate on one balance.
import { callRpc, state, type RpcResult } from "./fake-state.ts"

interface FakeServerClient {
  auth: { getUser(): Promise<{ data: { user: { id: string } | null }; error: null }> }
  rpc(fn: string, args: Record<string, unknown>): Promise<RpcResult>
}

export async function createClient(): Promise<FakeServerClient> {
  return {
    auth: {
      getUser() {
        return Promise.resolve({ data: { user: state.user }, error: null })
      },
    },
    rpc(fn, args) {
      return Promise.resolve(callRpc(fn, args))
    },
  }
}
