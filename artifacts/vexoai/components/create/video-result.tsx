"use client"

import { useState } from "react"
import { Download, Plus, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"
import type { VideoBlueprint } from "@/lib/blueprint"
import type { SceneProgress } from "@/hooks/use-video-generation"

interface VideoResultProps {
  locale: "mn" | "en"
  blueprint: VideoBlueprint
  finalUrl: string
  scenes: SceneProgress[]
  onNewVideo: () => void
  onBackToPlan: () => void
}

export function VideoResult({
  locale,
  blueprint,
  finalUrl,
  scenes,
  onNewVideo,
  onBackToPlan,
}: VideoResultProps) {
  const t = (mn: string, en: string) => (locale === "mn" ? mn : en)
  const [active, setActive] = useState<string>(finalUrl)

  const sceneClips = scenes.filter((s) => s.videoUrl)

  return (
    <div className="flex h-full flex-col p-4 md:p-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="truncate text-lg font-semibold">{blueprint.title}</h2>
        <span className="rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
          {t("Бэлэн", "Ready")}
        </span>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-hidden rounded-xl border border-border bg-black/90">
        <video
          key={active}
          src={active}
          controls
          autoPlay
          className={cn(
            "max-h-full",
            blueprint.orientation === "9:16" ? "h-full w-auto" : "w-full",
          )}
        />
      </div>

      {sceneClips.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setActive(finalUrl)}
            className={cn(
              "shrink-0 rounded-lg border px-3 py-1.5 text-xs transition",
              active === finalUrl ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40",
            )}
          >
            {t("Бүтэн", "Full")}
          </button>
          {sceneClips.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setActive(s.videoUrl!)}
              className={cn(
                "shrink-0 rounded-lg border px-3 py-1.5 text-xs transition",
                active === s.videoUrl ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40",
              )}
            >
              {t("Дүр", "Scene")} {i + 1}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href={finalUrl}
          download
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
        >
          <Download className="h-4 w-4" />
          {t("Татах", "Download")}
        </a>
        <button
          onClick={onBackToPlan}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-sm font-medium transition hover:bg-muted"
        >
          <RotateCcw className="h-4 w-4" />
          {t("Засах", "Edit plan")}
        </button>
        <button
          onClick={onNewVideo}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-sm font-medium transition hover:bg-muted"
        >
          <Plus className="h-4 w-4" />
          {t("Шинэ видео", "New video")}
        </button>
      </div>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        {t("Видео таны бичлэгүүдэд хадгалагдлаа.", "Saved to your videos.")}
      </p>
    </div>
  )
}
