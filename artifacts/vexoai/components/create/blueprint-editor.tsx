"use client"

import { useMemo } from "react"
import { Clapperboard, Mic, Plus, Sparkles, Trash2, User, Wand2 } from "lucide-react"
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

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-5 overflow-y-auto p-4 md:p-6">
        {/* Title */}
        <input
          value={blueprint.title}
          onChange={(e) => patch({ title: e.target.value })}
          className="w-full bg-transparent text-xl font-semibold outline-none placeholder:text-muted-foreground"
          placeholder={t("Видеоны нэр", "Video title")}
        />

        {/* Details */}
        <div className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">{t("Хэлбэр", "Orientation")}</span>
            <div className="flex gap-1.5">
              {ORIENTATIONS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => patch({ orientation: o.value })}
                  className={cn(
                    "flex-1 rounded-lg border px-2 py-1.5 text-xs transition",
                    blueprint.orientation === o.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/40",
                  )}
                >
                  {t(o.labelMn, o.labelEn)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">{t("Чанар", "Quality")}</span>
            <div className="flex gap-1.5">
              {(["standard", "veo3"] as BlueprintModel[]).map((m) => (
                <button
                  key={m}
                  onClick={() => patch({ model: m })}
                  className={cn(
                    "flex-1 rounded-lg border px-2 py-1.5 text-xs transition",
                    blueprint.model === m
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/40",
                  )}
                >
                  {m === "veo3" ? t("Кино", "Cinematic") : t("Энгийн", "Standard")}
                </button>
              ))}
            </div>
          </div>

          <div className="sm:col-span-2">
            <AvatarPicker
              locale={locale}
              avatar={blueprint.avatar}
              orientation={blueprint.orientation}
              required={hasTalkingHead(blueprint)}
              onChange={(avatar) => patch({ avatar })}
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <span className="text-xs font-medium text-muted-foreground">{t("Хоолой", "Voice")}</span>
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

        {/* Scenes */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {t("Дүрүүд", "Scenes")} ({blueprint.scenes.length})
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
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-3 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
          >
            <Plus className="h-4 w-4" />
            {t("Дүр нэмэх", "Add scene")}
          </button>
        </div>
      </div>

      {/* Generate bar */}
      <div className="border-t border-border bg-card/80 p-4 backdrop-blur">
        {needsAvatar && (
          <p className="mb-2 text-center text-xs text-destructive">
            {t("Эхлээд аватар зураг оруулна уу.", "Add an avatar image first.")}
          </p>
        )}
        {emptyScript && !needsAvatar && (
          <p className="mb-2 text-center text-xs text-destructive">
            {t("Танилцуулагч дүрийн яриаг бөглөнө үү.", "Fill in the script for presenter scenes.")}
          </p>
        )}
        {emptyVisual && !needsAvatar && !emptyScript && (
          <p className="mb-2 text-center text-xs text-destructive">
            {t("Дүрслэх дүр бүрт зураглал эсвэл текст оруулна уу.", "Add a visual prompt or text for every b-roll scene.")}
          </p>
        )}
        <button
          onClick={onGenerate}
          disabled={blocked}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" />
          {t("Видео үүсгэх", "Generate video")} · {credits} {t("кредит", "credits")}
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
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-xs font-medium">
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
                    "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition",
                    scene.type === ty.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40",
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {t(ty.labelMn, ty.labelEn)}
                </button>
              )
            })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <button
              onClick={() => onChange({ durationSec: Math.max(3, scene.durationSec - 1) })}
              className="flex h-5 w-5 items-center justify-center rounded border border-border hover:bg-muted"
            >
              −
            </button>
            <span className="w-8 text-center tabular-nums">{scene.durationSec}s</span>
            <button
              onClick={() => onChange({ durationSec: Math.min(15, scene.durationSec + 1) })}
              className="flex h-5 w-5 items-center justify-center rounded border border-border hover:bg-muted"
            >
              +
            </button>
          </div>
          {canDelete && (
            <button onClick={onRemove} className="text-muted-foreground transition hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <label className="block space-y-1">
        <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
          <Mic className="h-3 w-3" />
          {scene.type === "a_roll" ? t("Яриа (заавал)", "Script (required)") : t("Хадмал яриа", "Voiceover (optional)")}
        </span>
        <textarea
          value={scene.script}
          onChange={(e) => onChange({ script: e.target.value })}
          rows={2}
          placeholder={t("Дэлгэцэн дээр юу хэлэх вэ…", "What is said on screen…")}
          className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/40"
        />
      </label>

      <label className="block space-y-1">
        <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
          <Wand2 className="h-3 w-3" />
          {t("Дүрслэл (англиар)", "Visual prompt (English)")}
        </span>
        <textarea
          value={scene.visualPrompt}
          onChange={(e) => onChange({ visualPrompt: e.target.value })}
          rows={2}
          placeholder={t("Юу харагдах вэ (англиар бичнэ)…", "What we see (write in English)…")}
          className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/40"
        />
      </label>
    </div>
  )
}
