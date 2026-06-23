import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// In the Replit dev preview the app is embedded in a cross-site iframe, so auth
// cookies must be SameSite=None;Secure to be stored/sent. Production is accessed
// directly, so the stricter default is kept there.
const devCookieOptions =
  process.env.NODE_ENV !== 'production' ? ({ sameSite: 'none', secure: true } as const) : {}

/**
 * Especially important if using Fluid compute: Don't put this client in a
 * global variable. Always create a new client within each function when using
 * it.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, { ...options, ...devCookieOptions }),
            )
          } catch {
            // The "setAll" method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    },
  )
}
