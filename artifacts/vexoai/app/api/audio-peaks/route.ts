import { NextRequest, NextResponse } from "next/server"
import { logger, toErrStr } from "@/lib/logger"
import { createClient } from "@/lib/supabase/server"
import { fetchPublicResource } from "@/lib/safe-url"

export const maxDuration = 60

// Compute a downsampled waveform (peak amplitudes) + duration for a narration
// clip. Done server-side so we dodge browser CORS limits when decoding camb.ai /
// FAL audio. Only PCM/float WAV is decodable here (camb.ai voices); MP3 (Gemini
// global voices) returns supported:false so the client shows a plain block.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { audioUrl, peakCount } = await request.json()
    if (!audioUrl || typeof audioUrl !== "string") {
      return NextResponse.json({ error: "audioUrl is required" }, { status: 400 })
    }

    const count =
      typeof peakCount === "number" && Number.isFinite(peakCount)
        ? Math.min(400, Math.max(20, Math.round(peakCount)))
        : 96

    let buffer: Buffer
    try {
      ;({ buffer } = await fetchPublicResource(audioUrl))
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Fetch failed" },
        { status: 400 },
      )
    }

    const result = computeWavPeaks(buffer, count)
    if (!result) {
      // Not a PCM/float WAV we can decode — caller falls back to a plain block.
      return NextResponse.json({ supported: false, peaks: null, duration: null })
    }
    return NextResponse.json({ supported: true, peaks: result.peaks, duration: result.duration })
  } catch (error) {
    logger.error("[audio-peaks] error:", { err: toErrStr(error) })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Peaks failed" },
      { status: 500 },
    )
  }
}

// Walk a canonical WAV's chunks and downsample channel 0 into `count` peak
// buckets (max absolute amplitude per bucket, normalized to 0..1). Returns null
// if the buffer isn't a PCM (1) or IEEE-float (3) WAV we can read.
function computeWavPeaks(
  buf: Buffer,
  count: number,
): { peaks: number[]; duration: number } | null {
  if (buf.length < 44) return null
  if (buf.toString("ascii", 0, 4) !== "RIFF") return null
  if (buf.toString("ascii", 8, 12) !== "WAVE") return null

  let pos = 12
  let audioFormat = 0
  let bitsPerSample = 16
  let byteRate = 0
  let blockAlign = 0
  let dataStart = -1
  let dataSize = 0
  while (pos + 8 <= buf.length) {
    const id = buf.toString("ascii", pos, pos + 4)
    const size = buf.readUInt32LE(pos + 4)
    const body = pos + 8
    if (id === "fmt ") {
      // A canonical PCM/float fmt chunk is 16 bytes; bail on truncated headers
      // instead of reading past the buffer (would throw a 500).
      if (body + 16 > buf.length) return null
      audioFormat = buf.readUInt16LE(body)
      byteRate = buf.readUInt32LE(body + 8)
      blockAlign = buf.readUInt16LE(body + 12) || 1
      bitsPerSample = buf.readUInt16LE(body + 14) || 16
    } else if (id === "data") {
      dataStart = body
      dataSize = Math.min(size, buf.length - body)
      break
    }
    pos = body + size + (size % 2)
  }

  if (dataStart < 0 || !byteRate || !blockAlign) return null
  const isFloat = audioFormat === 3
  if (audioFormat !== 1 && !isFloat) return null
  const bytesPerSample = bitsPerSample / 8
  if (![1, 2, 3, 4].includes(bytesPerSample)) return null

  const duration = dataSize / byteRate
  const frameCount = Math.floor(dataSize / blockAlign)
  if (frameCount <= 0) return null

  const buckets = Math.min(count, frameCount)
  const framesPerBucket = frameCount / buckets
  const maxInt = Math.pow(2, bitsPerSample - 1)

  // Read channel 0's sample for a frame, normalized to roughly [-1, 1].
  const readSample = (frameIndex: number): number => {
    const off = dataStart + frameIndex * blockAlign
    if (off + bytesPerSample > buf.length) return 0
    if (isFloat) return bytesPerSample === 4 ? buf.readFloatLE(off) : 0
    if (bytesPerSample === 1) return (buf.readUInt8(off) - 128) / 128 // 8-bit unsigned
    if (bytesPerSample === 2) return buf.readInt16LE(off) / maxInt
    if (bytesPerSample === 3) {
      let v = buf[off] | (buf[off + 1] << 8) | (buf[off + 2] << 16)
      if (v & 0x800000) v |= ~0xffffff // sign-extend 24-bit
      return v / maxInt
    }
    if (bytesPerSample === 4) return buf.readInt32LE(off) / maxInt
    return 0
  }

  // Cap samples scanned per bucket so long clips stay fast.
  const stride = Math.max(1, Math.floor(framesPerBucket / 200))
  const peaks: number[] = new Array(buckets).fill(0)
  for (let b = 0; b < buckets; b++) {
    const start = Math.floor(b * framesPerBucket)
    const end = Math.min(frameCount, Math.floor((b + 1) * framesPerBucket))
    let peak = 0
    for (let f = start; f < end; f += stride) {
      const amp = Math.abs(readSample(f))
      if (amp > peak) peak = amp
    }
    peaks[b] = Math.min(1, peak)
  }

  // Normalize so the loudest peak hits ~1 — quiet narration still looks lively.
  const max = peaks.reduce((m, v) => Math.max(m, v), 0)
  if (max > 0) {
    for (let i = 0; i < peaks.length; i++) peaks[i] = Math.round((peaks[i] / max) * 1000) / 1000
  }
  return { peaks, duration }
}
