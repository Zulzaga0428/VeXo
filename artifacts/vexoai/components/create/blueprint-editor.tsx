"use client"

import { useMemo, useState } from "react"
import { Clapperboard, Film, Mic, Plus, Sparkles, Trash2, User, Wand2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  hasTalkingHead,
  newSceneId,
  recomputeDuration,
  type BlueprintModel,
  type BlueprintScene,
  type Character,
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
  const [selectedCharIdx, setSelectedCharIdx] = useState(0)

  const credits = useMemo(() => estimateBlueprintCredits(blueprint), [blueprint])

  // All characters: index 0 = primary (bp.avatar + bp.voice), 1+ = bp.characters
  const allCharacters: Character[] = useMemo(
    () => [
      { id: "__primary__", avatar: blueprint.avatar, voice: blueprint.voice },
      ...(blueprint.characters ?? []),
    ],
    [blueprint.avatar, blueprint.voice, blueprint.characters],
  )
  const currentChar = allCharacters[Math.min(selectedCharIdx, allCharacters.length - 1)]

  const needsAvatar = hasTalkingHead(blueprint) && !blueprint.avatar.imageUrl
  const emptyScript = blueprint.scenes.some((s) => s.type === "a_roll" && !s.script.trim())
  const emptyVisual = blueprint.scenes.some(
    (s) => s.type === "b_roll" && !s.visualPrompt.trim() && !s.script.trim(),
  )
  const blocked = needsAvatar || emptyScript || emptyVisual || generating

  const patch = (p: Partial<VideoBlueprint>) => onChange({ ...blueprint, ...p })

  const updateCharacter = (idx: number, p: Partial<Character>) => {
    if (idx === 0) {
      if (p.avatar !== undefined) patch({ avatar: p.avatar })
      if (p.voice !== undefined) patch({ voice: p.voice })
    } else {
      const chars = [...(blueprint.characters ?? [])]
      chars[idx - 1] = { ...chars[idx - 1], ...p }
      patch({ characters: chars })
    }
  }

  const addCharacter = () => {
    const newChar: Character = {
      id: newSceneId(),
      avatar: { type: "none" },
      voice: { ...blueprint.voice },
    }
    const newChars = [...(blueprint.characters ?? []), newChar]
    patch({ characters: newChars })
    setSelectedCharIdx(newChars.length) // select new (index = length because primary is at 0)
  }

  const removeCharacter = (idx: number) => {
    if (idx === 0) return
    const chars = [...(blueprint.characters ?? [])]
    chars.splice(idx - 1, 1)
    const scenes = blueprint.scenes.map((s) => {
      if ((s.characterIdx ?? 0) === idx) return { ...s, characterIdx: 0 }
      if ((s.characterIdx ?? 0) > idx) return { ...s, characterIdx: (s.characterIdx ?? 0) - 1 }
      return s
    })
    patch({ characters: chars, scenes })
    setSelectedCharIdx((prev) => Math.min(prev, chars.length))
  }

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

  const orientationIdx = ORIENTATIONS.findIndex((o) => o.value === blueprint.orientation)
  const currentOrientation = ORIENTATIONS[Math.max(0, orientationIdx)]
  const cycleOrientation = () => {
    const next = ORIENTATIONS[(orientationIdx + 1) % ORIENTATIONS.length]
    patch({ orientation: next.value })
  }

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

        {/* Compact metadata chips */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={cycleOrientation}
            title={t("Дараагийн хэлбэр рүү шилжих", "Cycle orientation")}
            className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/30 px-3 py-1 text-xs font-medium text-muted-foreground transition hover:border-accent/40 hover:bg-accent/5 hover:text-accent"
          >
            <span className="text-foreground/70">{t(currentOrientation.labelMn, currentOrientation.labelEn)}</span>
            <span className="opacity-50">·</span>
            <span className="font-mono opacity-60">{currentOrientation.value}</span>
          </button>

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

        {/* Characters section */}
        <div className="rounded-2xl border border-border/60 bg-card/60 p-4 space-y-3">
          {/* Character tabs — only visible when 2+ characters */}
          {allCharacters.length > 1 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {allCharacters.map((char, idx) => (
                <button
                  key={char.id}
                  onClick={() => setSelectedCharIdx(idx)}
                  className={cn(
                    "relative flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition select-none",
                    selectedCharIdx === idx
                      ? "bg-accent/15 text-accent ring-1 ring-accent/30"
                      : "border border-border/50 text-muted-foreground hover:border-accent/30 hover:text-foreground",
                  )}
                >
                  <div className="flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded-full border border-current/20 bg-muted">
                    {char.avatar.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={char.avatar.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <User className="h-2.5 w-2.5" />
                    )}
                  </div>
                  {idx === 0 ? t("Үндсэн", "Main") : `${t("Дүр", "Actor")} ${idx + 1}`}
                  {idx > 0 && (
                    <span
                      role="button"
                      onClick={(e) => { e.stopPropagation(); removeCharacter(idx) }}
                      className="ml-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-current/50 hover:text-destructive transition"
                    >
                      <X className="h-2.5 w-2.5" />
                    </span>
                  )}
                </button>
              ))}
              <button
                onClick={addCharacter}
                className="flex items-center gap-1 rounded-full border border-dashed border-border/50 px-2.5 py-1 text-xs text-muted-foreground transition hover:border-accent/50 hover:text-accent"
              >
                <Plus className="h-3 w-3" />
                {t("Нэмэх", "Add")}
              </button>
            </div>
          )}

          {/* Avatar + Voice editor */}
          <div className="flex gap-3">
            <div className="min-w-0 flex-1">
              <AvatarPicker
                locale={locale}
                avatar={currentChar.avatar}
                orientation={blueprint.orientation}
                required={selectedCharIdx === 0 && hasTalkingHead(blueprint)}
                onChange={(avatar) => updateCharacter(selectedCharIdx, { avatar })}
              />
            </div>
            <div className="w-px shrink-0 self-stretch bg-border/40" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                {t("Хоолой", "Voice")}
              </span>
              <VoicePicker
                value={{ voiceId: currentChar.voice.voiceId, lang: currentChar.voice.lang }}
                onChange={(sel) =>
                  updateCharacter(selectedCharIdx, { voice: { ...currentChar.voice, ...sel } })
                }
                locale={locale}
              />
            </div>
          </div>

          {/* Add character — subtle link, only when single character */}
          {allCharacters.length === 1 && (
            <button
              onClick={addCharacter}
              className="flex items-center gap-1 text-[11px] text-muted-foreground/50 transition hover:text-accent"
            >
              <Plus className="h-3 w-3" />
              {t("Дүр нэмэх", "Add character")}
            </button>
          )}
        </div>

        {/* Scenes */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">
              {t("Хэсгүүд", "Scenes")}
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
              characters={allCharacters}
              onChange={(p) => patchScene(scene.id, p)}
              onRemove={() => removeScene(scene.id)}
            />
          ))}

          <button
            onClick={addScene}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border/50 py-3 text-xs font-medium text-muted-foreground transition hover:border-accent/50 hover:bg-accent/5 hover:text-accent"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("Хэсэг нэмэх", "Add scene")}
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
  characters,
  onChange,
  onRemove,
}: {
  locale: "mn" | "en"
  index: number
  scene: BlueprintScene
  canDelete: boolean
  characters: Character[]
  onChange: (p: Partial<BlueprintScene>) => void
  onRemove: () => void
}) {
  const t = (mn: string, en: string) => (locale === "mn" ? mn : en)
  const types: { value: SceneType; labelMn: string; labelEn: string; icon: typeof User }[] = [
    { value: "a_roll", labelMn: "Танилцуулагч", labelEn: "Presenter", icon: User },
    { value: "b_roll", labelMn: "Дүрслэл", labelEn: "Cinematic", icon: Clapperboard },
  ]

  const charIdx = scene.characterIdx ?? 0

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
          {/* Character selector — only for a_roll with multiple characters */}
          {scene.type === "a_roll" && characters.length > 1 && (
            <div className="flex items-center gap-0.5">
              {characters.map((char, idx) => (
                <button
                  key={char.id}
                  title={idx === 0 ? t("Үндсэн дүр", "Main actor") : `${t("Дүр", "Actor")} ${idx + 1}`}
                  onClick={() => onChange({ characterIdx: idx })}
                  className={cn(
                    "flex h-5 w-5 items-center justify-center overflow-hidden rounded-full border transition",
                    charIdx === idx
                      ? "border-accent ring-1 ring-accent/40"
                      : "border-border/50 opacity-50 hover:opacity-100",
                  )}
                >
                  {char.avatar.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={char.avatar.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <User className="h-3 w-3 text-muted-foreground" />
                  )}
                </button>
              ))}
            </div>
          )}

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
