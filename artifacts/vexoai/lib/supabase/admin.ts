import { createClient as createSupabaseClient } from "@supabase/supabase-js"

/**
 * Admin Supabase client — service role key ашиглана.
 * RLS-ыг тойрч бүх хэрэглэгчдийн өгөгдөлд хандана.
 * ЗӨВХӨН server-side-д ашиглах!
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error("Supabase admin env vars not set")
  }
  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * Email нь admin эсэхийг шалгана.
 * ADMIN_EMAILS env (comma-separated) дотор байна уу шалгана.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  return adminEmails.includes(email.toLowerCase())
}
