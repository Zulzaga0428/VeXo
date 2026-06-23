"use client"

import { Mic, User, Film } from "lucide-react"
import { cn } from "@/lib/utils"
import type { VideoBlueprint } from "@/lib/blueprint"

// Compact, read-only thumbnail of a plan — used as the "Video Plan" artifact card.
export function BlueprintPreview({
  locale,
  blueprint,
}: {
  locale: "mn" | "en"
  blueprint: VideoBlueprint
}) {
  const t = (mn: string, en: string) => (locale === "mn" ? mn : en)
  const frame =
    blueprint.orientation === "9:16"
      ? "aspect-[9/16] w-12"
      : blueprint.orientation === "1:1"
        ? "aspect-square w-16"
        : "aspect-video w-20"

  return (
    <div className="flex gap-3">
      <div className={cn("shrink-0 overflow-hidden rounded-md border border-border bg-muted", frame)}>
        <div className="flex h-full w-full items-center justify-center">
          <Film className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{blueprint.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
          <span>{blueprint.orientation}</span>
          <span>·</span>
          <span>{blueprint.model === "veo3" ? "Cinematic" : "Standard"}</span>
          <span>·</span>
          <span>
            {blueprint.scenes.length} {t("дүр", "scenes")}
          </span>
          <span>·</span>
          <span>~{blueprint.durationSec}s</span>
        </div>
        <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <User className="h-3 w-3" />
            {blueprint.scenes.filter((s) => s.type === "a_roll").length}
          </span>
          <span className="inline-flex items-center gap-1">
            <Mic className="h-3 w-3" />
            {blueprint.scenes.filter((s) => s.script.trim()).length}
          </span>
        </div>
      </div>
    </div>
  )
}
