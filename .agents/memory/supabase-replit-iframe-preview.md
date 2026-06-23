---
name: Supabase auth + Next.js HMR in Replit iframe preview
description: Why login and live-reload fail in the Replit dev preview iframe and how to fix both
---

# Supabase auth & Next.js dev work inside Replit's proxied iframe

The Replit preview pane embeds the app in a **cross-site iframe** (app served on
`*.replit.dev`, embedded under `replit.com`). Two independent things break there
but work fine on a directly-accessed deployed domain:

## 1. Login silently fails (redirects back to /login)

**Cause:** `@supabase/ssr` cookie-based auth sets cookies with `SameSite=Lax` by
default. Browsers do not send/store Lax cookies in a cross-site iframe, so after
`signInWithPassword` the auth cookie never reaches the server; middleware sees no
user and bounces `/app/*` back to `/login`. Works on deploy because the published
domain is opened directly (first-party).

**Fix:** set `sameSite: 'none', secure: true` on auth cookies **in dev only**
(`process.env.NODE_ENV !== 'production'`), keeping the stricter default in prod.
Apply in all three places: browser client (`createBrowserClient` `cookieOptions`),
server client and middleware (spread the options into each `cookies.set` in
`setAll`). `secure: true` is required for `SameSite=None`; the replit.dev preview
is HTTPS so this is fine.

## 2. Changes don't hot-reload in the preview (must redeploy to see edits)

**Cause:** Next 16 blocks cross-origin requests to `/_next/webpack-hmr` from the
iframe host unless the host is in `allowedDevOrigins`. The `"*"` wildcard is NOT
honored — you must pass concrete hostnames.

**Fix:** in `next.config.mjs`, set `allowedDevOrigins` (dev only) from
`process.env.REPLIT_DEV_DOMAIN` and `process.env.REPLIT_DOMAINS` (comma-split,
deduped). Those env vars are present in the workflow env and inherited by the
`next dev` process.

**Why both matter:** without these, the user can only verify changes by deploying
each time, which is slow and painful.

**Note on log files:** `/tmp/logs/...VexoAI....log` snapshots do not always rotate
on restart; a stale cross-origin warning there can be from a previous run. Verify
config by evaluating it directly (`node --input-type=module -e "import(...)"`)
rather than trusting an old log line.
