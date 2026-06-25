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
