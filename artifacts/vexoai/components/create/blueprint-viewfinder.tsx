"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ArrowRight,
  AudioWaveform,
  Captions,
  ChevronDown,
  Clock,
  Coins,
  Globe,
  Minus,
  Pencil,
  Plus,
  RectangleHorizontal,
  User,
} from "lucide-react"
import {
  recomputeDuration,
  type BlueprintScene,
  type Character,
  type Orientation,
  type VideoBlueprint,
  type VoiceRef,
} from "@/lib/blueprint"
import { estimateBlueprintCredits } from "@/lib/blueprint-costs"
import { VOICES } from "@/lib/voices-catalog"
import { AvatarPicker } from "@/components/create/avatar-picker"
import { VoicePicker } from "@/components/studio-voice-picker"

interface BlueprintViewfinderProps {
  locale: "mn" | "en"
  blueprint: VideoBlueprint
  generating: boolean
  onChange: (bp: VideoBlueprint) => void
  onEdit: () => void
  onGenerate: () => void
}

// Self-contained "viewfinder / production slate" styling. All rules are scoped
// under .vx-* so they never collide with the host Tailwind build, and the card
// renders identically regardless of theme.
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

.vx-wrap{
  --ink:#08090C; --surface:#0F1116; --surface-2:#14171E; --inset:#0C0E13;
  --line:rgba(255,255,255,0.08); --line-strong:rgba(255,255,255,0.16);
  --tungsten:#F3B279; --teal:#2DD4BF; --teal-deep:#0d9488;
  --text:#ECEEF1; --muted:#8B919C; --faint:#565C66;
  height:100%; overflow-y:auto; padding:36px 20px 56px; box-sizing:border-box;
  font-family:'Manrope',system-ui,sans-serif; color:var(--text);
  -webkit-font-smoothing:antialiased;
  background:
    radial-gradient(1200px 600px at 80% -10%, rgba(45,212,191,0.06), transparent 60%),
    radial-gradient(900px 500px at 10% 110%, rgba(243,178,121,0.05), transparent 55%),
    var(--ink);
}
.vx-wrap *{box-sizing:border-box}
.vx-card{
  width:100%; max-width:680px; margin:0 auto;
  background:linear-gradient(180deg, var(--surface) 0%, #0D0F14 100%);
  border:1px solid var(--line); border-radius:22px; overflow:visible;
  box-shadow:0 40px 80px -20px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.02) inset;
}

/* HUD */
.vx-hud{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;
  font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.12em;
  text-transform:uppercase;color:var(--faint);border-bottom:1px solid var(--line)}
