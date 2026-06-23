// Client-safe credit costs.
//
// This module has NO server-only imports (no Supabase, no Node APIs) so it can
// be imported from both server routes (via lib/credits.ts) and client code
// (the blueprint cost estimator). Keeping a single source of truth here is what
// guarantees the "Generate (N credits)" estimate shown to the user matches what
// the server actually charges.
export const CREDIT_COST = {
  video_standard: 10, // Kling 3.0 (native audio) / Kling Avatar talking-head
  video_veo3: 40,
  image: 2,
  tts: 1,
  enhance: 1,
  stitch: 3,
  lipsync: 6, // per scene that gets lip-synced (lipsync-2-pro, highest quality)
  autoscene: 1, // agent reads an image and writes the scene prompt + narration
} as const

export type CreditCostKey = keyof typeof CREDIT_COST
