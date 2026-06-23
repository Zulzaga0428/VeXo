"use client"

import { CheckCircle2, FileText, Layers, Loader2, Video } from "lucide-react"
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
}

export function ArtifactsPanel({
  locale,
  blueprint,
  phase,
  finalUrl,
  view,
  onSelectView,
}: ArtifactsPanelProps) {
  const t = (mn: string, en: string) => (locale === "mn" ? mn : en)

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Layers className="h-4 w-4 text-accent" />
        <span className="text-sm font-medium">{t("Артефактууд", "Artifacts")}</span>
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
