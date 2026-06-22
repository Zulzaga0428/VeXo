import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // Fall back to harmless placeholders so static prerendering during the build
  // does not crash when env vars are not inlined. At runtime in the browser the
  // real NEXT_PUBLIC_* values are always present.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

  return createBrowserClient(url, anonKey)
}
