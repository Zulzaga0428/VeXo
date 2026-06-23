// Credit estimation for a VideoBlueprint.
//
// This MUST mirror exactly what the server routes charge during generation, or
// the "Generate (N credits)" number the user approves will not match the real
// deduction. The generation orchestrator (hooks/use-video-generation.ts) walks
// the scenes in the same order described here.
//
// Per-scene charges (all charged server-side):
//   a_roll  -> tts (script) + avatar-video (video_standard)         [Kling Avatar]
//   b_roll  -> [tts if script] + generate-video (standard | veo3)
// Plus one stitch charge (3) when we run the stitch step.
//
// IMPORTANT: this flow always calls stitch with lipSync:false, so there is NO
// per-scene lipsync charge — talking heads are already lip-synced by Kling
// Avatar, and b_roll footage has no face to sync.

import { CREDIT_COST } from "@/lib/credit-costs"
import type { BlueprintModel, BlueprintScene, VideoBlueprint } from "@/lib/blueprint"

export function sceneHasNarration(s: BlueprintScene): boolean {
  return typeof s.script === "string" && s.script.trim().length > 0
}

// Whether the orchestrator will run the stitch step for this blueprint.
// A single a_roll scene is already a finished talking-head video (audio baked
// in), and a single silent b_roll needs no audio overlay — neither needs stitch.
export function willStitch(bp: VideoBlueprint): boolean {
  const n = bp.scenes.length
  if (n === 0) return false
  if (n > 1) return true
  const only = bp.scenes[0]
  return only.type === "b_roll" && sceneHasNarration(only)
}

export function estimateSceneCredits(s: BlueprintScene, model: BlueprintModel): number {
  let c = 0
  if (sceneHasNarration(s)) c += CREDIT_COST.tts
  if (s.type === "a_roll") {
    c += CREDIT_COST.video_standard // Kling Avatar always bills at standard
  } else {
    c += model === "veo3" ? CREDIT_COST.video_veo3 : CREDIT_COST.video_standard
  }
  return c
}

export function estimateBlueprintCredits(bp: VideoBlueprint): number {
  let total = 0
  for (const s of bp.scenes) total += estimateSceneCredits(s, bp.model)
  if (willStitch(bp)) total += CREDIT_COST.stitch
  return total
}
