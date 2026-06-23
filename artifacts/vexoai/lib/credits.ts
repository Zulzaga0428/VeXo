import { createClient } from "@/lib/supabase/server"

// Cost per action in credits — single source of truth lives in the client-safe
// module so the UI estimate and the server charge can never drift apart.
export { CREDIT_COST } from "@/lib/credit-costs"

type Result =
  | { ok: true; userId: string; remaining: number }
  | { ok: false; status: number; error: string }

// Verify auth, then deduct credits ATOMICALLY (deduct-first)
export async function chargeCredits(cost: number): Promise<Result> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, status: 401, error: "Unauthorized" }

  const { data, error } = await supabase.rpc("deduct_credits", {
    p_user_id: user.id,
    p_amount: cost,
  })
  if (error) return { ok: false, status: 500, error: "Credit error" }
  if (data === -1 || data === null) {
    return { ok: false, status: 402, error: "Кредит хүрэлцэхгүй байна" }
  }
  return { ok: true, userId: user.id, remaining: data as number }
}

// Free AI chat is rate-limited per user per day to prevent abuse.
export const DAILY_CHAT_LIMIT = 30

type ChatLimitResult =
  | { ok: true; userId: string; used: number; remaining: number }
  | { ok: false; status: number; error: string }

// Verify auth, then atomically count one chat message against the daily cap.
export async function bumpChatUsage(): Promise<ChatLimitResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, status: 401, error: "Unauthorized" }

  const { data, error } = await supabase.rpc("bump_chat_usage", {
    p_user_id: user.id,
    p_limit: DAILY_CHAT_LIMIT,
  })
  if (error) return { ok: false, status: 500, error: "Chat usage error" }
  if (data === -1 || data === null) {
    return { ok: false, status: 429, error: "daily_chat_limit" }
  }
  const used = data as number
  return { ok: true, userId: user.id, used, remaining: Math.max(0, DAILY_CHAT_LIMIT - used) }
}

// Refund credits if generation fails after charging
export async function refundCredits(userId: string, cost: number) {
  const supabase = await createClient()
  const { data: profile } = await supabase.from("profiles").select("credits").eq("id", userId).single()
  await supabase
    .from("profiles")
    .update({ credits: (profile?.credits || 0) + cost })
    .eq("id", userId)
}
