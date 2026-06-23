/** Retry up to `maxAttempts` times on transient 5xx errors from Anthropic. */
export async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 2): Promise<T> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err: unknown) {
      const isLast = attempt === maxAttempts - 1
      const status = (err as Record<string, unknown>)?.status
      if (!isLast && typeof status === "number" && status >= 500 && status < 600) {
        await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)))
        continue
      }
      throw err
    }
  }
  /* istanbul ignore next */
  throw new Error("unreachable")
}
