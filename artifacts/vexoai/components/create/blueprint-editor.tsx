"use client"

import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import {
  newSceneId,
  recomputeDuration,
  type BlueprintScene,
  type Character,
  type Orientation,
  type VideoBlueprint,
} from "@/lib/blueprint"
import { estimateBlueprintCredits } from "@/lib/blueprint-costs"
import { VoicePicker } from "@/components/studio-voice-picker"
import { AvatarPicker } from "@/components/create/avatar-picker"

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

.vx-card{
  --ink:#08090C;--surface:#0F1116;--surface-2:#14171E;--inset:#0C0E13;
  --line:rgba(255,255,255,0.08);--line-strong:rgba(255,255,255,0.16);
  --tungsten:#F3B279;--teal:#2DD4BF;--teal-deep:#0d9488;
  --text:#ECEEF1;--muted:#8B919C;--faint:#565C66;--vg:#55AA5B;--vr:#B80D0D;
  width:100%;background:linear-gradient(180deg,var(--surface) 0%,#0D0F14 100%);
  border:1px solid var(--line);border-radius:22px;
  box-shadow:0 40px 80px -20px rgba(0,0,0,0.7),0 0 0 1px rgba(255,255,255,0.02) inset;
  font-family:'Manrope',system-ui,sans-serif;color:var(--text);-webkit-font-smoothing:antialiased;
}
.vx-card *{box-sizing:border-box}
.vx-clip{border-radius:22px;overflow:hidden}

/* HUD */
.vx-hud{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;
  font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;
  color:var(--faint);border-bottom:1px solid var(--line)}
.vx-hg{display:flex;align-items:center;gap:10px}
.vx-rec{display:inline-flex;align-items:center;gap:7px;color:#ff5a52}
.vx-rec .vx-dot{width:8px;height:8px;border-radius:50%;background:currentColor;
  box-shadow:0 0 10px currentColor;animation:vxblink 1.2s steps(1) infinite}
@keyframes vxblink{50%{opacity:0.18}}
.vx-sep{color:var(--line-strong)}.vx-tag{color:var(--muted)}

/* Viewfinder */
.vx-vf{position:relative;margin:16px;height:220px;border-radius:14px;overflow:hidden;cursor:default}
.vx-stage{position:absolute;inset:0;
  background:radial-gradient(140% 120% at 78% 18%,rgba(243,178,121,0.55),transparent 42%),
    radial-gradient(120% 100% at 20% 90%,rgba(94,79,63,0.6),transparent 50%),
    linear-gradient(135deg,#2a2620 0%,#17161b 55%,#0c0c10 100%)}
.vx-bokeh{position:absolute;border-radius:50%;opacity:0.5}
.vx-b1{width:90px;height:90px;top:24px;right:60px;background:rgba(255,214,170,0.55);filter:blur(14px)}
.vx-b2{width:46px;height:46px;top:90px;right:30px;background:rgba(255,224,190,0.45);filter:blur(8px)}
.vx-b3{width:30px;height:30px;top:60px;right:140px;background:rgba(255,205,160,0.4);filter:blur(8px)}
.vx-b4{width:120px;height:120px;bottom:-30px;left:-20px;background:rgba(120,95,70,0.4);filter:blur(22px)}
.vx-vig{position:absolute;inset:0;
  background:linear-gradient(180deg,rgba(0,0,0,0.1) 0%,rgba(0,0,0,0) 30%,rgba(0,0,0,0.55) 78%,rgba(0,0,0,0.82) 100%)}
.vx-br{position:absolute;width:26px;height:26px;border:2px solid rgba(255,255,255,0.85)}
.vx-tl{border-right:none;border-bottom:none;border-top-left-radius:3px}
.vx-tr{border-left:none;border-bottom:none;border-top-right-radius:3px}
.vx-bl{border-right:none;border-top:none;border-bottom-left-radius:3px}
.vx-brr{border-left:none;border-top:none;border-bottom-right-radius:3px}
.vx-slate{position:absolute;top:18px;left:50%;transform:translateX(-50%);
  font-family:'JetBrains Mono',monospace;font-size:10.5px;letter-spacing:0.14em;
  color:rgba(255,255,255,0.78);text-transform:uppercase;white-space:nowrap}
.vx-title{position:absolute;left:0;right:0;bottom:36px;text-align:center;
  font-family:'Oswald',sans-serif;font-weight:600;line-height:0.94;letter-spacing:-0.01em;
  text-transform:uppercase;color:#fff;text-shadow:0 2px 24px rgba(0,0,0,0.7);margin:0;padding:0 28px}
.vx-title-placeholder{opacity:0.35}
.vx-tc{position:absolute;bottom:16px;right:20px;font-family:'JetBrains Mono',monospace;
  font-size:12px;letter-spacing:0.08em;color:var(--teal)}
.vx-ratio-btn{position:absolute;bottom:16px;left:20px;font-family:'JetBrains Mono',monospace;
  font-size:11px;letter-spacing:0.12em;color:rgba(255,255,255,0.55);background:none;border:none;
  cursor:pointer;padding:2px 6px;border-radius:4px;transition:all .15s}
.vx-ratio-btn:hover{color:var(--teal);background:rgba(45,212,191,0.08)}

/* Title row */
.vx-title-row{display:flex;align-items:center;gap:10px;padding:12px 20px 0}
.vx-title-input{flex:1;background:transparent;border:none;outline:none;
  font-family:'Oswald',sans-serif;font-size:18px;font-weight:600;letter-spacing:0.01em;
  color:var(--text);text-transform:uppercase;placeholder-color:var(--faint)}
.vx-title-input::placeholder{color:var(--faint);font-weight:400;text-transform:none;font-family:'Manrope',sans-serif;font-size:14px}
.vx-model-btn{display:inline-flex;align-items:center;gap:5px;font-family:'JetBrains Mono',monospace;
  font-size:10px;letter-spacing:0.1em;text-transform:uppercase;
  padding:5px 10px;border-radius:8px;border:1px solid var(--line);
  background:transparent;color:var(--faint);cursor:pointer;transition:all .15s;white-space:nowrap}
.vx-model-btn:hover{color:var(--teal);border-color:rgba(45,212,191,0.3)}
.vx-model-btn--active{color:var(--teal);border-color:rgba(45,212,191,0.35);background:rgba(45,212,191,0.06)}

/* Body */
.vx-body{padding:14px 20px 20px}
.vx-eye{font-family:'JetBrains Mono',monospace;font-size:10.5px;letter-spacing:0.16em;text-transform:uppercase;
  color:var(--teal-deep);margin-bottom:9px;display:flex;align-items:center;gap:8px}
.vx-eye span:first-child{width:5px;height:5px;background:var(--teal);border-radius:1px;
  box-shadow:0 0 8px var(--teal);display:inline-block;flex-shrink:0}
.vx-scene{border:1px solid var(--line);border-radius:16px;background:rgba(255,255,255,0.012);margin-bottom:12px}
.vx-shd{display:flex;align-items:center;gap:10px;padding:12px 14px;cursor:pointer;user-select:none}
.vx-shd.open{border-bottom:1px solid var(--line)}
.vx-snum{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;
  color:var(--teal);display:flex;align-items:center;gap:8px;flex-shrink:0}
.vx-snum span:first-child{width:6px;height:6px;background:var(--teal);border-radius:1px;
  box-shadow:0 0 8px var(--teal);display:inline-block}
.vx-type-badge{font-size:9.5px;padding:2px 7px;border-radius:5px;
  background:rgba(45,212,191,0.1);color:var(--teal);letter-spacing:0.08em;margin-left:2px}
.vx-ssum{color:var(--faint);font-size:12px;margin-left:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1}
.vx-shp{margin-left:auto;display:flex;gap:4px}
.vx-ib{width:28px;height:28px;border-radius:8px;border:1px solid var(--line);background:transparent;
  color:var(--muted);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s}
.vx-ib:hover{color:var(--text);border-color:var(--line-strong)}
.vx-ib.del:hover{color:#ff5a52;border-color:rgba(255,90,82,0.4)}
.vx-ib svg{width:14px;height:14px}
.vx-sbd{padding:2px 14px 14px}

/* Type toggle */
.vx-type-row{display:flex;gap:6px;padding:10px 0 4px}
.vx-type-btn{display:inline-flex;align-items:center;gap:5px;font-family:'JetBrains Mono',monospace;
  font-size:10px;letter-spacing:0.1em;text-transform:uppercase;
  padding:5px 10px;border-radius:8px;border:1px solid var(--line);
  background:transparent;color:var(--faint);cursor:pointer;transition:all .15s}
.vx-type-btn:hover{color:var(--text);border-color:var(--line-strong)}
.vx-type-btn.active{color:var(--teal);border-color:rgba(45,212,191,0.35);background:rgba(45,212,191,0.07)}
.vx-type-btn svg{width:12px;height:12px}

/* Script | Style */
.vx-prow{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:10px 0 4px}
.vx-ta{width:100%;min-height:80px;resize:vertical;background:var(--inset);border:1px solid var(--line);
  border-radius:11px;padding:10px 12px;color:#D6DAE0;font-family:'Manrope',sans-serif;
  font-size:12.5px;line-height:1.55;outline:none;transition:border-color .15s}
.vx-ta:focus{border-color:rgba(45,212,191,0.45)}
.vx-ta::placeholder{color:var(--faint)}

/* Cast */
.vx-cast{padding:10px 0 4px}
.vx-cast-inner{display:flex;flex-direction:column;gap:10px;padding-top:8px}

/* Specs */
.vx-spec{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:10px 0 2px}
.vx-chip{display:inline-flex;align-items:center;gap:5px;font-family:'JetBrains Mono',monospace;
  font-size:10px;letter-spacing:0.04em;color:var(--muted);padding:5px 10px;
  border-radius:8px;background:var(--surface-2);border:1px solid var(--line)}
.vx-chip svg{width:11px;height:11px;opacity:0.7}
.vx-credit{color:var(--teal);background:rgba(45,212,191,0.07);border-color:rgba(45,212,191,0.22)}
.vx-credit svg{opacity:1}
.vx-step{display:inline-flex;align-items:center;font-family:'JetBrains Mono',monospace;
  font-size:10.5px;color:var(--text);background:var(--surface-2);border:1px solid var(--line);
  border-radius:8px;overflow:hidden}
.vx-step b{padding:0 7px;min-width:30px;text-align:center}
.vx-step button{width:24px;height:26px;background:transparent;border:none;color:var(--muted);
  cursor:pointer;font-size:13px;display:flex;align-items:center;justify-content:center;transition:all .15s}
.vx-step button:hover{background:rgba(255,255,255,0.06);color:var(--teal)}
.vx-step button:disabled{opacity:0.3;cursor:default}

/* Add scene */
.vx-addscene{width:100%;height:44px;border:1.5px dashed var(--line-strong);border-radius:14px;
  background:transparent;color:var(--muted);font-family:'JetBrains Mono',monospace;
  font-size:11px;letter-spacing:0.1em;text-transform:uppercase;cursor:pointer;
  display:flex;align-items:center;justify-content:center;gap:8px;transition:all .15s}
.vx-addscene:hover{color:var(--teal);border-color:rgba(45,212,191,0.5)}
.vx-addscene svg{width:15px;height:15px}

/* Warning */
.vx-warn{padding:4px 20px 0;text-align:center;font-family:'JetBrains Mono',monospace;
  font-size:10.5px;letter-spacing:0.05em;color:#ff5a52}

/* Actions */
.vx-actions{display:flex;gap:10px;padding:16px 20px 20px;border-top:1px solid var(--line)}
.vx-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:48px;
  border-radius:13px;cursor:pointer;border:1px solid transparent;
  font-family:'Manrope',sans-serif;font-weight:700;font-size:13.5px;letter-spacing:0.01em;transition:all .18s ease}
.vx-gen{flex:1;background:linear-gradient(135deg,var(--teal) 0%,var(--teal-deep) 100%);
  color:#04201c;box-shadow:0 8px 24px -10px rgba(45,212,191,0.45);
  text-transform:uppercase;letter-spacing:0.06em;font-weight:800}
.vx-gen:hover{filter:brightness(1.07)}
.vx-gen:disabled{opacity:0.5;cursor:default;filter:none;box-shadow:none}
.vx-btn svg{width:16px;height:16px}
.vx-spin{width:15px;height:15px;border:2px solid rgba(4,32,28,0.35);border-top-color:#04201c;
  border-radius:50%;animation:vxsp .7s linear infinite;flex-shrink:0}
@keyframes vxsp{to{transform:rotate(360deg)}}
.vx-backdrop{position:fixed;inset:0;z-index:55}
@media(max-width:560px){.vx-prow{grid-template-columns:1fr}}
@media(prefers-reduced-motion:reduce){*{animation-duration:.001ms!important}}
`

const Svg = ({
  d,
  w = 2,
  s,
  ...p
}: {
  d: React.ReactNode
  w?: number
  s?: React.CSSProperties
  [k: string]: unknown
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={w}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={s}
    {...p}
  >
    {d}
  </svg>
)

const I = {
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  chev: <path d="M6 9l6 6 6-6" />,
  chevUp: <path d="M18 15l-6-6-6 6" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  film: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M7 5v14M17 5v14M2 10h20M2 15h20" />
    </>
  ),
  mic: (
    <>
      <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18" />
    </>
  ),
  coin: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v8M9 10h4.5a1.5 1.5 0 0 1 0 3H9h5" />
    </>
  ),
}

const RATIO_LBL: Record<string, string> = {
  "16:9": "LANDSCAPE",
  "9:16": "PORTRAIT",
  "1:1": "SQUARE",
}
const RB: Record<string, { x: string; y: string }> = {
  "16:9": { x: "7%", y: "16%" },
  "9:16": { x: "33%", y: "6%" },
  "1:1": { x: "25%", y: "8%" },
}
const ORIENTATIONS: Orientation[] = ["9:16", "16:9", "1:1"]

interface BlueprintEditorProps {
  locale: "mn" | "en"
  blueprint: VideoBlueprint
  generating: boolean
  onChange: (bp: VideoBlueprint) => void
  onGenerate: () => void
}

export function BlueprintEditor({
  locale,
  blueprint,
  generating,
  onChange,
  onGenerate,
}: BlueprintEditorProps) {
  const t = (mn: string, en: string) => (locale === "mn" ? mn : en)
  const [collapsedScenes, setCollapsedScenes] = useState<Set<string>>(new Set())

  const credits = useMemo(() => estimateBlueprintCredits(blueprint), [blueprint])

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
      if (!chars[idx - 1]) return
      chars[idx - 1] = { ...chars[idx - 1], ...p }
      patch({ characters: chars })
    }
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

  const toggleCollapse = (id: string) =>
    setCollapsedScenes((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const cycleOrientation = () => {
    const idx = ORIENTATIONS.indexOf(blueprint.orientation)
    patch({ orientation: ORIENTATIONS[(idx + 1) % ORIENTATIONS.length] })
  }

  const ins = RB[blueprint.orientation] ?? RB["16:9"]
  const brk = {
    tl: { top: ins.y, left: ins.x },
    tr: { top: ins.y, right: ins.x },
    bl: { bottom: ins.y, left: ins.x },
    brr: { bottom: ins.y, right: ins.x },
  }
  const N = blueprint.scenes.length

  return (
    <div className="vx-card">
      <style>{CSS}</style>

      <div className="vx-clip">
        {/* ── HUD ── */}
        <div className="vx-hud">
          <div className="vx-hg">
            <span className="vx-rec">
              <span className="vx-dot" />
              REC
            </span>
            <span className="vx-sep">/</span>
            <span>Blueprint</span>
          </div>
          <div className="vx-hg">
            <span className="vx-tag">
              {String(N).padStart(2, "0")} scene{N > 1 ? "s" : ""}
            </span>
            <span className="vx-sep">·</span>
            <span>{blueprint.durationSec}s</span>
          </div>
        </div>

        {/* ── Viewfinder ── */}
        <div className="vx-vf">
          <div className="vx-stage" />
          <div className="vx-bokeh vx-b1" />
          <div className="vx-bokeh vx-b2" />
          <div className="vx-bokeh vx-b3" />
          <div className="vx-bokeh vx-b4" />
          <div className="vx-vig" />
          <div className="vx-br vx-tl" style={brk.tl} />
          <div className="vx-br vx-tr" style={brk.tr} />
          <div className="vx-br vx-bl" style={brk.bl} />
          <div className="vx-br vx-brr" style={brk.brr} />
          <div className="vx-slate">
            PROJECT · {String(N).padStart(2, "0")} SCENE{N > 1 ? "S" : ""}
          </div>
          <h3
            className={cn("vx-title", !blueprint.title && "vx-title-placeholder")}
            style={{ fontSize: blueprint.orientation === "16:9" ? 36 : 26 }}
          >
            {blueprint.title || t("Видеоны нэр…", "Video title…")}
          </h3>
          <button className="vx-ratio-btn" onClick={cycleOrientation}>
            {blueprint.orientation} — {RATIO_LBL[blueprint.orientation] ?? "LANDSCAPE"}
          </button>
          <div className="vx-tc">{blueprint.durationSec}s</div>
        </div>

        {/* ── Title + model toggle ── */}
        <div className="vx-title-row">
          <input
            value={blueprint.title}
            onChange={(e) => patch({ title: e.target.value })}
            className="vx-title-input"
            placeholder={t("Видеоны нэр…", "Video title…")}
          />
          <button
            onClick={() =>
              patch({ model: blueprint.model === "standard" ? "veo3" : "standard" })
            }
            className={cn("vx-model-btn", blueprint.model === "veo3" && "vx-model-btn--active")}
          >
            <Svg d={I.film} s={{ width: 12, height: 12 }} />
            {blueprint.model === "veo3" ? t("Кино", "Cinema") : t("Энгийн", "Standard")}
          </button>
        </div>

        {/* ── Scene list ── */}
        <div className="vx-body">
          <div className="vx-eye">
            <span />
            {t("Хэсгүүд", "Scenes")}
          </div>

          {blueprint.scenes.map((scene, i) => {
            const collapsed = collapsedScenes.has(scene.id)
            const charIdx = scene.characterIdx ?? 0
            const sceneChar = allCharacters[charIdx] ?? allCharacters[0]

            return (
              <div className="vx-scene" key={scene.id}>
                {/* Scene header */}
                <div
                  className={cn("vx-shd", !collapsed && "open")}
                  onClick={() => toggleCollapse(scene.id)}
                >
                  <span className="vx-snum">
                    <span />
                    Scene {String(i + 1).padStart(2, "0")}
                    <span className="vx-type-badge">
                      {scene.type === "a_roll"
                        ? t("Танилцуулагч", "Presenter")
                        : t("Дүрслэл", "Cinematic")}
                    </span>
                  </span>
                  {collapsed && (
                    <span className="vx-ssum">
                      {scene.script
                        ? scene.script.slice(0, 42) + (scene.script.length > 42 ? "…" : "")
                        : t("Хоосон хэсэг", "Empty scene")}
                    </span>
                  )}
                  <span className="vx-shp">
                    <button
                      className="vx-ib"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleCollapse(scene.id)
                      }}
                    >
                      <Svg d={collapsed ? I.chev : I.chevUp} />
                    </button>
                    {N > 1 && (
                      <button
                        className="vx-ib del"
                        onClick={(e) => {
                          e.stopPropagation()
                          removeScene(scene.id)
                        }}
                      >
                        <Svg d={I.x} />
                      </button>
                    )}
                  </span>
                </div>

                {/* Scene body */}
                {!collapsed && (
                  <div className="vx-sbd">
                    {/* Type toggle */}
                    <div className="vx-type-row">
                      <button
                        className={cn("vx-type-btn", scene.type === "a_roll" && "active")}
                        onClick={() => patchScene(scene.id, { type: "a_roll" })}
                      >
                        <Svg d={I.mic} s={{ width: 11, height: 11 }} />
                        {t("Танилцуулагч", "Presenter")}
                      </button>
                      <button
                        className={cn("vx-type-btn", scene.type === "b_roll" && "active")}
                        onClick={() => patchScene(scene.id, { type: "b_roll" })}
                      >
                        <Svg d={I.film} s={{ width: 11, height: 11 }} />
                        {t("Дүрслэл", "Cinematic")}
                      </button>
                    </div>

                    {/* Script | Style */}
                    <div className="vx-prow">
                      <div>
                        <div className="vx-eye">
                          <span />
                          {scene.type === "a_roll" ? t("Яриа", "Script") : t("Хадмал", "Caption")}
                        </div>
                        <textarea
                          className="vx-ta"
                          value={scene.script}
                          rows={4}
                          placeholder={
                            scene.type === "a_roll"
                              ? t("Юу хэлэх вэ…", "What to say…")
                              : t("Дуут тайлбар…", "Voiceover…")
                          }
                          onChange={(e) => patchScene(scene.id, { script: e.target.value })}
                        />
                      </div>
                      <div>
                        <div className="vx-eye">
                          <span />
                          {t("Дүрслэл", "Style")}
                        </div>
                        <textarea
                          className="vx-ta"
                          value={scene.visualPrompt}
                          rows={4}
                          placeholder={t(
                            "Визуал дүрслэл (англиар)…",
                            "Visual description (English)…",
                          )}
                          onChange={(e) => patchScene(scene.id, { visualPrompt: e.target.value })}
                        />
                      </div>
                    </div>

                    {/* Cast — presenter only */}
                    {scene.type === "a_roll" && (
                      <div className="vx-cast">
                        <div className="vx-eye">
                          <span />
                          {t("Дүр", "Cast")}
                        </div>
                        <div className="vx-cast-inner">
                          <AvatarPicker
                            locale={locale}
                            avatar={sceneChar.avatar}
                            orientation={blueprint.orientation}
                            required
                            onChange={(avatar) => updateCharacter(charIdx, { avatar })}
                          />
                          <VoicePicker
                            value={{
                              voiceId: sceneChar.voice.voiceId,
                              lang: sceneChar.voice.lang,
                            }}
                            onChange={(sel) =>
                              updateCharacter(charIdx, {
                                voice: { ...sceneChar.voice, ...sel },
                              })
                            }
                            locale={locale}
                          />
                        </div>
                      </div>
                    )}

                    {/* Specs */}
                    <div className="vx-spec">
                      <span className="vx-step">
                        <button
                          onClick={() =>
                            patchScene(scene.id, {
                              durationSec: Math.max(3, scene.durationSec - 1),
                            })
                          }
                          disabled={scene.durationSec <= 3}
                        >
                          −
                        </button>
                        <b>{scene.durationSec}s</b>
                        <button
                          onClick={() =>
                            patchScene(scene.id, {
                              durationSec: Math.min(15, scene.durationSec + 1),
                            })
                          }
                          disabled={scene.durationSec >= 15}
                        >
                          +
                        </button>
                      </span>
                      <span className="vx-chip">
                        <Svg d={I.globe} s={{ width: 11, height: 11 }} />
                        {blueprint.language === "mn" ? "mn-MN" : "en-US"}
                      </span>
                      <span className="vx-chip vx-credit">
                        <Svg d={I.coin} s={{ width: 11, height: 11 }} />
                        15–30 {t("кр", "cr")}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          <button className="vx-addscene" onClick={addScene}>
            <Svg d={I.plus} />
            {t("Scene нэмэх", "Add scene")}
          </button>
        </div>

        {/* Validation message */}
        {(needsAvatar || emptyScript || emptyVisual) && (
          <div className="vx-warn">
            {needsAvatar
              ? t("Аватар зураг оруулна уу", "Add an avatar image first")
              : emptyScript
                ? t("Яриа хоосон байна", "Script is empty")
                : t("Дүрслэл хоосон байна", "Visual prompt is empty")}
          </div>
        )}

        {/* Generate */}
        <div className="vx-actions">
          <button className="vx-btn vx-gen" onClick={onGenerate} disabled={blocked}>
            {generating ? (
              <>
                <span className="vx-spin" />
                {t("Үүсгэж байна…", "Generating…")}
              </>
            ) : (
              <>
                {t("Generate", "Generate")} · {N} scene · {credits}{" "}
                {t("кр", "cr")}
                <Svg d={I.arrow} w={2.4} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
