"use client"

import { CheckCircle2, ChevronsLeft, ChevronsRight, FileText, Layers, Loader2, Video } from "lucide-react"
import { cn } from "@/lib/utils"
import type { VideoBlueprint } from "@/lib/blueprint"
import type { GenPhase } from "@/hooks/use-video-generation"
import { BlueprintPreview } from "@/components/create/blueprint-preview"

export type CreateView = "plan" | "generation"

interface ArtifactsPanelProps {
  locale: "mn" | "en"
  blueprint: VideoBlueprint | null
  phase: GenPhase
  finalUrl: string | null
  view: CreateView
  onSelectView: (v: CreateView) => void
  collapsed?: boolean
  onToggleCollapsed?: () => void
}

export function ArtifactsPanel({
  locale,
  blueprint,
  phase,
  finalUrl,
  view,
  onSelectView,
  collapsed = false,
  onToggleCollapsed,
}: ArtifactsPanelProps) {
  const t = (mn: string, en: string) => (locale === "mn" ? mn : en)

  // Collapsed rail — a narrow strip with just the expand control and view icons.
  if (collapsed) {
    return (
      <div className="flex h-full w-full flex-col items-center gap-1 py-3">
        {onToggleCollapsed && (
          <button
            onClick={onToggleCollapsed}
            title={t("Дэлгэх", "Expand")}
            aria-label={t("Дэлгэх", "Expand")}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <ChevronsRight className="h-4 w-4" />
          </button>
        )}
        <div className="my-1 h-px w-6 bg-border/60" />
        {blueprint && (
          <button
            onClick={() => onSelectView("plan")}
            title={t("Видео төлөвлөгөө", "Video Plan")}
            aria-label={t("Видео төлөвлөгөө", "Video Plan")}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg transition",
              view === "plan"
                ? "bg-accent/15 text-accent"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <FileText className="h-4 w-4" />
          </button>
        )}
        {phase !== "idle" && (
          <button
            onClick={() => onSelectView("generation")}
            title={phase === "done" ? t("Бэлэн видео", "Final Video") : t("Үүсгэлт", "Generation")}
            aria-label={phase === "done" ? t("Бэлэн видео", "Final Video") : t("Үүсгэлт", "Generation")}
            className={cn(
              "relative flex h-8 w-8 items-center justify-center rounded-lg transition",
              view === "generation"
                ? "bg-accent/15 text-accent"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {phase === "running" ? <Loader2 className="h-4 w-4 animate-spin text-accent" /> : <Video className="h-4 w-4" />}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 items-center gap-2 border-b border-border px-4">
        <Layers className="h-4 w-4 text-accent" />
        <span className="text-sm font-medium">{t("Бүтээл", "Creations")}</span>
        {onToggleCollapsed && (
          <button
            onClick={onToggleCollapsed}
            title={t("Нарийсгах", "Collapse")}
            aria-label={t("Нарийсгах", "Collapse")}
            className="ml-auto flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <ChevronsLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {!blueprint && (
          <p className="px-1 py-8 text-center text-xs text-muted-foreground">
            {t("Төлөвлөгөө гармагц энд харагдана.", "Your plan will appear here.")}
          </p>
        )}

        {blueprint && (
          <button
            onClick={() => onSelectView("plan")}
            className={cn(
              "w-full rounded-xl border p-3 text-left transition",
              view === "plan"
                ? "border-accent bg-accent/5"
                : "border-border bg-card hover:border-accent/50",
            )}
          >
            <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
              {t("Видео төлөвлөгөө", "Video Plan")}
            </div>
            <BlueprintPreview locale={locale} blueprint={blueprint} />
          </button>
        )}

        {phase !== "idle" && (
          <button
            onClick={() => onSelectView("generation")}
            className={cn(
              "w-full rounded-xl border p-3 text-left transition",
              view === "generation"
                ? "border-accent bg-accent/5"
                : "border-border bg-card hover:border-accent/50",
            )}
          >
            <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Video className="h-3.5 w-3.5" />
              {phase === "done" ? t("Бэлэн видео", "Final Video") : t("Үүсгэлт", "Generation")}
            </div>
            <div className="flex items-center gap-2 text-sm">
              {phase === "running" && <Loader2 className="h-4 w-4 animate-spin text-accent" />}
              {phase === "done" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
              {phase === "error" && <Video className="h-4 w-4 text-destructive" />}
              <span className="text-muted-foreground">
                {phase === "running" && t("Үүсгэж байна…", "Generating…")}
                {phase === "done" && t("Бэлэн боллоо", "Ready")}
                {phase === "error" && t("Алдаа гарлаа", "Failed")}
              </span>
            </div>
            {finalUrl && phase === "done" && (
              <video src={finalUrl} className="mt-2 w-full rounded-md border border-border" muted />
            )}
          </button>
        )}
      </div>
    </div>
  )
}
