// VideoBlueprint — the editable "Video Plan" artifact at the heart of the
// HeyGen-style Create flow. The agent produces it from a chat idea; the user
// reviews/edits it; only on approval do we charge credits and generate.
//
// This module is shared by the client (editor + cost estimate) and the server
// (the /api/blueprint agent endpoint), so it must stay free of server-only
// imports.

export type Orientation = "16:9" | "9:16" | "1:1"
export type BlueprintModel = "standard" | "veo3"

// a_roll = talking-head presenter (avatar image + narration -> Kling Avatar)
// b_roll = cinematic / descriptive footage (text/image -> video, optional voiceover)
export type SceneType = "a_roll" | "b_roll"

export type SceneStatus =
  | "idle"
  | "tts"
  | "video"
  | "polling"
  | "stitching"
  | "done"
  | "failed"

export interface VoiceRef {
  // Catalog id passed straight to /api/tts: "camb:<id>" (Mongolian studio) or a
  // gemini catalog id (global languages).
  voiceId: string
  lang: string
  name?: string
}

export interface AvatarRef {
  type: "none" | "upload" | "generated"
  imageUrl?: string
  label?: string
}

export interface Character {
  id: string
  avatar: AvatarRef
  voice: VoiceRef
}

export interface BlueprintScene {
  id: string
  type: SceneType
  durationSec: number
  // Mongolian narration the voice will speak. Required for a_roll, optional for
  // b_roll (a b_roll scene with no script is silent footage).
  script: string
  // English prompt that drives the video model (motion / cinematography).
  visualPrompt: string
  // Which character speaks in this scene (a_roll only).
  // 0 / undefined = primary (avatar+voice); 1+ = characters[n-1]
  characterIdx?: number

  // ── runtime fields, filled during generation (not sent by the agent) ──
  status?: SceneStatus
  progress?: number
  audioUrl?: string
  videoUrl?: string
  error?: string
}

export interface VideoBlueprint {
  id: string
  version: number
  title: string
  language: "mn" | "en"
  orientation: Orientation
  model: BlueprintModel
  captions: boolean
  // Approximate total runtime (sum of scene durations), informational.
  durationSec: number
  // Primary character (first actor)
  avatar: AvatarRef
  voice: VoiceRef
  // Additional characters (index 1, 2, …)
  characters?: Character[]
  scenes: BlueprintScene[]
}

export const DEFAULT_VOICE: VoiceRef = { voiceId: "gem-achernar", lang: "mn" }

function newId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID()
    }
  } catch {
    // fall through
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function newSceneId(): string {
  return newId()
}

const ORIENTATIONS: Orientation[] = ["16:9", "9:16", "1:1"]
const MODELS: BlueprintModel[] = ["standard", "veo3"]

function clampDuration(d: unknown, fallback = 8): number {
  const n = typeof d === "number" ? d : Number(d)
  if (!Number.isFinite(n)) return fallback
  return Math.min(Math.max(Math.round(n), 3), 15)
}

// Raw scene shape that the agent (Claude) returns — loose, normalized below.
export interface RawScene {
  type?: string
  durationSec?: number
  duration?: number
  script?: string
  narration?: string
  visualPrompt?: string
  summary?: string
}

export interface RawBlueprint {
  title?: string
  language?: string
  orientation?: string
  model?: string
  captions?: boolean
  scenes?: RawScene[]
}

// Turn the agent's loose JSON into a fully-formed, safe VideoBlueprint with ids,
// clamped values and runtime defaults. Used by the API route and when revising.
export function normalizeBlueprint(
  raw: RawBlueprint,
  opts: {
    fallbackLanguage?: "mn" | "en"
    fallbackModel?: BlueprintModel
    voice?: VoiceRef
    avatar?: AvatarRef
    keepId?: string
    version?: number
  } = {},
): VideoBlueprint {
  const language = raw.language === "en" ? "en" : opts.fallbackLanguage ?? "mn"
  const orientation = ORIENTATIONS.includes(raw.orientation as Orientation)
    ? (raw.orientation as Orientation)
    : "9:16"
  const model = MODELS.includes(raw.model as BlueprintModel)
    ? (raw.model as BlueprintModel)
    : opts.fallbackModel ?? "standard"

  const rawScenes = Array.isArray(raw.scenes) ? raw.scenes.slice(0, 6) : []
  const scenes: BlueprintScene[] = rawScenes.map((s) => {
    const type: SceneType = s.type === "b_roll" ? "b_roll" : "a_roll"
    const script = typeof s.script === "string" ? s.script : typeof s.narration === "string" ? s.narration : ""
    const visualPrompt =
      typeof s.visualPrompt === "string"
        ? s.visualPrompt
        : typeof s.summary === "string"
          ? s.summary
          : ""
    return {
      id: newSceneId(),
      type,
      durationSec: clampDuration(s.durationSec ?? s.duration),
      script: script.trim(),
      visualPrompt: visualPrompt.trim(),
      status: "idle",
      progress: 0,
    }
  })

  if (scenes.length === 0) {
    scenes.push({
      id: newSceneId(),
      type: "a_roll",
      durationSec: 8,
      script: "",
      visualPrompt: "",
      status: "idle",
      progress: 0,
    })
  }

  const durationSec = scenes.reduce((sum, s) => sum + s.durationSec, 0)

  return {
    id: opts.keepId ?? newId(),
    version: opts.version ?? 1,
    title: typeof raw.title === "string" && raw.title.trim() ? raw.title.trim() : "Шинэ видео",
    language,
    orientation,
    model,
    captions: Boolean(raw.captions),
    durationSec,
    avatar: opts.avatar ?? { type: "none" },
    voice: opts.voice ?? { ...DEFAULT_VOICE, lang: language },
    scenes,
  }
}

export function hasTalkingHead(bp: VideoBlueprint): boolean {
  return bp.scenes.some((s) => s.type === "a_roll")
}

export function recomputeDuration(bp: VideoBlueprint): number {
  return bp.scenes.reduce((sum, s) => sum + (s.durationSec || 0), 0)
}
