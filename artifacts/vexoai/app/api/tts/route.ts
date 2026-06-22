import { NextRequest, NextResponse } from "next/server"
import { fal } from "@fal-ai/client"
import { geminiTextToSpeech } from "@/lib/gemini-tts"
import { cambTextToSpeech } from "@/lib/cambai"
import { getVoiceById } from "@/lib/voices-catalog"
import { expandNumbersToMongolian } from "@/lib/number-to-words"
import { chargeCredits, refundCredits, CREDIT_COST } from "@/lib/credits"

fal.config({ credentials: process.env.FAL_KEY })

// Cloned-voice TTS can take a while for long text, so allow the full
// serverless budget.
export const maxDuration = 120

// Estimate audio duration (seconds) from a WAV buffer header.
function wavDuration(buf: ArrayBuffer): number | undefined {
  try {
    const view = new DataView(buf)
    // byteRate lives at offset 28 (little-endian) in a standard WAV header.
    const byteRate = view.getUint32(28, true)
    if (!byteRate) return undefined
    return (buf.byteLength - 44) / byteRate
  } catch {
    return undefined
  }
}

export async function POST(request: NextRequest) {
  try {
    const { text, voice, language } = await request.json()

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Text is required" }, { status: 400 })
    }

    if (text.length > 4000) {
      return NextResponse.json({ error: "Text too long (max 4000 characters)" }, { status: 400 })
    }

    const voiceMeta = voice ? getVoiceById(voice) : undefined

    const charge = await chargeCredits(CREDIT_COST.tts)
    if (!charge.ok) {
      return NextResponse.json({ error: charge.error }, { status: charge.status })
    }

    let audioBuffer: ArrayBuffer | null = null
    let directUrl: string | null = null
    let contentType = "audio/wav"

    try {
      if (typeof voice === "string" && voice.startsWith("camb:")) {
        // camb.ai studio voice (premium Mongolian + cloned voices) by numeric id.
        // camb's Mongolian voices don't read raw numerals, so expand digits to
        // spoken Mongolian words first ("12" -> "арван хоёр").
        const cambId = Number(voice.slice("camb:".length))
        const spokenText = expandNumbersToMongolian(text)
        const { audioUrl: cambUrl } = await cambTextToSpeech(spokenText, cambId, {
          language: language || "mn",
        })
        directUrl = cambUrl
        contentType = "audio/wav"
      } else if (voiceMeta?.provider === "gemini") {
        // Global languages via Gemini TTS (fal, FAL_KEY). Returns a public mp3.
        const { audioUrl: geminiUrl } = await geminiTextToSpeech(
          text,
          voiceMeta.providerVoiceId,
          { language: language || voiceMeta.language },
        )
        directUrl = geminiUrl
        contentType = "audio/mpeg"
      } else {
        // No silent fallback to a different voice — surface a clear error so the
        // wrong (low-quality) engine can never sneak in.
        throw new Error("Unsupported voice. Pick a studio (camb.ai) or global (Gemini) voice.")
      }
    } catch (e) {
      await refundCredits(charge.userId, CREDIT_COST.tts)
      throw e
    }

    // Gemini (via fal) already returns a hosted public URL — use it directly.
    if (directUrl) {
      return NextResponse.json({ audioUrl: directUrl })
    }

    // Other providers return raw audio bytes. Upload them to FAL storage so
    // they get a public URL the ffmpeg merge step (and client) can fetch.
    let audioUrl: string
    try {
      const ext = contentType === "audio/mpeg" ? "mp3" : "wav"
      const file = new File([audioBuffer!], `tts-${Date.now()}.${ext}`, { type: contentType })
      audioUrl = await fal.storage.upload(file)
    } catch (e) {
      await refundCredits(charge.userId, CREDIT_COST.tts)
      throw e
    }

    const duration =
      contentType === "audio/wav" && audioBuffer ? wavDuration(audioBuffer) : undefined

    return NextResponse.json({ audioUrl, duration })
  } catch (error) {
    console.error("TTS error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "TTS generation failed" },
      { status: 500 }
    )
  }
}
