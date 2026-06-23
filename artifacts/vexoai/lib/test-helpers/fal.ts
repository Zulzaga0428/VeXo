// Test double for `@fal-ai/client`. Implements just the queue surface the
// lip-sync submit/poll paths use: submit (hands back a queued requestId),
// status, and result — all driven by fake-state.
import { state } from "./fake-state.ts"

interface SubmitResult {
  request_id: string
}
interface StatusResult {
  status: string
}
interface QueueResult {
  data: { video?: { url?: string }; video_url?: string }
}

export const fal = {
  config(_opts?: unknown): void {},
  queue: {
    submit(_endpoint: string, _opts: unknown): Promise<SubmitResult> {
      const id = state.fal.submitIds.shift() ?? `auto-${(state.fal.submitCounter += 1)}`
      return Promise.resolve({ request_id: id })
    },
    status(_endpoint: string, opts: { requestId: string }): Promise<StatusResult> {
      return Promise.resolve({ status: state.fal.statusById.get(opts.requestId) ?? "IN_PROGRESS" })
    },
    result(_endpoint: string, opts: { requestId: string }): Promise<QueueResult> {
      const result = state.fal.resultById.get(opts.requestId)
      return Promise.resolve({ data: result?.videoUrl ? { video: { url: result.videoUrl } } : {} })
    },
  },
}
