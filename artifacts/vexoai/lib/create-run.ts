// Persisted snapshot of an in-progress (or just-completed) Create run, so a user
// who refreshes or closes the tab mid-generation can come back and resume without
// losing — or being re-charged for — work that already happened.
//
// Crucially this captures per-scene *job* state, not just finished clips: once a
// provider accepts a generation request it has already charged credits, so we
// persist the returned requestId immediately. On resume we re-poll that existing
// requestId instead of submitting (and paying for) a brand-new job.
//
// Shared by the client (the generation hook) and the server (the /api/create-run
// route), so it must stay free of server-only imports.

import type { VideoBlueprint } from "./blueprint"

export type SceneJobKind = "avatar" | "video"

// A generation job the provider has already accepted (already charged for).
export interface SceneJob {
  kind: SceneJobKind
  requestId: string
  // Needed to poll /api/video-status for b_roll ("video") jobs.
  model?: string
  mode?: string
}

export interface PersistedScene {
  id: string
  // Generated TTS audio for this scene (a_roll speech / b_roll narration).
  // null = no narration generated yet, or a silent b_roll. Kept after the job is
  // submitted so b_roll narration can still be overlaid at stitch time.
  ttsAudioUrl: string | null
  // Set once a generation job is accepted but before it finishes rendering.
  job: SceneJob | null
  // Set once the clip has finished rendering.
  videoUrl: string | null
}

export interface PersistedRun {
  // Content hash of the blueprint the run was started with (see runKeyOf). On
  // resume we only reuse cached work when this still matches the plan.
  runKey: string
  // Snapshot of the blueprint the run was started with.
  blueprint: VideoBlueprint
  // Per-scene state (job in flight and/or finished clip).
  scenes: PersistedScene[]
  // Stitched/final url once the whole run is finished.
  finalUrl: string | null
  // true once the run finished (final video ready).
  done: boolean
  updatedAt: number
}

function isSceneJob(value: unknown): value is SceneJob {
  if (!value || typeof value !== "object") return false
  const j = value as Record<string, unknown>
  return (
    (j.kind === "avatar" || j.kind === "video") &&
    typeof j.requestId === "string" &&
    (j.model === undefined || typeof j.model === "string") &&
    (j.mode === undefined || typeof j.mode === "string")
  )
}

function isPersistedScene(value: unknown): value is PersistedScene {
  if (!value || typeof value !== "object") return false
  const s = value as Record<string, unknown>
  return (
    typeof s.id === "string" &&
    (s.ttsAudioUrl === null || typeof s.ttsAudioUrl === "string") &&
    (s.videoUrl === null || typeof s.videoUrl === "string") &&
    (s.job === null || isSceneJob(s.job))
  )
}

export function isPersistedRun(value: unknown): value is PersistedRun {
  if (!value || typeof value !== "object") return false
  const r = value as Record<string, unknown>
  return (
    typeof r.runKey === "string" &&
    !!r.blueprint &&
    typeof r.blueprint === "object" &&
    Array.isArray(r.scenes) &&
    r.scenes.every(isPersistedScene) &&
    (r.finalUrl === null || typeof r.finalUrl === "string") &&
    typeof r.done === "boolean" &&
    typeof r.updatedAt === "number"
  )
}

/**
 * Monotonic write guard. Run-state writes are fire-and-forget from the client, so
 * a slow older request could otherwise land after a newer one and clobber a saved
 * requestId / videoUrl — re-stranding paid work. `updatedAt` is strictly
 * increasing per client, so the server only accepts a snapshot that is newer than
 * what is already stored (compare-and-set).
 */
export function shouldPersistRun(existing: PersistedRun | null, incoming: PersistedRun): boolean {
  if (!existing || typeof existing.updatedAt !== "number") return true
  return incoming.updatedAt > existing.updatedAt
}
