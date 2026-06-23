"use client"

import { useMemo } from "react"
import { Clapperboard, Film, Mic, Plus, Sparkles, Trash2, User, Wand2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import {
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

  const credits = useMemo(() => estimateBlueprintCredits(blueprint), [blueprint])

  // All characters: index 0 = primary (bp.avatar + bp.voice), 1+ = bp.characters
  const allCharacters: Character[] = useMemo(
    () => [
      { id: "__primary__", avatar: blueprint.avatar, voice: blueprint.voice },
      ...(blueprint.characters ?? []),
    ],
    [blueprint.avatar, blueprint.voice, blueprint.characters],
  )

  const needsAvatar = blueprint.scenes.some((s) => {
    if (s.type !== "a_roll") return false
    const c = allCharacters[s.characterIdx ?? 0] ?? allCharacters[0]
    return !c.avatar.imageUrl
  })
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
      if (!chars[idx - 1]) return // guard against out-of-range index
      chars[idx - 1] = { ...chars[idx - 1], ...p }
      patch({ characters: chars })
    }
  }

  // Add a new character AND assign it to the given scene — in a single atomic
  // update so the two patches don't clobber each other off the same snapshot.
  const addCharacterToScene = (sceneId: string) => {
    const newChar: Character = {
      id: newSceneId(),
      avatar: { type: "none" },
      voice: { ...blueprint.voice },
    }
    const newChars = [...(blueprint.characters ?? []), newChar]
    const newIdx = newChars.length // new char's index in allCharacters (primary at 0)
    const scenes = blueprint.scenes.map((s) =>
      s.id === sceneId ? { ...s, characterIdx: newIdx } : s,
    )
    onChange({ ...blueprint, characters: newChars, scenes })
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
              orientation={blueprint.orientation}
              language={blueprint.language}
              onChange={(p) => patchScene(scene.id, p)}
              onRemove={() => removeScene(scene.id)}
              onUpdateCharacter={updateCharacter}
              onAddCharacter={() => addCharacterToScene(scene.id)}
              onRemoveCharacter={removeCharacter}
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
  orientation,
  language,
  onChange,
  onRemove,
  onUpdateCharacter,
  onAddCharacter,
  onRemoveCharacter,
}: {
  locale: "mn" | "en"
  index: number
  scene: BlueprintScene
  canDelete: boolean
  characters: Character[]
  orientation: Orientation
  language: "mn" | "en"
  onChange: (p: Partial<BlueprintScene>) => void
  onRemove: () => void
  onUpdateCharacter: (charIdx: number, p: Partial<Character>) => void
  onAddCharacter: () => void
  onRemoveCharacter: (charIdx: number) => void
}) {
  const t = (mn: string, en: string) => (locale === "mn" ? mn : en)
  const charIdx = scene.characterIdx ?? 0
  const sceneChar = characters[charIdx] ?? characters[0]

  const orientationLabel: Record<Orientation, string> = {
    "9:16": t("Босоо", "Portrait"),
    "16:9": t("Хэвтээ", "Landscape"),
    "1:1": t("Дөрвөлжин", "Square"),
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/40 bg-muted/20 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[10px] font-bold text-accent">
            {index + 1}
          </span>
          {/* Type toggle */}
          <button
            onClick={() => onChange({ type: "a_roll" })}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-all",
              scene.type === "a_roll"
                ? "bg-accent/15 text-accent ring-1 ring-accent/30"
                : "border border-border/50 text-muted-foreground hover:border-accent/30 hover:text-foreground",
            )}
          >
            <User className="h-2.5 w-2.5" />
            {t("Танилцуулагч", "Presenter")}
          </button>
          <button
            onClick={() => onChange({ type: "b_roll" })}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-all",
              scene.type === "b_roll"
                ? "bg-accent/15 text-accent ring-1 ring-accent/30"
                : "border border-border/50 text-muted-foreground hover:border-accent/30 hover:text-foreground",
            )}
          >
            <Clapperboard className="h-2.5 w-2.5" />
            {t("Дүрслэл", "Cinematic")}
          </button>
          {/* Character mini-selector (a_roll) — switch / add / remove characters */}
          {scene.type === "a_roll" && (
            <div className="flex items-center gap-0.5">
              {characters.length > 1 &&
                characters.map((char, idx) => (
                  <span key={char.id} className="group/char relative">
                    <button
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
                    {idx > 0 && (
                      <span
                        role="button"
                        title={t("Дүр устгах", "Remove actor")}
                        onClick={(e) => {
                          e.stopPropagation()
                          onRemoveCharacter(idx)
                        }}
                        className="absolute -right-1 -top-1 hidden h-3 w-3 items-center justify-center rounded-full bg-destructive text-destructive-foreground group-hover/char:flex"
                      >
                        <X className="h-2 w-2" />
                      </span>
                    )}
                  </span>
                ))}
              <button
                title={t("Дүр нэмэх", "Add character")}
                onClick={() => onAddCharacter()}
                className="flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-border/50 text-muted-foreground transition hover:border-accent/50 hover:text-accent"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Duration stepper */}
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

      {/* Script | Style — HeyGen-style 2-column */}
      <div className="grid grid-cols-2 divide-x divide-border/40">
        <div className="p-3 space-y-1.5">
          <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">
            <Mic className="h-2.5 w-2.5" />
            {scene.type === "a_roll" ? t("Яриа", "Script") : t("Хадмал", "Voiceover")}
          </span>
          <textarea
            value={scene.script}
            onChange={(e) => onChange({ script: e.target.value })}
            rows={4}
            placeholder={
              scene.type === "a_roll"
                ? t("Юу хэлэх вэ…", "What is said…")
                : t("Дуут тайлбар (заавал биш)…", "Voiceover (optional)…")
            }
            className="w-full resize-none bg-transparent text-sm leading-relaxed outline-none placeholder:text-muted-foreground/30"
          />
        </div>
        <div className="p-3 space-y-1.5">
          <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">
            <Wand2 className="h-2.5 w-2.5" />
            {t("Дүрслэл", "Style")}
          </span>
          <textarea
            value={scene.visualPrompt}
            onChange={(e) => onChange({ visualPrompt: e.target.value })}
            rows={4}
            placeholder={t("Визуал дүрслэл (англиар)…", "Visual description (in English)…")}
            className="w-full resize-none bg-transparent text-sm leading-relaxed outline-none placeholder:text-muted-foreground/30"
          />
        </div>
      </div>

      {/* Avatar | Voice — only presenter scenes (HeyGen-style, inside the card) */}
      {scene.type === "a_roll" && (
        <div className="grid grid-cols-2 divide-x divide-border/40 border-t border-border/40">
          <div className="min-w-0 p-3 space-y-1.5">
            <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">
              <User className="h-2.5 w-2.5" />
              {t("Дүр", "Avatar")}
            </span>
            <AvatarPicker
              locale={locale}
              avatar={sceneChar.avatar}
              orientation={orientation}
              required
              onChange={(avatar) => onUpdateCharacter(charIdx, { avatar })}
            />
          </div>
          <div className="min-w-0 p-3 space-y-1.5">
            <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">
              <Mic className="h-2.5 w-2.5" />
              {t("Хоолой", "Voice")}
            </span>
            <VoicePicker
              value={{ voiceId: sceneChar.voice.voiceId, lang: sceneChar.voice.lang }}
              onChange={(sel) => onUpdateCharacter(charIdx, { voice: { ...sceneChar.voice, ...sel } })}
              locale={locale}
            />
          </div>
        </div>
      )}

      {/* Details chips — like HeyGen's footer */}
      <div className="flex flex-wrap items-center gap-1.5 border-t border-border/40 bg-muted/10 px-3 py-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">
          ⏱ {scene.durationSec}s
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">
          📐 {orientationLabel[orientation]}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">
          🌐 {language === "mn" ? "mn-MN" : "en-US"}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">
          {scene.type === "a_roll" ? `🎙 ${t("Танилцуулагч", "Presenter")}` : `🎬 ${t("Дүрслэл", "Cinematic")}`}
        </span>
      </div>
    </div>
  )
}
