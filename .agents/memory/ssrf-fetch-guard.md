---
name: SSRF guard for server-side fetches of client URLs
description: How to safely fetch a browser-supplied URL on the server without SSRF
---

# Fetching client-supplied URLs on the server

Any server route that fetches a URL the browser hands it (waveform peaks, audio padding, thumbnailers, "import from URL", etc.) is an SSRF sink: the client can point it at internal/cloud-metadata hosts.

**The non-obvious trap: validating only the initial URL is not enough — `fetch` follows redirects automatically.** A public `https://` URL that passes the host check can `30x`-redirect to `http://169.254.169.254/...` (cloud metadata) or a private IP, and the default fetch will follow it, bypassing the guard.

**Rule: follow redirects manually and re-validate every hop.**
- Use `fetch(url, { redirect: "manual" })`, detect `3xx`, read `Location`, resolve relative redirects against the current URL, and run the same host/protocol guard on each hop. Cap the hop count.

**Why:** redirect-following silently defeats a front-door allowlist; the only safe place to enforce "public host only" is on *every* URL actually fetched, not just the first one.

**Layered defenses that still matter (none alone is sufficient):**
- https-only + block `localhost`, loopback, link-local `169.254.0.0/16`, and RFC-1918 ranges (`10/8`, `172.16/12`, `192.168/16`), plus IPv6 loopback/ULA/link-local.
- Timeout (AbortController) + max-bytes cap (check `content-length` *and* the actual body length).
- Keep the response derived-only (return numbers/duration, never the raw fetched body) so even a slipped-through internal hit leaks little.

Residual risk: DNS rebinding (host resolves public on validation, private on fetch) is not covered by hostname checks alone — accept it given the derived-only response, or resolve+pin the IP if the surface ever grows.

Lives in `artifacts/vexoai/lib/safe-url.ts` (`assertSafePublicUrl`, `fetchPublicResource`).
