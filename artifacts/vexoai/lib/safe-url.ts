// Guards for server-side fetches of client-supplied URLs (waveform peaks, audio
// padding, etc.). These routes fetch a URL the browser hands us, so we must stop
// them from being pointed at internal/metadata hosts (SSRF) or huge resources.

// Validate that a URL is a public https endpoint, not localhost or a private IP.
// Returns the parsed URL on success; throws with a user-safe message otherwise.
export function assertSafePublicUrl(raw: string): URL {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    throw new Error("Invalid URL")
  }
  if (u.protocol !== "https:") throw new Error("Only https URLs allowed")
  const host = u.hostname.toLowerCase()
  if (host === "localhost" || host.endsWith(".localhost")) {
    throw new Error("Host not allowed")
  }
  if (isPrivateHost(host)) throw new Error("Host not allowed")
  return u
}

// Best-effort block of literal private/loopback/link-local IPs. DNS-rebinding is
// not fully covered here, but combined with https-only + size/time limits and a
// response that only ever returns derived numbers (peaks/duration), the SSRF
// surface is small.
function isPrivateHost(host: string): boolean {
  // IPv6 loopback / unique-local (fc00::/7) / link-local (fe80::/10).
  if (host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80")) {
    return true
  }
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!m) return false
  const [a, b] = [Number(m[1]), Number(m[2])]
  if (a === 10) return true // 10.0.0.0/8
  if (a === 127) return true // loopback
  if (a === 0) return true // 0.0.0.0/8
  if (a === 169 && b === 254) return true // link-local / cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true // 172.16.0.0/12
  if (a === 192 && b === 168) return true // 192.168.0.0/16
  return false
}

// Fetch a public resource with SSRF guard, a timeout, and a max-size cap.
// Redirects are followed MANUALLY (redirect: "manual") and every hop's Location
// is re-validated through assertSafePublicUrl — otherwise a public https URL
// could 30x-redirect to an internal/metadata host and bypass the initial check.
export async function fetchPublicResource(
  raw: string,
  opts: { timeoutMs?: number; maxBytes?: number; maxRedirects?: number } = {},
): Promise<{ buffer: Buffer; contentType: string }> {
  const { timeoutMs = 12000, maxBytes = 30_000_000, maxRedirects = 4 } = opts
  let url = assertSafePublicUrl(raw)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    for (let hop = 0; hop <= maxRedirects; hop++) {
      const resp = await fetch(url, { signal: controller.signal, redirect: "manual" })
      // Manual mode surfaces 3xx as a real response with a Location header.
      if (resp.status >= 300 && resp.status < 400) {
        const loc = resp.headers.get("location")
        if (!loc) throw new Error(`Fetch failed: ${resp.status}`)
        // Resolve relative redirects against the current URL, then re-guard.
        url = assertSafePublicUrl(new URL(loc, url).toString())
        continue
      }
      if (!resp.ok) throw new Error(`Fetch failed: ${resp.status}`)
      const declared = Number(resp.headers.get("content-length") || 0)
      if (declared && declared > maxBytes) throw new Error("Resource too large")
      const ab = await resp.arrayBuffer()
      if (ab.byteLength > maxBytes) throw new Error("Resource too large")
      return { buffer: Buffer.from(ab), contentType: resp.headers.get("content-type") || "" }
    }
    throw new Error("Too many redirects")
  } finally {
    clearTimeout(timer)
  }
}
