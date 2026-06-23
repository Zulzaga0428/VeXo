// Thin, typed fetch wrappers for the Create flow. All calls are made from the
// browser against the existing stateless API routes. Each wrapper returns a
// discriminated result so callers can show precise errors (out of credits,
// daily chat limit, etc.) instead of a generic failure.

import type { BlueprintModel, RawBlueprint, VideoBlueprint } from "@/lib/blueprint"

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string }

async function postJson<T>(url: string, body: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return { ok: false, status: res.status, error: (data && data.error) || `Request failed (${res.status})` }
    }
    return { ok: true, data: data as T }
  } catch {
    return { ok: false, status: 0, error: "Сүлжээний алдаа" }
  }
}

async function getJson<T>(url: string): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url)
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return { ok: false, status: res.status, error: (data && data.error) || `Request failed (${res.status})` }
    }
    return { ok: true, data: data as T }
  } catch {
    return { ok: false, status: 0, error: "Сүлжээний алдаа" }
  }
}

// ── Clarify ────────────────────────────────────────────────────────────────
export interface ClarifyQuestion {
  question: string
  options: string[]
}
export function clarifyIdea(idea: string, locale: "mn" | "en") {
  return postJson<{ needsClarification: boolean; questions: ClarifyQuestion[] }>("/api/clarify-idea", {
    idea,
    locale,
  })
}

// ── Blueprint (agent) ────────────────────────────────────────────────────────
export function requestBlueprint(input: {
  idea: string
  locale: "mn" | "en"
  model?: BlueprintModel
  currentBlueprint?: VideoBlueprint
}) {
  return postJson<{ reply: string; blueprint: RawBlueprint }>("/api/blueprint", input)
}

// ── TTS ──────────────────────────────────────────────────────────────────────
export function generateTts(text: string, voice: string, language: string) {
  return postJson<{ audioUrl: string; duration?: number }>("/api/tts", { text, voice, language })
}

// ── Image upload (avatar) ─────────────────────────────────────────────────────
export async function uploadImage(file: File): Promise<ApiResult<{ url: string }>> {
  try {
    const fd = new FormData()
    fd.append("file", file)
    const res = await fetch("/api/upload-image", { method: "POST", body: fd })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return { ok: false, status: res.status, error: (data && data.error) || "Зураг оруулахад алдаа гарлаа" }
    }
    return { ok: true, data: data as { url: string } }
  } catch {
    return { ok: false, status: 0, error: "Сүлжээний алдаа" }
  }
}

// ── Video (b_roll) ────────────────────────────────────────────────────────────
export function generateVideo(input: {
  mode: "text" | "image"
  prompt: string
  imageUrl?: string
  duration?: number
  aspectRatio?: string
  model?: BlueprintModel
  generateAudio?: boolean
}) {
  return postJson<{ requestId: string; status: string; model: string; mode: string }>(
    "/api/generate-video",
    input,
  )
}
export function videoStatus(requestId: string, model: string, mode: string) {
  return getJson<{ status: string; progress: number; videoUrl?: string }>(
    `/api/video-status?requestId=${encodeURIComponent(requestId)}&model=${model}&mode=${mode}`,
  )
}

// ── Avatar (a_roll talking head) ──────────────────────────────────────────────
export function generateAvatarVideo(input: { imageUrl: string; audioUrl: string; prompt?: string }) {
  return postJson<{ requestId: string }>("/api/avatar-video", input)
}
export function avatarStatus(requestId: string) {
  return getJson<{ status: string; progress: number; videoUrl?: string }>(
    `/api/avatar-status?requestId=${encodeURIComponent(requestId)}`,
  )
}

// ── Stitch ────────────────────────────────────────────────────────────────────
export function stitchVideo(input: {
  videoUrls: string[]
  aspectRatio?: string
  audioUrls?: (string | null)[]
  lipSync?: boolean
}) {
  return postJson<{ videoUrl: string }>("/api/stitch-video", input)
}

// ── Save to history ───────────────────────────────────────────────────────────
export function saveVideo(input: {
  videoUrl: string
  prompt: string
  voice?: string
  seriesCount?: number
  sceneIndex?: number
}) {
  return postJson<{ video: unknown; pathname: string }>("/api/save-video", input)
}

// ── AI avatar / image generation ──────────────────────────────────────────────
export function generateImage(input: { prompt: string; aspectRatio?: string; mode?: string }) {
  return postJson<{ images: { url: string }[] }>("/api/generate-image", { ...input, numImages: 1 })
}

// Poll a status endpoint until it succeeds, fails, or times out.
export async function pollUntilDone(
  poll: () => Promise<ApiResult<{ status: string; progress: number; videoUrl?: string }>>,
  opts: { onProgress?: (p: number) => void; intervalMs?: number; timeoutMs?: number } = {},
): Promise<{ ok: true; videoUrl: string } | { ok: false; error: string }> {
  const interval = opts.intervalMs ?? 4000
  const timeout = opts.timeoutMs ?? 6 * 60 * 1000
  const start = Date.now()
  // small initial delay so the job has time to register
  await new Promise((r) => setTimeout(r, 2500))
  while (Date.now() - start < timeout) {
    const res = await poll()
    if (res.ok) {
      const { status, progress, videoUrl } = res.data
      if (typeof progress === "number") opts.onProgress?.(progress)
      if ((status === "succeed" || status === "completed") && videoUrl) {
        return { ok: true, videoUrl }
      }
      if (status === "failed") {
        return { ok: false, error: "Видео үүсгэлт амжилтгүй боллоо" }
      }
    }
    await new Promise((r) => setTimeout(r, interval))
  }
  return { ok: false, error: "Хугацаа хэтэрлээ. Дахин оролдоно уу." }
}
