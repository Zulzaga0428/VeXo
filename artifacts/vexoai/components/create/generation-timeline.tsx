"use client"

import { useState } from "react"
import { Download, Play, RotateCcw, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { VideoBlueprint } from "@/lib/blueprint"
import type { GenPhase, SceneProgress } from "@/hooks/use-video-generation"

interface GenerationTimelineProps {
  locale: "mn" | "en"
  blueprint: VideoBlueprint
  scenes: SceneProgress[]
  phase: GenPhase
  error: string | null
  finalUrl?: string | null
  onRetry: () => void
  onBackToPlan: () => void
  onNewVideo?: () => void
}

function CornerBracket({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  return (
    <div
      className={cn(
        "absolute h-7 w-7",
        pos === "tl" && "left-4 top-4 border-l-2 border-t-2 border-white/20",
        pos === "tr" && "right-4 top-4 border-r-2 border-t-2 border-white/20",
        pos === "bl" && "bottom-4 left-4 border-b-2 border-l-2 border-white/20",
        pos === "br" && "bottom-4 right-4 border-b-2 border-r-2 border-white/20",
      )}
    />
  )
}

export function GenerationTimeline({
  locale,
  blueprint,
  scenes,
  phase,
  error,
  finalUrl,
  onRetry,
  onBackToPlan,
  onNewVideo,
}: GenerationTimelineProps) {
  const t = (mn: string, en: string) => (locale === "mn" ? mn : en)
  const [playing, setPlaying] = useState(false)

  const isDone = phase === "done" && !!finalUrl
  const isError = phase === "error"
  const isPaused = phase === "paused"

  const overall = isDone
    ? 100
    : scenes.length > 0
      ? Math.round(
          scenes.reduce((sum, s) => sum + (s.status === "done" ? 100 : s.progress), 0) /
            scenes.length,
        )
      : 0

  const shortId = blueprint.id.slice(0, 6).toUpperCase()
  const totalSec = Math.round(blueprint.durationSec)
  const sceneCount = blueprint.scenes.length
  const orientation = blueprint.orientation

  const phaseLabel = isDone
    ? t("БЭЛЭН БОЛЛОО", "DONE")
    : isError
      ? t("АЛДАА ГАРЛАА", "FAILED")
      : isPaused
        ? t("ТАСАРСАН", "PAUSED")
        : t("БОЛОВСРУУЛЖ БАЙНА...", "PROCESSING...")

  const statusRight = isDone
    ? t("БЭЛЭН ✓", "READY ✓")
    : isError
      ? t("АЛДАА", "ERROR")
      : t("АЖИЛЛАЖ БАЙНА", "RUNNING")

  const currentStep = (() => {
    if (isDone || isError) return null
    const active = scenes.find(
      (s) => s.status !== "idle" && s.status !== "done" && s.status !== "failed",
    )
    if (!active) return null
    const idx = scenes.findIndex((s) => s.id === active.id)
    const labels: Record<string, string> = {
      tts: t("Хоолой үүсгэж байна…", "Generating voice…"),
      video: t("Видео эхлүүлж байна…", "Starting video…"),
      polling: t("Видео боловсруулж байна…", "Rendering video…"),
      stitching: t("Нийлүүлж байна…", "Stitching scenes…"),
    }
    return `${t("ДҮР", "SCENE")} ${idx + 1} — ${labels[active.status] ?? active.status.toUpperCase()}`
  })()

  return (
    <div
      className="relative flex h-full flex-col overflow-hidden bg-[#090909]"
      style={{
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)
        `,
        backgroundSize: "44px 44px",
      }}
    >
      {/* Corner brackets */}
      <CornerBracket pos="tl" />
      <CornerBracket pos="tr" />
      <CornerBracket pos="bl" />
      <CornerBracket pos="br" />

      {/* Top bar */}
      <div className="flex items-center justify-between px-6 pt-5 text-[11px] font-mono tracking-widest text-white/30">
        <span>
          <span
            className={cn(
              "mr-1.5 inline-block h-1.5 w-1.5 rounded-full",
              isDone ? "bg-[#00e5c8]" : isError ? "bg-red-500" : "animate-pulse bg-[#00e5c8]",
            )}
          />
          {isDone ? t("DONE", "DONE") : isError ? t("ERROR", "ERROR") : t("RUNNING", "RUNNING")}
          {" / BLUEPRINT"}
        </span>
        <span>
          {"ID: "}
          {shortId}
          {" · "}
          {statusRight}
        </span>
      </div>

      {/* Center content */}
      <div className="flex flex-1 flex-col items-center justify-center px-6">
        {/* V Logo */}
        <div
          className={cn(
            "mb-6 h-20 w-20 transition-all duration-500",
            !isDone && !isError && "animate-pulse",
          )}
        >
          <img
            src="/vexo-logo.png"
            alt="VexoAI"
            className="h-full w-full object-contain"
            style={{
              filter: isDone
                ? "drop-shadow(0 0 24px rgba(0,229,200,0.55)) drop-shadow(0 0 60px rgba(0,229,200,0.2))"
                : isError
                  ? "drop-shadow(0 0 16px rgba(239,68,68,0.5))"
                  : "drop-shadow(0 0 12px rgba(0,229,200,0.25))",
            }}
          />
        </div>

        {/* Main status text */}
        <h1 className="mb-2 text-center text-2xl font-black tracking-[0.18em] text-white">
          {phaseLabel}
        </h1>

        {/* Metadata row */}
        <p className="mb-1 font-mono text-[13px] tracking-widest text-[#00e5c8]/70">
          {totalSec}
          {"S · "}
          {sceneCount}
          {t(" ДҮР · ", " SCENE · ")}
          {orientation}
        </p>

        {/* Active step (running) */}
        {currentStep && (
          <p className="mt-1 text-[11px] tracking-widest text-white/30">{currentStep}</p>
        )}

        {/* Error message */}
        {(isError || isPaused) && error && (
          <p className="mt-2 max-w-xs text-center text-xs text-red-400/80">{error}</p>
        )}

        {/* Done: video player inline */}
        {isDone && finalUrl && playing && (
          <div className="relative mt-6 w-full max-w-sm overflow-hidden rounded-xl border border-white/10 bg-black shadow-2xl">
            <button
              onClick={() => setPlaying(false)}
              className="absolute right-2 top-2 z-10 rounded-full bg-black/60 p-1 text-white/60 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
            <video
              src={finalUrl}
              autoPlay
              controls
              className={cn(
                "max-h-64 w-full",
                orientation === "9:16" ? "h-64 w-auto mx-auto" : "w-full",
              )}
            />
          </div>
        )}
      </div>

      {/* Progress bar + watermark */}
      <div className="px-6 pb-2">
        <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-white/25">
          <span>VexoAI Studio</span>
          <span>{overall}%</span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/8">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${overall}%`,
              background: isDone
                ? "linear-gradient(90deg, #00e5c8, #00c4a8)"
                : isError
                  ? "#ef4444"
                  : "linear-gradient(90deg, #00e5c8, #00b8a4)",
            }}
          />
        </div>
      </div>

      {/* Action buttons */}
      <div className="px-6 pb-6 pt-3">
        {isDone && finalUrl ? (
          <div className="flex gap-3">
            <button
              onClick={() => setPlaying((v) => !v)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              <Play className="h-4 w-4" />
              {t("Тоглуулах", "Play")}
            </button>
            <a
              href={finalUrl}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-black transition hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #00e5c8, #c4272f)" }}
            >
              <Download className="h-4 w-4" />
              {t("ТАТАХ", "DOWNLOAD")}
            </a>
          </div>
        ) : isError || isPaused ? (
          <div className="flex gap-2">
            <button
              onClick={onBackToPlan}
              className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm font-medium text-white/60 transition hover:bg-white/5"
            >
              {t("Төлөвлөгөө рүү", "Back to plan")}
            </button>
            <button
              onClick={onRetry}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#00e5c8] py-2.5 text-sm font-bold text-black transition hover:opacity-90"
            >
              <RotateCcw className="h-4 w-4" />
              {isPaused ? t("Үргэлжлүүлэх", "Resume") : t("Дахин оролдох", "Retry")}
            </button>
          </div>
        ) : (
          <p className="text-center text-[11px] tracking-wider text-white/20">
            {t("Хаалгахгүй байна уу — видео бэлдэж байна", "Keep this open while your video renders")}
          </p>
        )}
      </div>
    </div>
  )
}
