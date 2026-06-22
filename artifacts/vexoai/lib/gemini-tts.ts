// Gemini TTS via fal — Google's Gemini TTS models served through fal.ai.
// Uses the existing FAL_KEY (no separate Google API key needed) and speaks
// every supported language, Mongolian included. Returns a public audio URL.

import { fal } from "@fal-ai/client"

fal.config({ credentials: process.env.FAL_KEY })

// Map our app language code → fal Gemini `language_code` enum value.
// Gemini auto-detects when unset, but steering improves quality/accent.
const LANGUAGE_CODE: Record<string, string> = {
  mn: "Mongolian (Mongolia)",
  en: "English (US)",
  zh: "Chinese Mandarin (China)",
  es: "Spanish (Spain)",
  hi: "Hindi (India)",
  ar: "Arabic (Egypt)",
  pt: "Portuguese (Brazil)",
  ru: "Russian (Russia)",
  ja: "Japanese (Japan)",
  ko: "Korean (South Korea)",
  fr: "French (France)",
  de: "German (Germany)",
  it: "Italian (Italy)",
  tr: "Turkish (Turkey)",
  vi: "Vietnamese (Vietnam)",
  id: "Indonesian (Indonesia)",
  th: "Thai (Thailand)",
  pl: "Polish (Poland)",
  uk: "Ukrainian (Ukraine)",
  nl: "Dutch (Netherlands)",
}

export function isGeminiConfigured(): boolean {
  return !!process.env.FAL_KEY
}

export interface GeminiTtsResult {
  audioUrl: string
  contentType: "audio/mpeg"
}

/**
 * Generate speech with Google's Gemini TTS, served through fal.
 * `voiceName` is one of the 30 Gemini voices (e.g. "Achernar", "Charon").
 * Returns a public mp3 URL the merge step and client can fetch directly.
 */
export async function geminiTextToSpeech(
  text: string,
  voiceName: string,
  opts?: { language?: string; styleInstructions?: string },
): Promise<GeminiTtsResult> {
  const language = opts?.language
  const result = await fal.subscribe("fal-ai/gemini-tts", {
    // The fal SDK types `voice` and `language_code` as strict string-literal
    // unions, but we resolve these dynamically at runtime, so cast the input.
    input: {
      prompt: text,
      voice: voiceName,
      model: "gemini-2.5-flash-tts",
      output_format: "mp3",
      ...(opts?.styleInstructions
        ? { style_instructions: opts.styleInstructions }
        : {}),
      ...(language && LANGUAGE_CODE[language]
        ? { language_code: LANGUAGE_CODE[language] }
        : {}),
    } as never,
  })

  const url = (result?.data as { audio?: { url?: string } })?.audio?.url
  if (!url) {
    throw new Error("Gemini TTS returned no audio")
  }
  return { audioUrl: url, contentType: "audio/mpeg" }
}
