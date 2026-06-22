import { fal } from "@fal-ai/client"

/**
 * camb.ai integration — high-quality Mongolian (and multilingual) TTS plus
 * voice cloning. Base API: https://client.camb.ai/apis
 *
 * Auth: every request carries `x-api-key: <CAMB_API_KEY>`.
 *
 * TTS uses the modern POST /tts-stream endpoint: one request, final audio
 * bytes returned directly in the response body. The legacy async flow
 * (POST /tts -> poll -> GET /tts-result/{run_id}) is DEPRECATED and was
 * verified to return the WRONG voice for cloned voice ids — never use it.
 * We upload the returned bytes to fal storage so the browser gets a stable
 * public URL, matching the other providers.
 */

const BASE = "https://client.camb.ai/apis"

// MARS speech models. mars-8.1 generation is the only one verified to
// faithfully reproduce cloned voices via the API (confirmed by ear against
// the user's real clone). Older mars-pro/mars-flash return a different timbre.
export type CambSpeechModel =
  | "mars-8.1-pro-beta"
  | "mars-8.1-flash-beta"
  | "mars-pro"
  | "mars-flash"
  | "mars-instruct"

export const DEFAULT_CAMB_MODEL: CambSpeechModel = "mars-8.1-pro-beta"

// SINGLE key only. We deliberately do NOT load-balance across multiple keys:
// voice ids are account-scoped, so a second key from a different account makes
// the same voice_id resolve to a completely different voice.
function nextKey(): string {
  const key = process.env.CAMB_API_KEY
  if (!key) throw new Error("CAMB_API_KEY is not set")
  return key
}

export function isCambConfigured(): boolean {
  return !!process.env.CAMB_API_KEY
}

function headers(apiKey: string, json = false): Record<string, string> {
  const h: Record<string, string> = { "x-api-key": apiKey }
  if (json) h["Content-Type"] = "application/json"
  return h
}

// tts-stream takes BCP-47-style locale codes (e.g. "mn-mn", "en-us"), not the
// legacy numeric language ids.
function langLocale(language?: string): string {
  if (!language) return "mn-mn"
  const l = language.toLowerCase()
  if (l.includes("-")) return l // already a locale code
  if (l === "mn" || l === "100") return "mn-mn"
  if (l === "en" || l === "1") return "en-us"
  if (l === "zh") return "zh-cn"
  if (l === "es") return "es-es"
  if (l === "hi") return "hi-in"
  if (l === "ar") return "ar-sa"
  if (l === "pt") return "pt-br"
  if (l === "ru") return "ru-ru"
  if (l === "ja") return "ja-jp"
  if (l === "ko") return "ko-kr"
  if (l === "fr") return "fr-fr"
  if (l === "de") return "de-de"
  if (l === "it") return "it-it"
  if (l === "tr") return "tr-tr"
  if (l === "vi") return "vi-vn"
  if (l === "id") return "id-id"
  if (l === "th") return "th-th"
  if (l === "pl") return "pl-pl"
  if (l === "uk") return "uk-ua"
  if (l === "nl") return "nl-nl"
  return `${l}-${l}`
}

export interface CambVoice {
  id: number
  name: string
  gender: number // 1 = male, 2 = female
  age: number | null
  language: number
  description: string | null
  tags: string[]
}

/** List every voice available on the account (includes cloned voices). */
export async function cambListVoices(): Promise<CambVoice[]> {
  const res = await fetch(`${BASE}/list-voices`, { headers: headers(nextKey()), cache: "no-store" })
  if (!res.ok) {
    throw new Error(`camb.ai list-voices failed: ${res.status}`)
  }
  const data = (await res.json()) as Array<Record<string, unknown>>
  if (!Array.isArray(data)) return []
  return data.map((v) => ({
    id: Number(v.id),
    name: String(v.voice_name ?? "Voice"),
    gender: Number(v.gender ?? 2),
    age: v.age == null ? null : Number(v.age),
    language: Number(v.language ?? 0),
    description: v.description == null ? null : String(v.description),
    tags: Array.isArray(v.tags) ? (v.tags as string[]) : [],
  }))
}

/**
 * Generate speech with camb.ai. Returns a public audio URL (uploaded to fal
 * storage). `voiceId` is the numeric camb voice id.
 */
export async function cambTextToSpeech(
  text: string,
  voiceId: number,
  opts: { language?: string; model?: CambSpeechModel } = {},
): Promise<{ audioUrl: string }> {
  if (!isCambConfigured()) {
    throw new Error("CAMB_API_KEY is not set")
  }

  const apiKey = nextKey()

  // Single request: tts-stream returns the final rendered audio directly.
  const res = await fetch(`${BASE}/tts-stream`, {
    method: "POST",
    headers: headers(apiKey, true),
    body: JSON.stringify({
      text,
      voice_id: voiceId,
      language: langLocale(opts.language),
      speech_model: opts.model ?? DEFAULT_CAMB_MODEL,
      output_configuration: { format: "wav" },
    }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    throw new Error(`camb.ai tts-stream failed: ${res.status} ${detail.slice(0, 200)}`)
  }
  const contentType = res.headers.get("content-type") || "audio/wav"
  const ext = contentType.includes("flac") ? "flac" : contentType.includes("mpeg") ? "mp3" : "wav"
  const bytes = await res.arrayBuffer()
  if (bytes.byteLength < 1000) {
    throw new Error("camb.ai tts-stream: empty audio returned")
  }

  // Upload to fal storage for a stable public URL.
  const file = new File([bytes], `camb-${voiceId}-${Date.now()}.${ext}`, { type: contentType })
  const audioUrl = await fal.storage.upload(file)
  return { audioUrl }
}
