"use client"

import { AlertCircle, CheckCircle2, Clapperboard, Loader2, RotateCcw, User } from "lucide-react"
import { cn } from "@/lib/utils"
import type { VideoBlueprint } from "@/lib/blueprint"
import type { GenPhase, SceneProgress } from "@/hooks/use-video-generation"

interface GenerationTimelineProps {
  locale: "mn" | "en"
  blueprint: VideoBlueprint
  scenes: SceneProgress[]
  phase: GenPhase
  error: string | null
  onRetry: () => void
  onBackToPlan: () => void
}

export function GenerationTimeline({
  locale,
  blueprint,
  scenes,
  phase,
  error,
  onRetry,
  onBackToPlan,
}: GenerationTimelineProps) {
  const t = (mn: string, en: string) => (locale === "mn" ? mn : en)

  const statusLabel = (s: SceneProgress["status"]): string => {
    switch (s) {
      case "tts":
        return t("Хоолой бэлдэж байна…", "Generating voice…")
      case "video":
        return t("Видео эхлүүлж байна…", "Starting video…")
      case "polling":
        return t("Видео үүсгэж байна…", "Rendering video…")
      case "stitching":
        return t("Нийлүүлж байна…", "Stitching…")
      case "done":
        return t("Бэлэн", "Done")
      case "failed":
        return t("Амжилтгүй", "Failed")
      default:
        return t("Хүлээгдэж байна", "Queued")
    }
  }

  const overall = scenes.length
    ? Math.round(scenes.reduce((sum, s) => sum + (s.status === "done" ? 100 : s.progress), 0) / scenes.length)
    : 0

  return (
    <div className="flex h-full flex-col p-4 md:p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">{blueprint.title}</h2>
        <p className="text-xs text-muted-foreground">
          {phase === "running" && t("Видеог бүтээж байна. Хаалгахгүй байна уу.", "Building your video. Keep this open.")}
          {phase === "error" && t("Зарим дүр амжилтгүй боллоо.", "Some scenes failed.")}
          {phase === "paused" &&
            t(
              "Дуусаагүй видео сэргээгдлээ. Үлдсэн дүрсийг үргэлжлүүлээрэй.",
              "Unfinished video recovered. Resume to finish the remaining scenes.",
            )}
        </p>
      </div>

      {phase === "running" && (
        <div className="mb-4">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${overall}%` }} />
          </div>
        </div>
      )}

      <div className="flex-1 space-y-2 overflow-y-auto">
        {blueprint.scenes.map((scene, idx) => {
          const prog = scenes.find((s) => s.id === scene.id) ?? { status: "idle" as const, progress: 0 }
          const Icon = scene.type === "a_roll" ? User : Clapperboard
          return (
            <div key={scene.id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium">
                  {idx + 1}
                </span>
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{scene.script || scene.visualPrompt || t("Дүр", "Scene")}</p>
                  <p
                    className={cn(
                      "text-[11px]",
                      prog.status === "failed" ? "text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {prog.status === "failed" && prog.error ? prog.error : statusLabel(prog.status)}
                  </p>
                </div>
                <div className="shrink-0">
                  {prog.status === "done" ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : prog.status === "failed" ? (
                    <AlertCircle className="h-5 w-5 text-destructive" />
                  ) : prog.status === "idle" ? (
                    <span className="text-[11px] text-muted-foreground">—</span>
                  ) : (
                    <Loader2 className="h-5 w-5 animate-spin text-accent" />
                  )}
                </div>
              </div>
              {prog.status !== "idle" && prog.status !== "done" && prog.status !== "failed" && (
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${prog.progress}%` }} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {(phase === "error" || phase === "paused") && (
        <div className="mt-4 space-y-2">
          {error && <p className="text-center text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={onBackToPlan}
              className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium transition hover:bg-muted"
            >
              {t("Төлөвлөгөө рүү", "Back to plan")}
            </button>
            <button
              onClick={onRetry}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent py-2.5 text-sm font-semibold text-accent-foreground transition hover:opacity-90"
            >
              <RotateCcw className="h-4 w-4" />
              {phase === "paused" ? t("Үргэлжлүүлэх", "Resume") : t("Дахин оролдох", "Retry")}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
