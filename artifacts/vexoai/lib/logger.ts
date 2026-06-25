/**
 * Lightweight structured logger for server-side code.
 * Never use console.log/warn/error directly in server modules — use this instead.
 * Route handlers can use `req.log` if available; all non-request code uses this.
 */

/** Serialize an unknown thrown value to a safe, flat string (no raw objects). */
export function toErrStr(e: unknown): string {
  if (e instanceof Error) return `${e.name}: ${e.message}`
  if (typeof e === "string") return e
  try {
    return JSON.stringify(e)
  } catch {
    return String(e)
  }
}

/**
 * FAL.ai client throws structured error objects with `status` + `body`.
 * This extracts the HTTP status code so callers can distinguish permanent
 * validation failures (4xx) from transient network/server errors (5xx).
 */
export function falHttpStatus(e: unknown): number | undefined {
  return (e as { status?: number })?.status
}

/**
 * Serialize a FAL.ai error's `body.detail` array so the full validation
 * message is visible in logs rather than "[Object]".
 */
export function falErrorDetail(e: unknown): string {
  try {
    const body = (e as { body?: unknown })?.body
    if (!body) return ""
    return JSON.stringify(body)
  } catch {
    return ""
  }
}

type Meta = Record<string, unknown>

function write(level: "info" | "warn" | "error", msg: string, meta?: Meta) {
  const line = JSON.stringify({ level, msg, ...meta, time: new Date().toISOString() })
  if (level === "error") {
    process.stderr.write(line + "\n")
  } else {
    process.stdout.write(line + "\n")
  }
}

export const logger = {
  info: (msg: string, meta?: Meta) => write("info", msg, meta),
  warn: (msg: string, meta?: Meta) => write("warn", msg, meta),
  error: (msg: string, meta?: Meta) => write("error", msg, meta),
}
