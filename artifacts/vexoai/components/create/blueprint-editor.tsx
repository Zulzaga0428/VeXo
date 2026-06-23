"use client"

import { useMemo } from "react"
import { Clapperboard, Film, Mic, Plus, Sparkles, Trash2, User, Wand2 } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  hasTalkingHead,
  newSceneId,
  recomputeDuration,
  type BlueprintModel,
  type BlueprintScene,
  type Orientation,
  type SceneType,
  type VideoBlueprint,
} from "@/lib/blueprint"
import { estimateBlueprintCredits } from "@/lib/blueprint-costs"
import { VoicePicker } from "@/components/studio-voice-picker"
import { AvatarPicker } from "@/components/create/avatar-picker"

interface BlueprintEditorProps {
  locale: "mn" | "en"
  blueprint: VideoBlueprint
  generating: boolean
  onChange: (bp: VideoBlueprint) => void
  onGenerate: () => void
}

const ORIENTATIONS: { value: Orientation; labelMn: string; labelEn: string }[] = [
  { value: "9:16", labelMn: "Босоо", labelEn: "Portrait" },
  { value: "16:9", labelMn: "Хэвтээ", labelEn: "Landscape" },
  { value: "1:1", labelMn: "Дөрвөлжин", labelEn: "Square" },
]