.vx-hud-grp{display:flex;align-items:center;gap:10px;min-width:0}
.vx-hud-title{color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:240px}
.vx-rec{display:inline-flex;align-items:center;gap:7px;color:#ff5a52}
.vx-rec .vx-dot{width:8px;height:8px;border-radius:50%;background:#ff5a52;
  box-shadow:0 0 10px #ff5a52;animation:vxblink 1.4s steps(1) infinite}
@keyframes vxblink{50%{opacity:0.15}}
.vx-sep{color:var(--line-strong)} .vx-tag{color:var(--muted)}

/* Viewfinder hero */
.vx-vf{position:relative;margin:16px;height:248px;border-radius:14px;overflow:hidden}
.vx-stage{position:absolute;inset:0;background:
  radial-gradient(140% 120% at 78% 18%, rgba(243,178,121,0.55), transparent 42%),
  radial-gradient(120% 100% at 20% 90%, rgba(94,79,63,0.6), transparent 50%),
  linear-gradient(135deg, #2a2620 0%, #17161b 55%, #0c0c10 100%)}
.vx-bokeh{position:absolute;border-radius:50%;opacity:0.5}
.vx-b1{width:90px;height:90px;top:24px;right:60px;background:rgba(255,214,170,0.55);filter:blur(14px)}
.vx-b2{width:46px;height:46px;top:90px;right:30px;background:rgba(255,224,190,0.45);filter:blur(8px)}
.vx-b3{width:30px;height:30px;top:60px;right:140px;background:rgba(255,205,160,0.4);filter:blur(8px)}
.vx-b4{width:120px;height:120px;bottom:-30px;left:-20px;background:rgba(120,95,70,0.4);filter:blur(22px)}
.vx-vig{position:absolute;inset:0;background:linear-gradient(180deg,
  rgba(0,0,0,0.1) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.55) 78%, rgba(0,0,0,0.82) 100%)}
.vx-br{position:absolute;width:26px;height:26px;border:2px solid rgba(255,255,255,0.85)}
.vx-tl{top:14px;left:14px;border-right:none;border-bottom:none;border-top-left-radius:3px}
.vx-tr{top:14px;right:14px;border-left:none;border-bottom:none;border-top-right-radius:3px}
.vx-bl{bottom:14px;left:14px;border-right:none;border-top:none;border-bottom-left-radius:3px}
.vx-brr{bottom:14px;right:14px;border-left:none;border-top:none;border-bottom-right-radius:3px}
.vx-slate{position:absolute;top:18px;left:50px;font-family:'JetBrains Mono',monospace;
  font-size:10.5px;letter-spacing:0.14em;color:rgba(255,255,255,0.78);text-transform:uppercase}
.vx-title{position:absolute;left:28px;right:28px;bottom:40px;font-family:'Oswald',sans-serif;
  font-weight:600;font-size:44px;line-height:0.92;letter-spacing:-0.01em;text-transform:uppercase;
  color:#fff;text-shadow:0 2px 24px rgba(0,0,0,0.6);margin:0;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.vx-tc{position:absolute;bottom:20px;right:46px;font-family:'JetBrains Mono',monospace;
  font-size:12px;letter-spacing:0.08em;color:var(--teal)}
.vx-ratio{position:absolute;bottom:20px;left:50px;font-family:'JetBrains Mono',monospace;
  font-size:11px;letter-spacing:0.12em;color:rgba(255,255,255,0.6)}

/* Body */
.vx-body{padding:4px 24px 8px}
.vx-scene{padding:18px 0;border-bottom:1px solid var(--line)}
.vx-scene-head{display:flex;align-items:center;gap:10px;margin-bottom:4px;
  font-family:'JetBrains Mono',monospace;font-size:10.5px;letter-spacing:0.13em;text-transform:uppercase}
.vx-scene-no{color:var(--teal);display:inline-flex;align-items:center;gap:7px}
.vx-scene-no::before{content:'';width:5px;height:5px;background:var(--teal);border-radius:1px;box-shadow:0 0 8px var(--teal)}
.vx-scene-type{color:var(--faint)}
.vx-scene-tc{margin-left:auto;color:var(--muted)}
.vx-row{display:grid;grid-template-columns:1fr 1fr;gap:26px;padding:14px 0 4px}
.vx-eye{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.16em;
  text-transform:uppercase;color:var(--teal-deep);margin-bottom:9px}
.vx-copy{font-size:13.5px;line-height:1.62;color:#C3C8D0;font-weight:400;margin:0;white-space:pre-wrap}
.vx-copy.vx-empty{color:var(--faint);font-style:italic}
.vx-cast{padding:14px 0 2px}
.vx-castgrid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:10px}
.vx-slot{display:flex;align-items:center;gap:13px;padding:11px 13px;border-radius:13px;
  background:var(--inset);border:1px solid var(--line);min-width:0}
.vx-av{width:42px;height:42px;border-radius:10px;flex:none;overflow:hidden;display:flex;align-items:center;justify-content:center;
  color:var(--faint);background:linear-gradient(135deg,rgba(45,212,191,0.12),rgba(255,255,255,0.03));border:1px solid var(--line)}
.vx-av img{width:100%;height:100%;object-fit:cover}
.vx-meta{display:flex;flex-direction:column;gap:3px;min-width:0}
.vx-k{font-family:'JetBrains Mono',monospace;font-size:9.5px;letter-spacing:0.13em;text-transform:uppercase;color:var(--faint)}
.vx-v{font-size:13px;color:var(--text);font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vx-v.vx-pending{color:var(--muted)}
.vx-pulse{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--tungsten);
  margin-right:7px;vertical-align:middle;animation:vxblink 1.6s steps(1) infinite}
.vx-spec{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:14px 0 2px}
.vx-chip{display:inline-flex;align-items:center;gap:7px;font-family:'JetBrains Mono',monospace;
  font-size:11px;letter-spacing:0.04em;color:var(--muted);padding:7px 12px;border-radius:9px;
  background:var(--surface-2);border:1px solid var(--line)}
.vx-chip svg{width:13px;height:13px;opacity:0.7}
.vx-credit{color:var(--teal);background:rgba(45,212,191,0.07);border-color:rgba(45,212,191,0.22)}
.vx-credit svg{opacity:1}

/* Footer + actions */
.vx-foot{padding:18px 24px 4px}
.vx-hint{color:var(--tungsten);font-size:12.5px;text-align:center;padding:0 24px 4px;margin:0}
.vx-actions{display:flex;gap:12px;padding:18px 24px 24px;border-top:1px solid var(--line);margin-top:12px}
.vx-btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;height:50px;border-radius:13px;
  cursor:pointer;border:1px solid transparent;font-family:'Manrope',sans-serif;font-weight:700;font-size:14px;
  letter-spacing:0.01em;transition:all .18s ease}
.vx-ghost{flex:0 0 132px;background:transparent;border-color:var(--line-strong);color:var(--muted)}
.vx-ghost:hover{color:var(--text);border-color:rgba(255,255,255,0.3)}
.vx-gen{flex:1;background:linear-gradient(135deg,var(--teal) 0%, var(--teal-deep) 100%);color:#04201c;
  box-shadow:0 8px 24px -10px rgba(45,212,191,0.45);text-transform:uppercase;letter-spacing:0.06em;font-weight:800}
.vx-gen:hover{filter:brightness(1.08)}
.vx-gen:disabled{cursor:not-allowed;opacity:0.4;box-shadow:none;filter:none}
.vx-btn svg{width:17px;height:17px}

@media (max-width:560px){
  .vx-row,.vx-castgrid{grid-template-columns:1fr;gap:16px}
  .vx-title{font-size:36px}
}
@media (prefers-reduced-motion:reduce){
  .vx-dot,.vx-pulse{animation:none}
}

/* Inline editing — interactive slots & chips */
.vx-wrap button{font-family:inherit}
button.vx-slot{width:100%;text-align:left;color:inherit}
.vx-slot.vx-edit{cursor:pointer;transition:border-color .15s ease,background .15s ease}
.vx-slot.vx-edit:hover{border-color:var(--line-strong);background:#10131a}
.vx-slot-tail{margin-left:auto;flex:none;display:flex;align-items:center;color:var(--faint);
  transition:transform .2s ease,color .15s ease}
.vx-slot-tail svg{width:15px;height:15px}
.vx-slot.vx-open .vx-slot-tail{color:var(--teal);transform:rotate(180deg)}
.vx-panel{margin-top:12px;padding:14px;border-radius:13px;background:var(--inset);border:1px solid var(--line)}
.vx-chip.vx-act{cursor:pointer;transition:border-color .15s ease,color .15s ease,background .15s ease}
.vx-chip.vx-act:hover{border-color:var(--line-strong);color:var(--text);background:var(--inset)}
.vx-step{display:inline-flex;align-items:center;border-radius:9px;overflow:hidden;
  border:1px solid var(--line);background:var(--surface-2);font-family:'JetBrains Mono',monospace}
.vx-step button{width:28px;height:30px;border:none;background:transparent;color:var(--muted);
  cursor:pointer;display:flex;align-items:center;justify-content:center;
  transition:background .15s ease,color .15s ease}
.vx-step button:hover:not(:disabled){background:rgba(255,255,255,0.06);color:var(--text)}
.vx-step button:disabled{opacity:0.28;cursor:not-allowed}
.vx-step .vx-step-v{min-width:40px;text-align:center;font-size:11px;color:var(--text);letter-spacing:0.04em}
.vx-step svg{width:13px;height:13px}
`

// Resolve a friendly display name for a voice. camb.ai studio voices are loaded
// from /api/camb-voices (mirrors the picker); gemini voices come from the
// bundled catalog.
function useCambNames(): Record<string, string> {
  const [map, setMap] = useState<Record<string, string>>({})
  useEffect(() => {
    let active = true
    fetch("/api/camb-voices")
      .then((r) => r.json())
      .then((d) => {
        if (!active || !Array.isArray(d?.voices)) return
        const m: Record<string, string> = {}
        for (const v of d.voices) if (v?.id != null) m[`camb:${v.id}`] = v.name
        setMap(m)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])
  return map
}

function voiceName(voice: VoiceRef, cambMap: Record<string, string>, locale: "mn" | "en"): string {
  if (voice.name) return voice.name
  if (voice.voiceId.startsWith("camb:")) {
    return cambMap[voice.voiceId] ?? (locale === "mn" ? "Монгол студи" : "Mongolian studio")
  }
  const m = VOICES.find((v) => v.id === voice.voiceId)
  if (m) return locale === "mn" ? m.nameMn : m.name
  return voice.lang
}

function voiceProvider(voice: VoiceRef): string {
  return voice.voiceId.startsWith("camb:") ? "CAMB.AI" : "GEMINI"
}

const RATIO_LABEL: Record<Orientation, string> = {
  "16:9": "LANDSCAPE",
  "9:16": "PORTRAIT",
  "1:1": "SQUARE",
}

// Display tag for a spoken-language code (the value that actually drives TTS).
function langTagOf(lang: string): string {
  if (lang === "mn") return "mn-MN"
  if (lang === "en") return "en-US"
  return `${lang}-${lang.toUpperCase()}`
}

function timecode(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  const mm = Math.floor(s / 60)
  const ss = s % 60
  return `00:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}:00`
}

export function BlueprintViewfinder({ locale, blueprint, generating, onChange, onEdit, onGenerate }: BlueprintViewfinderProps) {
  const t = (mn: string, en: string) => (locale === "mn" ? mn : en)
  const cambMap = useCambNames()

  const credits = useMemo(() => estimateBlueprintCredits(blueprint), [blueprint])

  // Which cast slot is expanded for inline editing — keyed by `${sceneId}:avatar|voice`.
  const [openSlot, setOpenSlot] = useState<string | null>(null)
  const toggleSlot = (key: string) => setOpenSlot((k) => (k === key ? null : key))

  const patch = (p: Partial<VideoBlueprint>) => onChange({ ...blueprint, ...p })

  // Mirrors the editor: index 0 edits the primary avatar/voice, 1+ edit bp.characters.
  const updateCharacter = (idx: number, p: Partial<Character>) => {
    if (idx === 0) {
      if (p.avatar !== undefined) patch({ avatar: p.avatar })
      if (p.voice !== undefined) patch({ voice: p.voice })
    } else {
      const chars = [...(blueprint.characters ?? [])]
      if (!chars[idx - 1]) return
      chars[idx - 1] = { ...chars[idx - 1], ...p }
      patch({ characters: chars })
    }
  }

  const patchScene = (id: string, p: Partial<BlueprintScene>) => {
    const scenes = blueprint.scenes.map((s) => (s.id === id ? { ...s, ...p } : s))
    onChange({ ...blueprint, scenes, durationSec: recomputeDuration({ ...blueprint, scenes }) })
  }

  const ORIENTATION_ORDER: Orientation[] = ["9:16", "16:9", "1:1"]
  const cycleOrientation = () => {
    const i = ORIENTATION_ORDER.indexOf(blueprint.orientation)
    patch({ orientation: ORIENTATION_ORDER[(i + 1) % ORIENTATION_ORDER.length] })
  }

  const allCharacters: Character[] = useMemo(
    () => [{ id: "__primary__", avatar: blueprint.avatar, voice: blueprint.voice }, ...(blueprint.characters ?? [])],
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

  const langTag = blueprint.language === "mn" ? "MN" : "EN"
  const langChip = blueprint.language === "mn" ? "mn-MN" : "en-US"

  const hint = needsAvatar
    ? t("Эхлээд аватар зураг оруулна уу — «Засах» дээр дарж нэмнэ үү.", "Add an avatar first — tap “Edit” to add one.")
    : emptyScript
      ? t("Танилцуулагч дүрийн яриаг бөглөнө үү — «Засах».", "Fill in the presenter script — tap “Edit”.")
      : emptyVisual
        ? t("Дүрслэх хэсэг бүрт зураглал оруулна уу — «Засах».", "Add a visual prompt for every b-roll scene — tap “Edit”.")
        : null

  return (
    <div className="vx-wrap">
      <style>{CSS}</style>
      <div className="vx-card">
        {/* HUD */}
        <div className="vx-hud">
          <div className="vx-hud-grp">
            <span className="vx-rec">
              <span className="vx-dot" />
              REC
            </span>
            <span className="vx-sep">/</span>
            <span>{t("Төлөвлөгөө", "Blueprint")}</span>
            <span className="vx-sep">·</span>
            <span className="vx-hud-title">{blueprint.title}</span>
          </div>
          <div className="vx-hud-grp">
            <span className="vx-tag">id: {blueprint.id.slice(0, 6)}</span>
            <span className="vx-sep">·</span>
            <span>{t("бэлэн", "ready")}</span>
          </div>
        </div>

        {/* Viewfinder hero */}
        <div className="vx-vf">
          <div className="vx-stage" />
          <div className="vx-bokeh vx-b1" />
          <div className="vx-bokeh vx-b2" />
          <div className="vx-bokeh vx-b3" />
          <div className="vx-bokeh vx-b4" />
          <div className="vx-vig" />
          <div className="vx-br vx-tl" />
          <div className="vx-br vx-tr" />
          <div className="vx-br vx-bl" />
          <div className="vx-br vx-brr" />
          <div className="vx-slate">
            {blueprint.scenes.length} {t("ХЭСЭГ", "SCENES")} · TAKE 1 · {langTag}
          </div>
          <h3 className="vx-title">{blueprint.title}</h3>
          <div className="vx-ratio">
            {blueprint.orientation} — {RATIO_LABEL[blueprint.orientation]}
          </div>
          <div className="vx-tc">{timecode(blueprint.durationSec)}</div>
        </div>

        {/* Body — one block per scene */}
        <div className="vx-body">
          {blueprint.scenes.map((scene, idx) => {
            const charIdx = scene.characterIdx ?? 0
            const sceneChar = allCharacters[charIdx] ?? allCharacters[0]
            const hasAvatar = !!sceneChar.avatar.imageUrl
            return (
              <div className="vx-scene" key={scene.id}>
                <div className="vx-scene-head">
                  <span className="vx-scene-no">SCENE {String(idx + 1).padStart(2, "0")}</span>
                  <span className="vx-scene-type">
                    {scene.type === "a_roll" ? t("ТАНИЛЦУУЛАГЧ", "PRESENTER") : t("ДҮРСЛЭЛ", "B-ROLL")}
                  </span>
                  <span className="vx-scene-tc">{timecode(scene.durationSec)}</span>
                </div>

                <div className="vx-row">
                  <div>
                    <div className="vx-eye">{scene.type === "a_roll" ? t("Яриа", "Script") : t("Хадмал", "Voiceover")}</div>
                    {scene.script.trim() ? (
                      <p className="vx-copy">{scene.script}</p>
                    ) : (
                      <p className="vx-copy vx-empty">
                        {scene.type === "a_roll" ? t("Яриа оруулаагүй", "No script yet") : t("Дуут тайлбаргүй", "Silent footage")}
                      </p>
                    )}
                  </div>
                  <div>
                    <div className="vx-eye">{t("Дүрслэл", "Style")}</div>
                    {scene.visualPrompt.trim() ? (
                      <p className="vx-copy">{scene.visualPrompt}</p>
                    ) : (
                      <p className="vx-copy vx-empty">{t("Зураглал оруулаагүй", "No visual prompt yet")}</p>
                    )}
                  </div>
                </div>

                {scene.type === "a_roll" && (
                  <div className="vx-cast">
                    <div className="vx-eye">{t("Дүр", "Cast")}</div>
                    <div className="vx-castgrid">
                      <button
                        type="button"
                        className={`vx-slot vx-edit${openSlot === `${scene.id}:avatar` ? " vx-open" : ""}`}
                        onClick={() => toggleSlot(`${scene.id}:avatar`)}
                      >
                        <div className="vx-av">
                          {hasAvatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={sceneChar.avatar.imageUrl} alt="" />
                          ) : (
                            <User className="h-5 w-5" />
                          )}
                        </div>
                        <div className="vx-meta">
                          <span className="vx-k">{t("Аватар", "Avatar")}</span>
                          {hasAvatar ? (
                            <span className="vx-v">{sceneChar.avatar.label || t("Бэлэн дүр", "Ready")}</span>
                          ) : (
                            <span className="vx-v vx-pending">
                              <span className="vx-pulse" />
                              {t("Хүлээгдэж буй", "Pending")}
                            </span>
                          )}
                        </div>
                        <span className="vx-slot-tail">
                          <ChevronDown />
                        </span>
                      </button>
                      <button
                        type="button"
                        className={`vx-slot vx-edit${openSlot === `${scene.id}:voice` ? " vx-open" : ""}`}
                        onClick={() => toggleSlot(`${scene.id}:voice`)}
                      >
                        <div className="vx-av">
                          <AudioWaveform className="h-5 w-5" />
                        </div>
                        <div className="vx-meta">
                          <span className="vx-k">
                            {t("Хоолой", "Voice")} — {voiceProvider(sceneChar.voice)}
                          </span>
                          <span className="vx-v">{voiceName(sceneChar.voice, cambMap, locale)}</span>
                        </div>
                        <span className="vx-slot-tail">
                          <ChevronDown />
                        </span>
                      </button>
                    </div>

                    {openSlot === `${scene.id}:avatar` && (
                      <div className="dark vx-panel">
                        <AvatarPicker
                          locale={locale}
                          avatar={sceneChar.avatar}
                          orientation={blueprint.orientation}
                          required
                          onChange={(avatar) => updateCharacter(charIdx, { avatar })}
                        />
                      </div>
                    )}
                    {openSlot === `${scene.id}:voice` && (
                      <div className="dark vx-panel">
                        <VoicePicker
                          value={{ voiceId: sceneChar.voice.voiceId, lang: sceneChar.voice.lang }}
                          onChange={(sel) => updateCharacter(charIdx, { voice: { ...sceneChar.voice, ...sel } })}
                          locale={locale}
                        />
                      </div>
                    )}
                  </div>
                )}

                <div className="vx-spec">
                  <span className="vx-step" title={t("Үргэлжлэх хугацаа", "Duration")}>
                    <button
                      type="button"
                      aria-label={t("Богиносгох", "Shorter")}
                      disabled={scene.durationSec <= 3}
                      onClick={() => patchScene(scene.id, { durationSec: Math.max(3, scene.durationSec - 1) })}
                    >
                      <Minus />
                    </button>
                    <span className="vx-step-v">{scene.durationSec}s</span>
                    <button
                      type="button"
                      aria-label={t("Уртасгах", "Longer")}
                      disabled={scene.durationSec >= 15}
                      onClick={() => patchScene(scene.id, { durationSec: Math.min(15, scene.durationSec + 1) })}
                    >
                      <Plus />
                    </button>
                  </span>
                  <button
                    type="button"
                    className="vx-chip vx-act"
                    onClick={cycleOrientation}
                    title={t("Хэлбэр солих", "Change aspect ratio")}
                  >
                    <RectangleHorizontal />
                    {blueprint.orientation}
                  </button>
                  {scene.type === "a_roll" ? (
                    <button
                      type="button"
                      className="vx-chip vx-act"
                      onClick={() => toggleSlot(`${scene.id}:voice`)}
                      title={t("Хэл / хоолой солих", "Change language / voice")}
                    >
                      <Globe />
                      {langTagOf(sceneChar.voice.lang)}
                    </button>
                  ) : (
                    <span className="vx-chip">
                      <Globe />
                      {langChip}
                    </span>
                  )}
                  {blueprint.captions && (
                    <span className="vx-chip">
                      <Captions />
                      {t("Хадмал", "Subtitles")}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer summary */}
        <div className="vx-foot">
          <div className="vx-spec" style={{ paddingTop: 0 }}>
            <span className="vx-chip">
              <Clock />~{blueprint.durationSec}s
            </span>
            <span className="vx-chip">
              <RectangleHorizontal />
              {blueprint.orientation} · {RATIO_LABEL[blueprint.orientation]}
            </span>
            <span className="vx-chip">
              <Globe />
              {langChip}
            </span>
            <span className="vx-chip vx-credit">
              <Coins />
              {credits} {t("кр", "cr")}
            </span>
          </div>
        </div>

        {hint && <p className="vx-hint">{hint}</p>}

        {/* Actions */}
        <div className="vx-actions">
          <button className="vx-btn vx-ghost" onClick={onEdit} type="button">
            <Pencil />
            {t("Засах", "Edit")}
          </button>
          <button className="vx-btn vx-gen" onClick={onGenerate} disabled={blocked} type="button">
            {generating ? t("Үүсгэж байна…", "Generating…") : t("Generate", "Generate")}
            <ArrowRight />
          </button>
        </div>
      </div>
    </div>
  )
}
