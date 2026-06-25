import { NextRequest, NextResponse } from "next/server"
import { logger, toErrStr } from "@/lib/logger"
import { fal } from "@fal-ai/client"
import { createClient } from "@/lib/supabase/server"

fal.config({ credentials: process.env.FAL_KEY })

export const maxDuration = 60

// Prepend N seconds of silence to a narration clip so a speaker stays quiet
// before talking (keeps the mouth closed at the top of a lip-synced shot, since
// the engine drives the mouth from the audio). Done server-side so we avoid
// browser CORS limits, and natively for PCM WAV (camb.ai voices). Non-WAV input
// is returned unchanged with padded:false so the caller can decide what to do.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { audioUrl, seconds } = await request.json()
    if (!audioUrl || typeof audioUrl !== "string") {
      return NextResponse.json({ error: "audioUrl is required" }, { status: 400 })
    }
    try {
      if (new URL(audioUrl).protocol !== "https:") {
        return NextResponse.json({ error: "Only https URLs allowed" }, { status: 400 })
      }
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
    }

    const raw = typeof seconds === "number" && Number.isFinite(seconds) ? seconds : 0.5
    const pad = Math.min(5, Math.max(0, raw))
    if (pad === 0) {
      return NextResponse.json({ url: audioUrl, padded: false })
    }

    const resp = await fetch(audioUrl)
    if (!resp.ok) {
      return NextResponse.json({ url: audioUrl, padded: false })
    }
    const buf = Buffer.from(await resp.arrayBuffer())

    const padded = prependWavSilence(buf, pad)
    if (!padded) {
      // Not a PCM WAV we can safely edit — return the original untouched.
      return NextResponse.json({ url: audioUrl, padded: false })
    }

    const blob = new Blob([padded], { type: "audio/wav" })
    const url = await fal.storage.upload(blob)
    return NextResponse.json({ url, padded: true })
  } catch (error) {
    logger.error("[pad-audio] error:", { err: toErrStr(error) })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Pad failed" },
      { status: 500 },
    )
  }
}

// Insert leading silence into a canonical PCM WAV by walking its chunks. Returns
// null if the buffer isn't a PCM WAV we can safely edit.
function prependWavSilence(buf: Buffer, seconds: number): Buffer | null {
  if (buf.length < 44) return null
  if (buf.toString("ascii", 0, 4) !== "RIFF") return null
  if (buf.toString("ascii", 8, 12) !== "WAVE") return null

  let pos = 12
  let audioFormat = 0
  let byteRate = 0
  let blockAlign = 0
  let dataStart = -1
  let dataSize = 0
  while (pos + 8 <= buf.length) {
    const id = buf.toString("ascii", pos, pos + 4)
    const size = buf.readUInt32LE(pos + 4)
    const body = pos + 8
    if (id === "fmt ") {
      audioFormat = buf.readUInt16LE(body)
      byteRate = buf.readUInt32LE(body + 8)
      blockAlign = buf.readUInt16LE(body + 12)
    } else if (id === "data") {
      dataStart = body
      dataSize = size
      break
    }
    // Chunks are word-aligned, so skip an extra padding byte on odd sizes.
    pos = body + size + (size % 2)
  }

  if (audioFormat !== 1) return null // PCM only
  if (!byteRate || !blockAlign || dataStart < 0) return null

  let silenceBytes = Math.round(seconds * byteRate)
  silenceBytes -= silenceBytes % blockAlign // align to a whole frame
  if (silenceBytes <= 0) return null

  const header = buf.subarray(0, dataStart) // RIFF/WAVE header incl. the data id+size
  const data = buf.subarray(dataStart, dataStart + dataSize)
  const silence = Buffer.alloc(silenceBytes) // zero-filled = silence
  const out = Buffer.concat([header, silence, data])

  // Fix the size fields: RIFF size = total - 8; data chunk size grows by silence.
  out.writeUInt32LE(out.length - 8, 4)
  out.writeUInt32LE(dataSize + silenceBytes, dataStart - 4)
  return out
}