export function BlueprintEditor({ locale, blueprint, generating, onChange, onGenerate }: BlueprintEditorProps) {
  const t = (mn: string, en: string) => (locale === "mn" ? mn : en)

  const credits = useMemo(() => estimateBlueprintCredits(blueprint), [blueprint])
  const needsAvatar = hasTalkingHead(blueprint) && !blueprint.avatar.imageUrl
  const emptyScript = blueprint.scenes.some((s) => s.type === "a_roll" && !s.script.trim())
  const emptyVisual = blueprint.scenes.some(
    (s) => s.type === "b_roll" && !s.visualPrompt.trim() && !s.script.trim(),
  )
  const blocked = needsAvatar || emptyScript || emptyVisual || generating

  const patch = (p: Partial<VideoBlueprint>) => onChange({ ...blueprint, ...p })

  const patchScene = (id: string, p: Partial<BlueprintScene>) => {
    const scenes = blueprint.scenes.map((s) => (s.id === id ? { ...s, ...p } : s))
    onChange({ ...blueprint, scenes, durationSec: recomputeDuration({ ...blueprint, scenes }) })
  }

  const removeScene = (id: string) => {
    if (blueprint.scenes.length <= 1) return
    const scenes = blueprint.scenes.filter((s) => s.id !== id)
    onChange({ ...blueprint, scenes, durationSec: recomputeDuration({ ...blueprint, scenes }) })
  }

  const addScene = () => {
    const scene: BlueprintScene = {
      id: newSceneId(),
      type: "b_roll",
      durationSec: 8,
      script: "",
      visualPrompt: "",
      status: "idle",
      progress: 0,
    }
    const scenes = [...blueprint.scenes, scene]
    onChange({ ...blueprint, scenes, durationSec: recomputeDuration({ ...blueprint, scenes }) })
  }

  // Cycle orientation on each click
  const orientationIdx = ORIENTATIONS.findIndex((o) => o.value === blueprint.orientation)
  const currentOrientation = ORIENTATIONS[Math.max(0, orientationIdx)]
  const cycleOrientation = () => {
    const next = ORIENTATIONS[(orientationIdx + 1) % ORIENTATIONS.length]
    patch({ orientation: next.value })
  }

  // Toggle quality
  const cycleModel = () => {
    patch({ model: blueprint.model === "standard" ? "veo3" : "standard" })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-4 md:p-6">

        {/* Title */}
        <input
          value={blueprint.title}
          onChange={(e) => patch({ title: e.target.value })}
          className="w-full bg-transparent text-xl font-bold tracking-tight outline-none placeholder:text-muted-foreground/40"
          placeholder={t("Видеоны нэр", "Video title")}
        />

        {/* Compact metadata chips — orientation + quality */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Orientation chip — click to cycle */}
          <button
            onClick={cycleOrientation}
            title={t("Дараагийн хэлбэр рүү шилжих", "Cycle orientation")}
            className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/30 px-3 py-1 text-xs font-medium text-muted-foreground transition hover:border-accent/40 hover:bg-accent/5 hover:text-accent"
          >
            <span className="text-foreground/70">{t(currentOrientation.labelMn, currentOrientation.labelEn)}</span>
            <span className="opacity-50">·</span>
            <span className="font-mono opacity-60">{currentOrientation.value}</span>
          </button>

          {/* Quality chip — click to toggle */}
          <button
            onClick={cycleModel}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition",
              blueprint.model === "veo3"
                ? "border-accent/40 bg-accent/10 text-accent"
                : "border-border/60 bg-muted/30 text-muted-foreground hover:border-accent/40 hover:bg-accent/5 hover:text-accent",
            )}
          >
            <Film className="h-3 w-3" />
            {blueprint.model === "veo3" ? t("Кино чанар", "Cinematic") : t("Энгийн", "Standard")}
          </button>
        </div>

        {/* Avatar + Voice — side by side */}
        <div className="rounded-2xl border border-border/60 bg-card/60 p-4">
          <div className="flex gap-3">
            {/* Avatar — left half */}
            <div className="flex-1 min-w-0">
              <AvatarPicker
                locale={locale}
                avatar={blueprint.avatar}
                orientation={blueprint.orientation}
                required={hasTalkingHead(blueprint)}
                onChange={(avatar) => patch({ avatar })}
              />
            </div>

            {/* Divider */}
            <div className="w-px self-stretch bg-border/40 shrink-0" />

            {/* Voice — right half */}
            <div className="flex-1 min-w-0 space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                {t("Хоолой", "Voice")}
              </span>
              <VoicePicker
                value={{ voiceId: blueprint.voice.voiceId, lang: blueprint.voice.lang }}
                onChange={(sel) =>
                  patch({
                    voice: { ...blueprint.voice, voiceId: sel.voiceId, lang: sel.lang },
                    language: sel.lang === "en" ? "en" : "mn",
                  })
                }
                locale={locale}
              />
            </div>
          </div>
        </div>

        {/* Scenes */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">
              {t("Дүрүүд", "Scenes")}
              <span className="ml-1.5 rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent">
                {blueprint.scenes.length}
              </span>
            </span>
            <span className="text-xs text-muted-foreground">~{blueprint.durationSec}s</span>
          </div>

          {blueprint.scenes.map((scene, idx) => (
            <SceneCard
              key={scene.id}
              locale={locale}
              index={idx}
              scene={scene}
              canDelete={blueprint.scenes.length > 1}
              onChange={(p) => patchScene(scene.id, p)}
              onRemove={() => removeScene(scene.id)}
            />
          ))}

          <button
            onClick={addScene}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border/50 py-3 text-xs font-medium text-muted-foreground transition hover:border-accent/50 hover:bg-accent/5 hover:text-accent"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("Дүр нэмэх", "Add scene")}
          </button>
        </div>
      </div>

      {/* Generate bar */}
      <div className="border-t border-border/60 bg-card/80 p-4 backdrop-blur-sm">
        {needsAvatar && (
          <p className="mb-2.5 text-center text-xs text-destructive">
            {t("Эхлээд аватар зураг оруулна уу.", "Add an avatar image first.")}
          </p>
        )}
        {emptyScript && !needsAvatar && (
          <p className="mb-2.5 text-center text-xs text-destructive">
            {t("Танилцуулагч дүрийн яриаг бөглөнө үү.", "Fill in the script for presenter scenes.")}
          </p>
        )}
        {emptyVisual && !needsAvatar && !emptyScript && (
          <p className="mb-2.5 text-center text-xs text-destructive">
            {t("Дүрслэх дүр бүрт зураглал эсвэл текст оруулна уу.", "Add a visual prompt or text for every b-roll scene.")}
          </p>
        )}
        <button
          onClick={onGenerate}
          disabled={blocked}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-3.5 text-sm font-bold text-accent-foreground shadow-lg shadow-accent/25 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          <Sparkles className="h-4 w-4" />
          {t("Видео үүсгэх", "Generate video")}
          <span className="ml-1 rounded-full bg-accent-foreground/15 px-2 py-0.5 text-xs font-semibold">
            {credits} {t("кр", "cr")}
          </span>
        </button>
      </div>
    </div>
  )
}

