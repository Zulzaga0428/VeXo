export type LipsyncEngine = "natural" | "pro"

export interface LipsyncJob {
  videoUrl: string
  audioUrl: string
  userId: string
  engine: LipsyncEngine
  model: string
}

// Module-level registry keyed by FAL requestId.
// Shared between /api/lipsync (submit) and /api/lipsync-status (poll) within
// the same Node.js process. Works on Railway (persistent server); survives
// across requests within a deployment but resets on server restart.
export const pendingLipsyncJobs = new Map<string, LipsyncJob>()
