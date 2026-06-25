import { fal } from "@fal-ai/client"
import { logger, toErrStr, falHttpStatus, falErrorDetail } from "@/lib/logger"

/**
 * Returns true for permanent FAL.ai validation failures (4xx) that must NOT
 * be retried — the same bad payload will always produce the same error.
 * 5xx / network errors ARE transient and safe to retry later.
 */
function isFalPermanentError(e: unknown): boolean {
  const s = falHttpStatus(e)
  return s !== undefined && s >= 400 && s < 500
}

fal.config({
  credentials: process.env.FAL_KEY,
})

export type VexoModel = "standard" | "veo3"
export type GenerationMode = "image" | "text"

const NEGATIVE_PROMPT =
  "blur, distort, low quality, deformed face, bad anatomy, watermark, text artifacts, " +
  "cartoon, CGI, 3d render, video game, plastic skin, waxy skin, over-saturated, " +
  "fake lighting, artificial, uncanny, glossy, overprocessed, AI look"

// Hidden style directive appended to every prompt. The user never writes this —
// it nudges the model toward natural, believable footage instead of the glossy,
// over-saturated "AI look". Kept short and light so it guides the look without
// overpowering the user's actual content (especially for short prompts).
const CINEMATIC_SUFFIX =
  "Photorealistic, natural lighting, realistic textures, true-to-life colors, smooth natural motion."

// Combine the user/scene prompt with the hidden cinematic directive. Skips the
// append if the prompt is empty so we never send a styling-only prompt.
function withCinematicStyle(prompt: string): string {
  const base = (prompt || "").trim()
  if (!base) return base
  return `${base}. ${CINEMATIC_SUFFIX}`
}

// Map VexoAi tiers to FAL.ai model endpoints (image-to-video + text-to-video)
// Endpoint slugs verified against fal.ai (2026-06).
const MODEL_MAP: Record<
  VexoModel,
  {
    imageEndpoint: string
    textEndpoint: string
    label: string
    engine: string
    maxDuration: number
    supportsAudio: boolean
  }
> = {
  standard: {
    // Kling 3.0 Standard — cinematic visuals, fluid motion, NATIVE AUDIO.
    // Big upgrade over 2.1: audio is generated inside the video (better lip-sync),
    // up to 15s, and reference elements for consistent characters.
    imageEndpoint: "fal-ai/kling-video/v3/standard/image-to-video",
    textEndpoint: "fal-ai/kling-video/v3/standard/text-to-video",
    label: "VexoAI Standard",
    engine: "Kling 3.0",
    maxDuration: 15,
    supportsAudio: true,
  },
  veo3: {
    // Google Veo 3.1 — highest fidelity, native audio. duration 4/6/8s only.
    imageEndpoint: "fal-ai/veo3.1/image-to-video",
    textEndpoint: "fal-ai/veo3.1",
    label: "VexoAI Cinematic",
    engine: "Google Veo 3.1",
    maxDuration: 8,
    supportsAudio: true,
  },
}

export function getModelInfo(model: VexoModel) {
  return MODEL_MAP[model]
}

// Client-safe metadata for the UI (no FAL import needed on the client).
export const MODEL_META: Record<
  VexoModel,
  { label: string; engine: string; maxDuration: number; supportsAudio: boolean }
> = {
  standard: {
    label: MODEL_MAP.standard.label,
    engine: MODEL_MAP.standard.engine,
    maxDuration: MODEL_MAP.standard.maxDuration,
    supportsAudio: MODEL_MAP.standard.supportsAudio,
  },
  veo3: {
    label: MODEL_MAP.veo3.label,
    engine: MODEL_MAP.veo3.engine,
    maxDuration: MODEL_MAP.veo3.maxDuration,
    supportsAudio: MODEL_MAP.veo3.supportsAudio,
  },
}

function getEndpoint(model: VexoModel, mode: GenerationMode) {
  return mode === "text" ? MODEL_MAP[model].textEndpoint : MODEL_MAP[model].imageEndpoint
}

// Kling 3.0 accepts any whole-second string from "3" to "15".
function klingDuration(requested: number | undefined): string {
  const d = Math.round(requested && requested > 0 ? requested : 5)
  return String(Math.min(Math.max(d, 3), 15))
}

