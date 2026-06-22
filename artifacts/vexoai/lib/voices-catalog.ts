// Unified voice catalog.
//
// Mongolian is served EXCLUSIVELY by camb.ai studio / cloned voices, which are
// loaded separately in the picker via /api/camb-voices.
//
// "Global" languages (English, Chinese, Russian, …) are served by Gemini TTS
// (via fal, FAL_KEY). The picker steers the accent with a language code and
// always uses a single neutral timbre.
//
// Tengri, ElevenLabs and MiniMax were removed — they produced low-quality /
// wrong-accent Mongolian and were the source of the "ugly fallback voice" bug.

export type VoiceProvider = "gemini"
export type VoiceGender = "male" | "female"

export interface VoiceMeta {
  id: string
  provider: VoiceProvider
  providerVoiceId: string // Gemini timbre name
  name: string
  nameMn: string
  gender: VoiceGender
  desc: string
  descMn: string
  language: string // BCP-like code: "en", "zh", "ru", …
  languageLabel: string
  languageLabelMn: string
}

export const VOICES: VoiceMeta[] = [
  // ─── Neutral global timbre (used for every "Global" language) ───
  {
    id: "gem-achernar",
    provider: "gemini",
    providerVoiceId: "Achernar",
    name: "Achernar",
    nameMn: "Ачернар",
    gender: "female",
    desc: "Soft, neutral",
    descMn: "Зөөлөн",
    language: "en",
    languageLabel: "English",
    languageLabelMn: "Англи",
  },

  // ─── ENGLISH (Gemini TTS — natural) ───
  {
    id: "en-gem-puck",
    provider: "gemini",
    providerVoiceId: "Puck",
    name: "Puck",
    nameMn: "Пак",
    gender: "male",
    desc: "Upbeat, lively",
    descMn: "Хөгжилтэй",
    language: "en",
    languageLabel: "English",
    languageLabelMn: "Англи",
  },
  {
    id: "en-gem-aoede",
    provider: "gemini",
    providerVoiceId: "Aoede",
    name: "Aoede",
    nameMn: "Аоэде",
    gender: "female",
    desc: "Breezy, warm",
    descMn: "Зөөлөн",
    language: "en",
    languageLabel: "English",
    languageLabelMn: "Англи",
  },
]

export function getVoiceById(id: string): VoiceMeta | undefined {
  return VOICES.find((v) => v.id === id)
}

export type LanguageGroup = {
  code: string
  label: string
  labelMn: string
  voices: VoiceMeta[]
}

export function getLanguageGroups(): LanguageGroup[] {
  const order = ["en"]
  const groups: Record<string, LanguageGroup> = {}

  for (const v of VOICES) {
    if (!groups[v.language]) {
      groups[v.language] = {
        code: v.language,
        label: v.languageLabel,
        labelMn: v.languageLabelMn,
        voices: [],
      }
    }
    groups[v.language].voices.push(v)
  }

  return order.filter((code) => groups[code]).map((code) => groups[code])
}
