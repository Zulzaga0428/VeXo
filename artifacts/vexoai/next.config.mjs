/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  // Dev only — needed for Replit's proxied iframe preview. The "*" wildcard is
  // not honored by Next 16's HMR check, so pass the concrete Replit dev host(s).
  ...(process.env.NODE_ENV !== "production" && {
    allowedDevOrigins: [
      ...new Set(
        [
          process.env.REPLIT_DEV_DOMAIN,
          ...(process.env.REPLIT_DOMAINS?.split(",") ?? []),
        ]
          .map((h) => h?.trim())
          .filter(Boolean),
      ),
    ],
  }),
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
}

export default nextConfig