// Veo 3.1 only accepts the strings "4s", "6s" or "8s".
function veoDuration(requested: number | undefined): "4s" | "6s" | "8s" {
  const d = requested || 8
  if (d >= 8) return "8s"
  if (d >= 6) return "6s"
  return "4s"
}

export interface VideoGenerationResult {
  requestId: string
  status: string
  videoUrl?: string
  model: VexoModel
  mode: GenerationMode
}

export async function createVideoGeneration(params: {
  mode: GenerationMode
  prompt: string
  imageUrl?: string
  duration?: number
  aspectRatio?: "16:9" | "9:16" | "1:1"
  model?: VexoModel
  generateAudio?: boolean
}): Promise<VideoGenerationResult> {
  const model: VexoModel = params.model || "standard"
  const mode: GenerationMode = params.mode
  const endpoint = getEndpoint(model, mode)
  const aspectRatio = params.aspectRatio || "16:9"
  // Apply the hidden cinematic/realism directive to every prompt.
  const styledPrompt = withCinematicStyle(params.prompt)

  let input: Record<string, unknown> = {}

  if (model === "veo3") {
    // Google Veo 3.1 — duration is "4s"/"6s"/"8s", native audio supported.
    input = {
      prompt: styledPrompt,
      aspect_ratio: aspectRatio === "1:1" ? "16:9" : aspectRatio,
      duration: veoDuration(params.duration),
      generate_audio: params.generateAudio !== false,
    }
    if (mode === "image" && params.imageUrl) {
      input.image_url = params.imageUrl
    }
  } else {
    // Kling 3.0 (standard) — native audio, duration "3".."15".
    // Note: image-to-video uses `start_image_url` (not `image_url`).
    input = {
      prompt: styledPrompt,
      duration: klingDuration(params.duration),
      negative_prompt: NEGATIVE_PROMPT,
      cfg_scale: 0.5,
      generate_audio: params.generateAudio !== false,
    }
    if (mode === "image" && params.imageUrl) {
      input.start_image_url = params.imageUrl
    } else {
      // text-to-video also accepts an aspect ratio
      input.aspect_ratio = aspectRatio
    }
  }

  try {
    const { request_id } = await fal.queue.submit(endpoint, { input })
    return {
      requestId: request_id,
      status: "processing",
      model,
      mode,
    }
  } catch (error) {
    logger.error("[v0] FAL video submit error", { err: toErrStr(error) })
    throw error
  }
}

// Backwards compatible alias
export async function createImageToVideo(params: {
  imageUrl: string
  prompt: string
  duration?: number
  aspectRatio?: "16:9" | "9:16" | "1:1"
  model?: VexoModel
  generateAudio?: boolean
}): Promise<VideoGenerationResult> {
  return createVideoGeneration({ ...params, mode: "image" })
}

// ── Kling AI Avatar v2 ────────────────────────────────────────────────────────
// Takes a portrait image + audio → talking head video with synced lip movement.
// Replaces the broken image-to-video → lipsync chain entirely.
export const KLING_AVATAR_ENDPOINT = "fal-ai/kling-video/ai-avatar/v2/standard"

export async function createAvatarVideo(params: {
  imageUrl: string
  audioUrl: string
  prompt?: string
}): Promise<{ requestId: string }> {
  const input = {
    image_url: params.imageUrl,
    audio_url: params.audioUrl,
    prompt: params.prompt || "Natural talking head, clear lip movement, looking at camera.",
    cfg_scale: 0.5,
    generate_audio: false,
  }
  try {
    const { request_id } = await fal.queue.submit(KLING_AVATAR_ENDPOINT, { input })
    return { requestId: request_id }
  } catch (error) {
    logger.error("[avatar] FAL submit error", { err: toErrStr(error) })
    throw error
  }
}

