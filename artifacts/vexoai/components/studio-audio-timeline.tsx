"use client"

import { useRef } from "react"
import { Loader2, Mic, Play, RefreshCw, AlertCircle } from "lucide-react"

export type NarrationStatus = "idle" | "generating" | "ready" | "failed"

export interface AudioTimelineProps {
  // The scene's clip length in seconds — the full width of the track.
  windowSec: number
  // Current start delay (seconds) before the narration begins.
  offsetSec: number
  // Largest delay we allow (kept in sync with the server-side pad/merge clamps).
  maxOffsetSec: number
  onOffsetChange: (sec: number) => void
  status: NarrationStatus
  audioUrl?: string
  audioDurationSec?: number
  peaks?: number[]
  // false when the audio is MP3 (Gemini) and can't be decoded to a waveform.
  waveSupported?: boolean
  // Whether the scene has narration text to voice at all.
  hasText: boolean
  onGenerate: () => void
  locale: "en" | "mn"
}

// A per-scene audio timeline: shows the narration's waveform inside the scene's
// clip window and lets the user drag where the voice starts. Replaces the plain
// delay slider with a visual, draggable control. Built to be reused later for a
// full multi-track timeline (music, captions) by feeding it different clips.
export function AudioTimeline({
  windowSec,
  offsetSec,
  maxOffsetSec,
  onOffsetChange,
  status,
  audioUrl,
  audioDurationSec,
  peaks,
  waveSupported,
  hasText,
  onGenerate,
  locale,
}: AudioTimelineProps) {
  const t = (mn: string, en: string) => (locale === "mn" ? mn : en)
  const trackRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const dragRef = useRef<{ startX: number; startOffset: number } | null>(null)

  const windowDur = Math.max(0.1, windowSec)
  const maxOffset = Math.min(maxOffsetSec, windowDur)
  const offset = clamp(offsetSec, 0, maxOffset)
  // Visible clip width: how much of the window the narration covers from offset.
  const clipDur =
    audioDurationSec && audioDurationSec > 0 ? audioDurationSec : Math.max(0.5, windowDur - offset)
  const leftPct = (offset / windowDur) * 100
  const widthPct = Math.min(100 - leftPct, (clipDur / windowDur) * 100)
  // Audio runs past the end of the clip — final render will trim it.
  const overflow = offset + clipDur > windowDur + 0.05

  const ready = status === "ready" && !!audioUrl

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!ready) return
    e.preventDefault()
    // Capture on the clip itself so the drag keeps tracking even when the
    // pointer leaves the track bounds (and survives waveform re-renders).
    e.currentTarget.setPointerCapture?.(e.pointerId)
    dragRef.current = { startX: e.clientX, startOffset: offset }
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    const track = trackRef.current
    if (!drag || !track) return
    const w = track.getBoundingClientRect().width
    if (w <= 0) return
    const pxPerSec = w / windowDur
    const dSec = (e.clientX - drag.startX) / pxPerSec
    const next = clamp(drag.startOffset + dSec, 0, maxOffset)
    onOffsetChange(Math.round(next * 10) / 10)
  }
  const endDrag = () => {
    dragRef.current = null
  }

  const togglePlay = () => {
    const a = audioRef.current
    if (!a) return
    if (a.paused) {
      a.currentTime = 0
      a.play().catch(() => {})
    } else {
      a.pause()
    }
  }

  // Whole-second ruler ticks across the window.
  const ticks = Array.from({ length: Math.floor(windowDur) + 1 }, (_, i) => i)

  return (
    <div className="mt-3 rounded-xl border border-border bg-background/50 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Mic className="h-3.5 w-3.5" />
          {t("Дуу хоолойн цаг", "Voice timeline")}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="rounded-md bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent">
            {offset.toFixed(1)}
            {t("с", "s")}
          </span>
          {ready && (
            <button
              type="button"
              onClick={togglePlay}
              className="flex h-6 w-6 items-center justify-center rounded-md border border-border text-muted-foreground transition hover:text-foreground"
              aria-label={t("Сонсох", "Play")}
            >
              <Play className="h-3 w-3" />
            </button>
          )}
          <button
            type="button"
            onClick={onGenerate}
            disabled={!hasText || status === "generating"}
            className="flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground transition hover:text-foreground disabled:opacity-40"
          >
            {status === "generating" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            {ready ? t("Шинэчлэх", "Refresh") : t("Долгион харах", "Show waveform")}
          </button>
        </div>
      </div>

      {/* The track: 0..windowSec. Drag the clip to set where the voice starts. */}
      <div
        ref={trackRef}
        className="relative h-16 w-full select-none overflow-hidden rounded-lg border border-border bg-muted/30"
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
      >
        {/* Ruler ticks */}
        {ticks.map((s) => (
          <div
            key={s}
            className="absolute top-0 bottom-0 w-px bg-border/40"
            style={{ left: `${(s / windowDur) * 100}%` }}
          />
        ))}

        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center px-3 text-center">
            {status === "generating" ? (
              <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t("Дуу хоолой бэлдэж байна…", "Preparing voice…")}
              </span>
            ) : status === "failed" ? (
              <span className="flex items-center gap-1.5 text-[11px] text-destructive">
                <AlertCircle className="h-3.5 w-3.5" />
                {t("Бэлдэж чадсангүй — дахин оролдоно уу", "Couldn't prepare — try again")}
              </span>
            ) : (
              <span className="text-[11px] text-muted-foreground">
                {hasText
                  ? t(
                      "Долгионыг харж, чирж байрлуулахын тулд “Долгион харах” дар",
                      "Tap “Show waveform” to see and drag the voice",
                    )
                  : t("Энэ хэсэгт дуу хоолой алга", "No narration for this scene")}
              </span>
            )}
          </div>
        )}

        {ready && (
          <div
            className="absolute top-1.5 bottom-1.5 cursor-grab rounded-md border border-accent/50 bg-accent/10 active:cursor-grabbing"
            style={{ left: `${leftPct}%`, width: `${Math.max(4, widthPct)}%` }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onLostPointerCapture={endDrag}
            role="slider"
            aria-valuemin={0}
            aria-valuemax={maxOffset}
            aria-valuenow={offset}
            aria-label={t("Дуу эхлэх цаг", "Voice start time")}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") onOffsetChange(clamp(Math.round((offset - 0.1) * 10) / 10, 0, maxOffset))
              if (e.key === "ArrowRight") onOffsetChange(clamp(Math.round((offset + 0.1) * 10) / 10, 0, maxOffset))
            }}
          >
            {waveSupported && peaks && peaks.length > 0 ? (
              <div className="flex h-full w-full items-center gap-px overflow-hidden px-1">
                {peaks.map((p, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-full bg-accent/70"
                    style={{ height: `${Math.max(8, Math.min(100, p * 100))}%` }}
                  />
                ))}
              </div>
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(125,125,125,0.15)_4px,rgba(125,125,125,0.15)_8px)]">
                <span className="px-2 text-center text-[10px] text-muted-foreground">
                  {t("MP3 — долгион харагдахгүй", "MP3 — no waveform")}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground/60">
        <span>0{t("с", "s")}</span>
        <span>
          {windowDur.toFixed(0)}
          {t("с", "s")}
        </span>
      </div>

      <p className="mt-2 text-[11px] text-muted-foreground/60">
        {overflow
          ? t(
              "Дуу хоолой хэсгээс урт байна — эцсийн бичлэгт таслагдана.",
              "The voice is longer than the clip — it will be trimmed in the final video.",
            )
          : t(
              "Долгионыг чирж дуу хаанаас эхлэхийг тохируул. Ам нээгдэхээс өмнө завсарлага үлдээнэ.",
              "Drag the waveform to set where the voice starts, leaving a pause before the mouth opens.",
            )}
      </p>

      {audioUrl && <audio ref={audioRef} src={audioUrl} preload="none" className="hidden" />}
    </div>
  )
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}