function SceneCard({
  locale,
  index,
  scene,
  canDelete,
  onChange,
  onRemove,
}: {
  locale: "mn" | "en"
  index: number
  scene: BlueprintScene
  canDelete: boolean
  onChange: (p: Partial<BlueprintScene>) => void
  onRemove: () => void
}) {
  const t = (mn: string, en: string) => (locale === "mn" ? mn : en)
  const types: { value: SceneType; labelMn: string; labelEn: string; icon: typeof User }[] = [
    { value: "a_roll", labelMn: "Танилцуулагч", labelEn: "Presenter", icon: User },
    { value: "b_roll", labelMn: "Дүрслэл", labelEn: "Cinematic", icon: Clapperboard },
  ]

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-3.5 space-y-2.5">
      {/* Scene header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[10px] font-bold text-accent">
            {index + 1}
          </span>
          <div className="flex gap-1">
            {types.map((ty) => {
              const Icon = ty.icon
              return (
                <button
                  key={ty.value}
                  onClick={() => onChange({ type: ty.value })}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-all",
                    scene.type === ty.value
                      ? "bg-accent/15 text-accent ring-1 ring-accent/30"
                      : "border border-border/50 text-muted-foreground hover:border-accent/30 hover:text-foreground",
                  )}
                >
                  <Icon className="h-2.5 w-2.5" />
                  {t(ty.labelMn, ty.labelEn)}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="flex items-center overflow-hidden rounded-lg border border-border/50">
            <button
              onClick={() => onChange({ durationSec: Math.max(3, scene.durationSec - 1) })}
              className="flex h-5 w-5 items-center justify-center bg-muted/30 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              −
            </button>
            <span className="w-8 text-center text-[11px] tabular-nums">{scene.durationSec}s</span>
            <button
              onClick={() => onChange({ durationSec: Math.min(15, scene.durationSec + 1) })}
              className="flex h-5 w-5 items-center justify-center bg-muted/30 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              +
            </button>
          </div>
          {canDelete && (
            <button
              onClick={onRemove}
              className="flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground/40 transition hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Script */}
      <label className="block space-y-1">
        <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">
          <Mic className="h-2.5 w-2.5" />
          {scene.type === "a_roll" ? t("Яриа (заавал)", "Script (required)") : t("Хадмал яриа", "Voiceover (opt.)")}
        </span>
        <textarea
          value={scene.script}
          onChange={(e) => onChange({ script: e.target.value })}
          rows={2}
          placeholder={t("Дэлгэцэн дээр юу хэлэх вэ…", "What is said on screen…")}
          className="w-full resize-none rounded-xl border border-border/40 bg-muted/20 px-3 py-2 text-sm outline-none transition focus:border-accent/40 focus:ring-1 focus:ring-accent/15 placeholder:text-muted-foreground/40"
        />
      </label>

      {/* Visual prompt */}
      <label className="block space-y-1">
        <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">
          <Wand2 className="h-2.5 w-2.5" />
          {t("Дүрслэл (англиар)", "Visual prompt (EN)")}
        </span>
        <textarea
          value={scene.visualPrompt}
          onChange={(e) => onChange({ visualPrompt: e.target.value })}
          rows={2}
          placeholder={t("Юу харагдах вэ (англиар бичнэ)…", "What we see (write in English)…")}
          className="w-full resize-none rounded-xl border border-border/40 bg-muted/20 px-3 py-2 text-sm outline-none transition focus:border-accent/40 focus:ring-1 focus:ring-accent/15 placeholder:text-muted-foreground/40"
        />
      </label>
    </div>
  )
}