export async function getAvatarVideoStatus(requestId: string): Promise<{
  status: string
  videoUrl?: string
  progress?: number
}> {
  try {
    const status = await fal.queue.status(KLING_AVATAR_ENDPOINT, {
      requestId,
      logs: true,
    })
    if (status.status === "COMPLETED") {
      const res = (await fal.queue.result(KLING_AVATAR_ENDPOINT, { requestId })) as {
        data?: { video?: { url: string }; output?: { video?: { url: string } } }
      }
      const data = res.data
      const videoUrl = data?.video?.url || data?.output?.video?.url
      return { status: "succeed", videoUrl, progress: 100 }
    } else if ((status.status as string) === "FAILED") {
      return { status: "failed", progress: 0 }
    } else {
      return {
        status: "processing",
        progress: status.status === "IN_PROGRESS" ? 50 : 10,
      }
    }
  } catch (error) {
    if (isFalPermanentError(error)) {
      // 4xx (e.g. 422 Unprocessable Entity) — permanent validation failure.
      // Returning "failed" triggers an immediate refund and stops the retry loop.
      logger.error("[avatar] FAL permanent validation error — stopping retry", {
        httpStatus: falHttpStatus(error),
        detail: falErrorDetail(error),
        err: toErrStr(error),
      })
      return { status: "failed", progress: 0 }
    }
    logger.warn("[avatar] FAL status error (transient)", { err: toErrStr(error) })
    return { status: "processing", progress: 30 }
  }
}

export async function getVideoStatus(
  requestId: string,
  model: VexoModel = "standard",
  mode: GenerationMode = "image"
): Promise<{
  status: string
  videoUrl?: string
  progress?: number
}> {
  const endpoint = getEndpoint(model, mode)
  try {
    const status = await fal.queue.status(endpoint, {
      requestId,
      logs: true,
    })

    if (status.status === "COMPLETED") {
      // New client wraps the model output in `{ data, requestId }`.
      const res = (await fal.queue.result(endpoint, { requestId })) as {
        data?: { video?: { url: string }; output?: { video?: { url: string } } }
      }
      const data = res.data
      const videoUrl = data?.video?.url || data?.output?.video?.url

      return {
        status: "succeed",
        videoUrl,
        progress: 100,
      }
    } else if ((status.status as string) === "FAILED") {
      return { status: "failed", progress: 0 }
    } else {
      return {
        status: "processing",
        progress: status.status === "IN_PROGRESS" ? 50 : 10,
      }
    }
  } catch (error) {
    if (isFalPermanentError(error)) {
      logger.error("[v0] FAL permanent validation error — stopping retry", {
        httpStatus: falHttpStatus(error),
        detail: falErrorDetail(error),
        err: toErrStr(error),
      })
      return { status: "failed", progress: 0 }
    }
    logger.warn("[v0] FAL status check error (transient)", { err: toErrStr(error) })
    return { status: "processing", progress: 30 }
  }
}

// ── Lip-sync status ───────────────────────────────────────────────────────────
// Poll a lip-sync job by its stored FAL endpoint (`model`): "fal-ai/latentsync"
// (natural) or "fal-ai/sync-lipsync/v2" (pro). Used by /api/lipsync-status and
// the reconcile sweep so both resolve a job from the durable charge row's model,
// not in-memory state. A COMPLETED job WITHOUT an output video url is a terminal
// FAILURE for lip-sync (no usable result), reported as "failed" so it refunds.
// Transient errors are reported as "processing" so we never speculatively refund.
export async function getLipsyncStatus(
  requestId: string,
  model: string,
): Promise<{ status: "succeed" | "failed" | "processing"; videoUrl?: string }> {
  try {
    const status = await fal.queue.status(model, { requestId, logs: false })
    if (status.status === "COMPLETED") {
      const res = (await fal.queue.result(model, { requestId })) as {
        data?: { video?: { url?: string }; video_url?: string }
      }
      const videoUrl = res.data?.video?.url || res.data?.video_url
      return { status: videoUrl ? "succeed" : "failed", videoUrl }
    } else if ((status.status as string) === "FAILED") {
      return { status: "failed" }
    } else {
      return { status: "processing" }
    }
  } catch (error) {
    if (isFalPermanentError(error)) {
      logger.error("[lipsync] FAL permanent validation error — stopping retry", {
        httpStatus: falHttpStatus(error),
        detail: falErrorDetail(error),
        err: toErrStr(error),
      })
      return { status: "failed" }
    }
    logger.warn("[lipsync] FAL status error (transient)", { err: toErrStr(error) })
    return { status: "processing" }
  }
}
