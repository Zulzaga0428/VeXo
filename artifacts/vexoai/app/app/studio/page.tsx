"use client"

import { useEffect, useRef, useState } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { ChevronDown, ChevronRight, Menu, Plus, ArrowUp, Film, Loader2, Play, AlertCircle, ImageIcon, Upload, X, Mic, Check, SlidersHorizontal } from "lucide-react"
import { VoicePicker, type VoiceSelection } from "@/components/studio-voice-picker"
import { AudioTimeline, type NarrationStatus } from "@/components/studio-audio-timeline"

type SceneStatus = "idle" | "planning" | "queued" | "processing" | "voicing" | "done" | "failed"

interface StudioScene {
  summary: string
  // Rich English visual prompt from the planner, used to drive the video model.
  visualPrompt?: string
  // English image-to-image edit prompt. When set together with a user image,
  // we transform the photo (e.g. into an office) BEFORE animating it. Empty/
  // unset = animate the image as-is.
  imageEditPrompt?: string
  // Marks that this scene's user image has already been edited (image-to-image)
  // so we don't edit it twice on regenerate.
  imageEdited?: boolean
  // The user's ORIGINAL uploaded photo, kept so "New images" can re-edit from
  // scratch instead of compounding edits on an already-edited image.
  originalImageUrl?: string
  narration: string
  status: SceneStatus
  progress: number
  posterUrl?: string
  // A user-uploaded image used as the image-to-video source (not an AI poster).
  sourceImageUrl?: string
  videoUrl?: string
  // Per-scene voice override. Falls back to the global voice when unset.
  voice?: VoiceSelection
  // Seconds of silence before the narration starts, so the speaker's mouth has
  // time to open before talking. Defaults to 0.5s when unset.
  audioStartOffset?: number
  // Pre-generated narration so the user can preview and position the voice on the
  // timeline BEFORE final render. Reused at produce time so we don't re-charge
  // TTS and so the final output matches the waveform the user positioned.
  narrationAudioUrl?: string
  narrationDurationSec?: number
  narrationPeaks?: number[]
  // false when the audio is MP3 (Gemini global voices) and can't be decoded into
  // a waveform — the timeline then shows a plain block instead of bars.
  narrationWaveSupported?: boolean
  // Identity of the generated audio: voice + lang + text. If the scene's current
  // key differs, the stored audio is stale and is regenerated.
  narrationKey?: string
  narrationStatus?: NarrationStatus
  error?: string
}

// Default delay (seconds) before a scene's narration begins.
const DEFAULT_AUDIO_OFFSET = 0.5
// Largest start delay we allow, kept in sync with the server pad/merge clamps.
const MAX_AUDIO_OFFSET = 5

// The text that gets voiced for a scene (narration, falling back to summary).
function narrationTextFor(scene: StudioScene): string {
  return (scene.narration || scene.summary || "").trim()
}
// Stable identity of a scene's narration audio. When voice/lang/text changes the
// key changes, marking any stored audio stale.
function narrationKeyFor(text: string, voiceId: string, lang: string): string {
  return `${voiceId}|${lang}|${text}`
}

interface ChatMessage {
  role: "user" | "agent"
  text: string
  // Inline confirm card asking whether to use uploaded images / picked voices.
  confirm?: {
    idea: string
    imageScenes: number[] // scene indexes (0-based) that have an uploaded image
    voiceScenes: number[] // scene indexes (0-based) that have a picked voice
    resolved?: boolean // once the user answers, the card becomes read-only
  }
  // Inline clarify card: the agent asks 1-2 quick questions to sharpen the brief.
  clarify?: {
    idea: string
    questions: { question: string; options: string[] }[]
    resolved?: boolean
  }
  // Inline plan card: the agent shows the planned scenes and waits for the user
  // to confirm before spending any credits on video generation.
  plan?: {
    idea: string
    scenes: { summary: string; visualPrompt?: string; imageEditPrompt?: string; narration: string }[]
    useImages: boolean
    useVoices: boolean
    resolved?: boolean
  }
  // Inline poster-review card: AI-generated preview images are shown so the user
  // can approve them BEFORE spending credits on video. Only shown when at least
  // one scene needs an AI image (scenes with a user-uploaded image skip this).
  posterReview?: {
    idea: string
    resolved?: boolean
  }
}

// Default to a real camb.ai studio voice (Нандиа) so narration uses the user's
// cloned Mongolian voice out of the box. The picker still refines this to the
// first available camb voice once /api/camb-voices loads.
const DEFAULT_VOICE = "camb:182577"

type VideoModelId = "standard" | "veo3"

// Video model tiers (UI labels + credit cost). The actual FAL endpoints live
// server-side in lib/fal-video.ts; we only pass the tier id.
const VIDEO_MODELS: {
  id: VideoModelId
  name: string
  engine: string
  credits: number
  maxDuration: number
  descMn: string
  descEn: string
}[] = [
  { id: "standard", name: "Standard", engine: "Vexo 3.0", credits: 10, maxDuration: 15, descMn: "Хурдан, дуутай — өдөр тутмын контентод", descEn: "Fast, with audio — for everyday content" },
  { id: "veo3", name: "Cinematic", engine: "Vexo 3.5", credits: 40, maxDuration: 8, descMn: "Хамгийн өндөр чанар, дуутай", descEn: "Top quality, with audio" },
]
// Lip-sync surcharge per scene — mirrors CREDIT_COST.lipsync (server is source of truth).
const LIPSYNC_COST = 6

export default function StudioPage() {
  const [navOpen, setNavOpen] = useState(false)
  const [prompt, setPrompt] = useState("")
  const [sceneCount, setSceneCount] = useState(1)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [ratio, setRatio] = useState<"16:9" | "9:16">("16:9")
  const [videoModel, setVideoModel] = useState<VideoModelId>("standard")
  const [modelMenuOpen, setModelMenuOpen] = useState(false)
  // On by default: when the video has a speaking person, sync their mouth to the
  // narration so the voice and lips match (avoids the "wrong voice / broken mouth"
  // look). Falls back to a plain audio merge for faceless / product shots.
  const [lipSync, setLipSync] = useState(true)
  // "natural" = LatentSync (diffusion, no seam, best for close-up faces)
  // "pro"     = Sync Labs lipsync-2-pro (fast, good for wide shots)
  const [lipsyncEngine, setLipsyncEngine] = useState<"natural" | "pro">("natural")

  // Voice selection drives the language: a Mongolian voice → Mongolian video,
  // a Global language → that language. UI text follows mn/en only.
  const [voiceSel, setVoiceSel] = useState<VoiceSelection>({ voiceId: DEFAULT_VOICE, lang: "mn" })
  const locale: "en" | "mn" = voiceSel.lang === "en" ? "en" : "mn"
  // First real camb (studio/cloned) voice id, e.g. "camb:182577". We prefer this
  // over the Gemini fallback so generations always use the user's own voice.
  const [defaultCambVoice, setDefaultCambVoice] = useState<VoiceSelection | null>(null)
  // Mirror for closures (poll callbacks) that may capture a stale state value.
  const defaultCambVoiceRef = useRef<VoiceSelection | null>(null)
  const cambAppliedRef = useRef(false)

  // Load the account's camb voices once and, if the user is still on the Gemini
  // default, switch the global selection to the first real camb voice. This is
  // the authoritative default so a fast "Send" never falls back to Gemini.
  useEffect(() => {
    let active = true
    fetch("/api/camb-voices")
      .then((r) => r.json())
      .then((d) => {
        if (!active || !Array.isArray(d?.voices) || d.voices.length === 0) return
        // Prefer the configured default voice (Нандиа) if the account still has
        // it; only fall back to the first available camb voice if it's gone.
        const defaultId = Number(DEFAULT_VOICE.split(":")[1])
        const preferred = d.voices.find((v: { id: number }) => v.id === defaultId) ?? d.voices[0]
        const sel: VoiceSelection = { voiceId: `camb:${preferred.id}`, lang: preferred.language || "mn" }
        setDefaultCambVoice(sel)
        defaultCambVoiceRef.current = sel
        // Only replace the current selection if the configured default isn't
        // actually available — never override a voice the user can really use.
        const defaultAvailable = d.voices.some((v: { id: number }) => v.id === defaultId)
        if (!cambAppliedRef.current && voiceSel.voiceId === DEFAULT_VOICE && !defaultAvailable) {
          cambAppliedRef.current = true
          setVoiceSel(sel)
        }
      })
      .catch(() => {})
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [scenes, setScenes] = useState<StudioScene[]>([])
  const promptRef = useRef<HTMLTextAreaElement>(null)

  // Auto-grow the prompt textarea with its content (up to a max height), so long
  // prompts expand instead of showing an inner scrollbar.
  const autoGrow = (el: HTMLTextAreaElement | null) => {
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }
  useEffect(() => {
    autoGrow(promptRef.current)
  }, [prompt])
  const [busy, setBusy] = useState(false)
  const [activeScene, setActiveScene] = useState(0)
  // Mobile only: which pane is visible (desktop shows both side by side).
  const [mobileView, setMobileView] = useState<"chat" | "result">("chat")
  // Image upload: which scene is being edited + busy flag.
  const [editingScene, setEditingScene] = useState<number | null>(null)
  const [editBusy, setEditBusy] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Separate input for the chat toolbar "Image" button (uploads into a scene).
  const chatImageInputRef = useRef<HTMLInputElement>(null)
  // Keep a live copy so polling callbacks always read the latest scenes.
  const scenesRef = useRef<StudioScene[]>([])
  const setScenesSafe = (updater: (prev: StudioScene[]) => StudioScene[]) => {
    setScenes((prev) => {
      const next = updater(prev)
      scenesRef.current = next
      return next
    })
  }
  // Dedupes narration generation per scene+key so a preview that's mid-flight
  // (rapid clicks, or final produce racing an in-progress preview) never charges
  // TTS more than once — concurrent callers share the same promise.
  const narrationInFlightRef = useRef<Map<string, Promise<void>>>(new Map())

  const t = (mn: string, en: string) => (locale === "mn" ? mn : en)

  // Per-scene clip length. A model's `maxDuration` is its *capability* ceiling
  // (Kling 3.0 = 15s), NOT how long each scene should be. Multi-scene reels
  // want short, punchy clips, so cap each scene at a sane length — keeps
  // generation fast and cheap. (Capped at the model max for safety.)
  const activeModel = VIDEO_MODELS.find((m) => m.id === videoModel) ?? VIDEO_MODELS[0]
  const SCENE_TARGET_SECONDS = 8
  const maxDuration = Math.min(SCENE_TARGET_SECONDS, activeModel.maxDuration)

  // Upload a user-provided image for one scene (becomes its poster + image-to-video source).
  const uploadSceneImage = async (index: number, file: File) => {
    if (editBusy) return
    setEditBusy(true)
    try {
      const form = new FormData()
      form.append("file", file)
      const r = await fetch("/api/upload-image", { method: "POST", body: form })
      const d = await r.json()
      const url = d?.url
      if (!url) throw new Error(d?.error || "no url")
      setScenesSafe((prev) => {
        // If no scenes exist yet (no prompt sent), seed empty placeholders.
        const u =
          prev.length > 0
            ? [...prev]
            : Array.from(
                { length: sceneCount },
                (): StudioScene => ({
                  summary: "",
                  narration: "",
                  status: "idle" as SceneStatus,
                  progress: 0,
                }),
              )
        u[index] = {
          ...(u[index] || { summary: "", narration: "", status: "idle", progress: 0 }),
          posterUrl: url,
          sourceImageUrl: url,
        }
        return u
      })
      setEditingScene(null)
    } catch {
      setMessages((m) => [
        ...m,
        { role: "agent", text: t("Зураг оруулахад алдаа гарлаа.", "Couldn't upload the image.") },
      ])
    } finally {
      setEditBusy(false)
    }
  }

  const openImageEditor = (index: number) => {
    setEditingScene(index)
  }

  // Patch one scene, seeding placeholder scenes if none exist yet.
  const patchScene = (index: number, patch: Partial<StudioScene>) => {
    setScenesSafe((prev) => {
      const u =
        prev.length > 0
          ? [...prev]
          : Array.from(
              { length: sceneCount },
              (): StudioScene => ({
                summary: "",
                narration: "",
                status: "idle" as SceneStatus,
                progress: 0,
              }),
            )
      u[index] = { ...(u[index] || { summary: "", narration: "", status: "idle", progress: 0 }), ...patch }
      return u
    })
  }

  // Resolve the voice that will actually be used for a scene: per-scene override,
  // else the global selection; swap in the resolved camb default if neither is a
  // usable camb voice. Shared by preview + produce so their narration keys match.
  const resolveSceneVoice = (scene: StudioScene): VoiceSelection => {
    let sceneVoice = scene.voice ?? voiceSel
    if (!sceneVoice.voiceId.startsWith("camb:") && defaultCambVoiceRef.current) {
      sceneVoice = defaultCambVoiceRef.current
    }
    return sceneVoice
  }

  // Set a per-scene voice. Changing the voice invalidates any pre-generated
  // narration (different voice => different audio) so the waveform regenerates.
  const setSceneVoice = (index: number, voice: VoiceSelection) => {
    patchScene(index, {
      voice,
      narrationAudioUrl: undefined,
      narrationDurationSec: undefined,
      narrationPeaks: undefined,
      narrationWaveSupported: undefined,
      narrationKey: undefined,
      narrationStatus: "idle",
    })
  }

  const setSceneOffset = (index: number, audioStartOffset: number) => {
    patchScene(index, { audioStartOffset })
  }

  // Generate (or reuse) a scene's narration audio + waveform so the user can
  // preview and position the voice before final render. Charges TTS once; reuses
  // existing audio when the voice/lang/text key is unchanged.
  const ensureSceneNarration = (index: number): Promise<void> => {
    const scene = scenesRef.current[index]
    if (!scene) return Promise.resolve()
    const text = narrationTextFor(scene)
    if (!text) return Promise.resolve()
    const voice = resolveSceneVoice(scene)
    const key = narrationKeyFor(text, voice.voiceId, voice.lang)
    if (scene.narrationAudioUrl && scene.narrationKey === key && scene.narrationStatus === "ready") {
      return Promise.resolve() // already current
    }
    // Share a single in-flight request for this scene+key so rapid clicks (and a
    // produce run racing the preview) never fire /api/tts twice.
    const flightKey = `${index}|${key}`
    const existing = narrationInFlightRef.current.get(flightKey)
    if (existing) return existing

    const run = (async () => {
      patchScene(index, { narrationStatus: "generating" })
      try {
        const ttsRes = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voice: voice.voiceId, language: voice.lang }),
        })
        const ttsData = await ttsRes.json()
        if (!ttsRes.ok || !ttsData.audioUrl) {
          patchScene(index, { narrationStatus: "failed" })
          return
        }
        const audioUrl: string = ttsData.audioUrl
        let peaks: number[] | undefined
        let duration: number | undefined =
          typeof ttsData.duration === "number" ? ttsData.duration : undefined
        let supported = false
        // Decode the waveform server-side (avoids browser CORS on camb/FAL audio).
        try {
          const pkRes = await fetch("/api/audio-peaks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ audioUrl }),
          })
          const pkData = await pkRes.json()
          if (pkRes.ok && pkData.supported) {
            peaks = Array.isArray(pkData.peaks) ? pkData.peaks : undefined
            if (typeof pkData.duration === "number") duration = pkData.duration
            supported = true
          }
        } catch {
          // peaks failed — keep the audio, the timeline shows a plain block
        }
        patchScene(index, {
          narrationAudioUrl: audioUrl,
          narrationDurationSec: duration,
          narrationPeaks: peaks,
          narrationWaveSupported: supported,
          narrationKey: key,
          narrationStatus: "ready",
        })
      } catch {
        patchScene(index, { narrationStatus: "failed" })
      }
    })().finally(() => {
      narrationInFlightRef.current.delete(flightKey)
    })
    narrationInFlightRef.current.set(flightKey, run)
    return run
  }

  // Generate one scene end to end: video -> poll -> tts -> merge -> save.
  const produceScene = (index: number, scene: StudioScene) =>
    new Promise<void>(async (resolve) => {
      const finish = () => resolve()
      try {
        setScenesSafe((prev) => {
          const u = [...prev]
          u[index] = { ...u[index], status: "queued", progress: 5 }
          return u
        })

        // ── AVATAR PATH: uploaded photo + narration → Kling AI Avatar ────────
        // image_url + audio_url → one model → talking video, mouth synced to voice.
        // Completely replaces the broken image-to-video → lipsync chain.
        const _narrationText = narrationTextFor(scene)
        if (scene.sourceImageUrl && _narrationText) {
          const _sceneVoice = resolveSceneVoice(scene)
          const _key = narrationKeyFor(_narrationText, _sceneVoice.voiceId, _sceneVoice.lang)

          setScenesSafe((prev) => {
            const u = [...prev]
            u[index] = { ...u[index], status: "processing", progress: 20 }
            return u
          })

          // Step 1: ensure TTS audio
          if (_narrationText) await ensureSceneNarration(index)
          const _fresh = scenesRef.current[index] ?? scene
          let _audioUrl: string | undefined
          if (_fresh.narrationAudioUrl && _fresh.narrationKey === _key) {
            _audioUrl = _fresh.narrationAudioUrl
          } else if (_narrationText) {
            try {
              const ttsRes = await fetch("/api/tts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  text: _narrationText,
                  voice: _sceneVoice.voiceId,
                  language: _sceneVoice.lang,
                }),
              })
              const ttsData = await ttsRes.json()
              if (ttsRes.ok && ttsData.audioUrl) _audioUrl = ttsData.audioUrl as string
            } catch {
              // TTS failed — fall through to error below
            }
          }

          if (!_audioUrl) {
            setScenesSafe((prev) => {
              const u = [...prev]
              u[index] = { ...u[index], status: "failed", error: "TTS failed" }
              return u
            })
            finish()
            return
          }

          // Step 2: submit Kling AI Avatar job
          setScenesSafe((prev) => {
            const u = [...prev]
            u[index] = { ...u[index], status: "processing", progress: 35 }
            return u
          })
          let _avRequestId: string | undefined
          try {
            const avRes = await fetch("/api/avatar-video", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ imageUrl: scene.sourceImageUrl, audioUrl: _audioUrl }),
            })
            const avData = await avRes.json()
            if (avRes.ok && avData.requestId) {
              _avRequestId = avData.requestId as string
            } else {
              throw new Error(avData.error || "avatar submit failed")
            }
          } catch (e) {
            setScenesSafe((prev) => {
              const u = [...prev]
              u[index] = {
                ...u[index],
                status: "failed",
                error: (e as Error).message || "avatar submit failed",
              }
              return u
            })
            finish()
            return
          }

          // Step 3: poll for result (90 × 5s = 7.5 min cap)
          setScenesSafe((prev) => {
            const u = [...prev]
            u[index] = { ...u[index], status: "processing", progress: 45 }
            return u
          })
          const _requestId = _avRequestId
          let _avPolls = 0
          const _avPoll = setInterval(async () => {
            _avPolls++
            if (_avPolls > 90) {
              clearInterval(_avPoll)
              setScenesSafe((prev) => {
                const u = [...prev]
                u[index] = { ...u[index], status: "failed", error: "timeout" }
                return u
              })
              finish()
              return
            }
            try {
              const stRes = await fetch(
                `/api/avatar-status?requestId=${encodeURIComponent(_requestId)}`,
              )
              const stData = await stRes.json()
              if (stData.status === "succeed" && stData.videoUrl) {
                clearInterval(_avPoll)
                const finalVideo = stData.videoUrl as string
                fetch("/api/save-video", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    videoUrl: finalVideo,
                    prompt: scene.summary,
                    voice: _sceneVoice.voiceId,
                    seriesCount: scenesRef.current.length,
                    sceneIndex: index,
                  }),
                }).catch(() => {})
                setScenesSafe((prev) => {
                  const u = [...prev]
                  u[index] = { ...u[index], status: "done", progress: 100, videoUrl: finalVideo }
                  return u
                })
                finish()
              } else if (stData.status === "failed") {
                clearInterval(_avPoll)
                setScenesSafe((prev) => {
                  const u = [...prev]
                  u[index] = { ...u[index], status: "failed", error: "avatar failed" }
                  return u
                })
                finish()
              }
              // "processing" → continue polling
            } catch {
              // network blip — continue
            }
          }, 5000)
          return
        }
        // ── END AVATAR PATH ───────────────────────────────────────────────────

        // If the user uploaded an image for this scene, animate it
        // (image-to-video). Otherwise generate straight from the text.
        const genMode: "image" | "text" = scene.sourceImageUrl ? "image" : "text"

        // CRITICAL: when the source is a user-uploaded image, we must NOT feed
        // the planner's freely-invented scene description (it would relocate the
        // subject, swap clothes, change the background — exactly the bug the user
        // hit). Instead, keep the original frame and only add gentle, natural
        // motion. If there's narration, the subject should look/talk to camera.
        const videoPrompt = scene.sourceImageUrl
          ? [
              "Animate this exact image. Keep the subject, background, outfit, colors,",
              "and composition exactly as they are — do not change the scene, do not",
              "move to a new location, do not alter clothing.",
              scene.narration
                ? "The subject speaks to the camera with natural mouth and facial movement,"
                : "Add only subtle, lifelike motion (gentle movement, breathing, blinking),",
              "smooth and realistic, with a steady camera.",
            ].join(" ")
          : scene.visualPrompt || scene.summary || scene.narration

        const res = await fetch("/api/generate-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: genMode,
            imageUrl: scene.sourceImageUrl,
            prompt: videoPrompt,
            duration: maxDuration,
            model: videoModel,
            generateAudio: false,
          }),
        })
        const data = await res.json()
        if (data.error || !data.requestId) {
          throw new Error(data.error || "video start failed")
        }

        setScenesSafe((prev) => {
          const u = [...prev]
          u[index] = { ...u[index], status: "processing", progress: 15 }
          return u
        })

        // Safety net: never poll forever. fal can occasionally stall or a
        // network blip can drop the "succeed" status — without a cap the
        // interval would spin forever and the next scene would wait on a
        // promise that never resolves (the "scene 3 hangs" bug).
        let polls = 0
        const MAX_POLLS = 90 // 90 × 5s = 7.5 min hard cap per scene

        const poll = setInterval(async () => {
          polls++
          if (polls > MAX_POLLS) {
            clearInterval(poll)
            setScenesSafe((prev) => {
              const u = [...prev]
              u[index] = { ...u[index], status: "failed", error: "timeout" }
              return u
            })
            finish()
            return
          }
          try {
            const sRes = await fetch(
              `/api/video-status?requestId=${data.requestId}&model=${videoModel}&mode=${genMode}`,
            )
            const sData = await sRes.json()

            if (sData.status === "succeed" && sData.videoUrl) {
              clearInterval(poll)
              const rawVideo = sData.videoUrl
              setScenesSafe((prev) => {
                const u = [...prev]
                u[index] = { ...u[index], status: "voicing", progress: 80, videoUrl: rawVideo }
                return u
              })

              // Add narration: tts → merge → save. Reuse the voice the user
              // already previewed/positioned on the timeline so we don't pay for
              // TTS twice and the final cut matches the waveform they saw.
              try {
                const sceneVoice = resolveSceneVoice(scene)
                const text = narrationTextFor(scene)
                const key = narrationKeyFor(text, sceneVoice.voiceId, sceneVoice.lang)
                // Generate narration once: this awaits (and shares) any preview the
                // user already kicked off on the timeline, so TTS is charged a
                // single time even when produce races an in-progress preview.
                if (text) await ensureSceneNarration(index)
                const fresh = scenesRef.current[index] ?? scene
                let audioUrl: string | undefined
                if (fresh.narrationAudioUrl && fresh.narrationKey === key) {
                  audioUrl = fresh.narrationAudioUrl // pre-generated on the timeline
                } else if (text) {
                  // Fallback only if ensureSceneNarration couldn't produce audio
                  // (e.g. it failed); single retry, no concurrent duplicate.
                  const ttsRes = await fetch("/api/tts", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      text,
                      voice: sceneVoice.voiceId,
                      language: sceneVoice.lang,
                    }),
                  })
                  const ttsData = await ttsRes.json()
                  if (ttsRes.ok && ttsData.audioUrl) audioUrl = ttsData.audioUrl
                }
                let finalVideo = rawVideo
                if (audioUrl) {
                  // How long the speaker stays silent before talking.
                  const offset = Math.min(MAX_AUDIO_OFFSET, Math.max(0, scene.audioStartOffset ?? DEFAULT_AUDIO_OFFSET))
                  let synced = false
                  // When lip-sync is on, drive the speaker's mouth from the
                  // narration. Falls back to a plain audio merge if it fails
                  // (e.g. product/landscape shots with no face to sync).
                  if (lipSync) {
                    // Lip-sync animates the mouth from the audio, so to keep the
                    // speaker quiet (mouth closed) for `offset`s, prepend that
                    // much silence to the narration before syncing. Padding runs
                    // server-side (no browser CORS limits) and falls back to the
                    // original audio if it can't pad.
                    let lipAudio = audioUrl
                    if (offset > 0) {
                      try {
                        const padRes = await fetch("/api/pad-audio", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ audioUrl, seconds: offset }),
                        })
                        const padData = await padRes.json()
                        if (padRes.ok && padData.url) lipAudio = padData.url
                      } catch {
                        // padding failed — sync the original audio (no delay)
                      }
                    }
                    try {
                      // Submit lipsync job — returns requestId immediately.
                      // Using async submit+poll avoids holding the HTTP connection
                      // open for 1-3 min, which production proxies (Railway etc.)
                      // can kill before LatentSync finishes.
                      const lsRes = await fetch("/api/lipsync", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ videoUrl: rawVideo, audioUrl: lipAudio, engine: lipsyncEngine }),
                      })
                      const lsSubmit = await lsRes.json()
                      if (lsRes.ok && lsSubmit.requestId) {
                        let currentId = lsSubmit.requestId as string
                        let currentEngine = lsSubmit.engine as string
                        // Poll until done — max 60 × 3 s = 3 min
                        for (let p = 0; p < 60; p++) {
                          await new Promise<void>((r) => setTimeout(r, 3000))
                          const stRes = await fetch(
                            `/api/lipsync-status?requestId=${encodeURIComponent(currentId)}&engine=${encodeURIComponent(currentEngine)}`,
                          )
                          const stData = await stRes.json()
                          if (stData.status === "done" && stData.videoUrl) {
                            finalVideo = stData.videoUrl as string
                            synced = true
                            break
                          }
                          if (stData.status === "fallback" && stData.requestId) {
                            currentId = stData.requestId as string
                            currentEngine = (stData.engine ?? "pro") as string
                            continue
                          }
                          if (stData.status === "failed") break
                          // "processing" → continue polling
                        }
                      }
                    } catch {
                      // ignore — fall through to plain merge
                    }
                  }
                  if (!synced) {
                    const mRes = await fetch("/api/merge-audio", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ videoUrl: rawVideo, audioUrl, audioStartOffset: offset }),
                    })
                    const mData = await mRes.json()
                    if (mRes.ok && mData.videoUrl) finalVideo = mData.videoUrl
                  }
                }
                fetch("/api/save-video", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    videoUrl: finalVideo,
                    prompt: scene.summary,
                    voice: sceneVoice.voiceId,
                    seriesCount: scenesRef.current.length,
                    sceneIndex: index,
                  }),
                }).catch(() => {})
                setScenesSafe((prev) => {
                  const u = [...prev]
                  u[index] = { ...u[index], status: "done", progress: 100, videoUrl: finalVideo }
                  return u
                })
              } catch {
                setScenesSafe((prev) => {
                  const u = [...prev]
                  u[index] = { ...u[index], status: "done", progress: 100, videoUrl: rawVideo }
                  return u
                })
              }
              finish()
            } else if (sData.status === "failed") {
              clearInterval(poll)
              setScenesSafe((prev) => {
                const u = [...prev]
                u[index] = { ...u[index], status: "failed", error: "video failed" }
                return u
              })
              finish()
            } else {
              // still running — nudge progress bar forward
              setScenesSafe((prev) => {
                const u = [...prev]
                if (u[index].progress < 75) u[index] = { ...u[index], progress: u[index].progress + 5 }
                return u
              })
            }
          } catch {
            clearInterval(poll)
            setScenesSafe((prev) => {
              const u = [...prev]
              u[index] = { ...u[index], status: "failed", error: "status error" }
              return u
            })
            finish()
          }
        }, 5000)
      } catch (err) {
        setScenesSafe((prev) => {
          const u = [...prev]
          u[index] = { ...u[index], status: "failed", error: (err as Error).message }
          return u
        })
        finish()
      }
    })

  const handleSubmit = async () => {
    const idea = prompt.trim()
    if (!idea || busy) return

    // If the user pre-loaded any scene image or voice before sending, ask them
    // (with checkboxes) whether the agent should use those assets with the prompt.
    const preset = scenesRef.current
    const imageScenes = preset.map((s, i) => (s?.sourceImageUrl ? i : -1)).filter((i) => i >= 0)
    const voiceScenes = preset.map((s, i) => (s?.voice ? i : -1)).filter((i) => i >= 0)

    if (imageScenes.length > 0 || voiceScenes.length > 0) {
      setMessages((m) => [
        ...m,
        { role: "user", text: idea },
        {
          role: "agent",
          text: t(
            "Та зураг/хоолой оруулсан байна. Эдгээрийг видеонд ашиглах уу?",
            "You added images/voices. Use them in the video?",
          ),
          confirm: { idea, imageScenes, voiceScenes },
        },
      ])
      setPrompt("")
      return
    }

    setMessages((m) => [...m, { role: "user", text: idea }])
    setPrompt("")
    await maybeClarifyThenGenerate(idea)
  }

  // Ask the agent whether the idea needs clarifying. If it does, show a clarify
  // card and wait for the user. Otherwise start generating right away.
  const maybeClarifyThenGenerate = async (idea: string) => {
    setBusy(true)
    try {
      const res = await fetch("/api/clarify-idea", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea, locale }),
      })
      const data = await res.json()
      if (res.ok && data.needsClarification && Array.isArray(data.questions) && data.questions.length > 0) {
        setBusy(false)
        setMessages((m) => [
          ...m,
          {
            role: "agent",
            text: t(
              "Илүү сайн видео хийхийн тулд хэдэн зүйл тодруулъя:",
              "A couple of quick questions to make this better:",
            ),
            clarify: { idea, questions: data.questions },
          },
        ])
        return
      }
    } catch {
      // fail open — just generate
    }
    setBusy(false)
    await planIdea(idea)
  }

  // The user answered the clarify card: fold their answers into the idea and plan.
  const resolveClarify = async (msgIndex: number, answers: string[]) => {
    const msg = messages[msgIndex]
    if (!msg?.clarify) return
    const baseIdea = msg.clarify.idea
    const extras = msg.clarify.questions
      .map((q, i) => (answers[i] ? `${q.question} → ${answers[i]}` : ""))
      .filter(Boolean)
    const enrichedIdea = extras.length > 0 ? `${baseIdea}\n\n${extras.join("\n")}` : baseIdea

    setMessages((m) => {
      const u = [...m]
      if (u[msgIndex]?.clarify) u[msgIndex] = { ...u[msgIndex], clarify: { ...u[msgIndex].clarify!, resolved: true } }
      return u
    })
    if (extras.length > 0) {
      setMessages((m) => [...m, { role: "user", text: extras.join(" · ") }])
    }
    await planIdea(enrichedIdea)
  }

  // If we arrived from the dashboard/home with ?idea=..., kick off generation once.
  const startedFromUrl = useRef(false)
  useEffect(() => {
    if (startedFromUrl.current) return
    let initialIdea = ""
    try {
      initialIdea = new URLSearchParams(window.location.search).get("idea")?.trim() || ""
    } catch {}
    if (initialIdea) {
      startedFromUrl.current = true
      setMessages((m) => [...m, { role: "user", text: initialIdea }])
      void maybeClarifyThenGenerate(initialIdea)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Step 1: Plan the idea into scenes and show a confirm card. This only calls
  // the text planner (no image/video models), so it spends no credits. The user
  // reviews the plan and taps "Start" to actually generate, or "Edit" to refine.
  const planIdea = async (idea: string, opts?: { useImages?: boolean; useVoices?: boolean }) => {
    const useImages = opts?.useImages ?? true
    const useVoices = opts?.useVoices ?? true
    setBusy(true)
    setMessages((m) => [...m, { role: "agent", text: t("Төлөвлөж байна...", "Planning your video...") }])
    // Does the user have their own photo attached to any scene? If so the
    // planner is allowed to write image-edit prompts (e.g. "put me in an office").
    const hasImages = useImages && scenesRef.current.some((s) => !!s.sourceImageUrl)
    try {
      const planRes = await fetch("/api/plan-episode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea, sceneCount, duration: maxDuration, locale, model: videoModel, hasImages }),
      })
      const planData = await planRes.json()
      if (!planRes.ok || !Array.isArray(planData.scenes) || planData.scenes.length === 0) {
        throw new Error(planData.error || "plan failed")
      }
      const scenes = planData.scenes
        .slice(0, sceneCount)
        .map((s: { summary?: string; visualPrompt?: string; imageEditPrompt?: string; narration?: string }) => ({
          summary: s.summary || idea,
          visualPrompt: s.visualPrompt || s.summary || idea,
          imageEditPrompt: s.imageEditPrompt || "",
          narration: s.narration || s.summary || idea,
        }))
      setMessages((m) => [
        ...m,
        {
          role: "agent",
          text: t("Ингэж ойлголоо. Зөв бол эхлүүлье:", "Here's my plan. Start when you're ready:"),
          plan: { idea, scenes, useImages, useVoices },
        },
      ])
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          role: "agent",
          text:
            t("Төлөвлөхөд алдаа гарлаа. Дахин оролдоно уу.", "Couldn't plan that. Please try again.") +
            ` (${(err as Error).message})`,
        },
      ])
    } finally {
      setBusy(false)
    }
  }

  // The user tapped "Start" on a plan card: lock the card and run generation.
  const resolvePlan = async (msgIndex: number) => {
    const msg = messages[msgIndex]
    if (!msg?.plan || msg.plan.resolved) return
    const { idea, scenes, useImages, useVoices } = msg.plan
    setMessages((m) => {
      const u = [...m]
      if (u[msgIndex]?.plan) u[msgIndex] = { ...u[msgIndex], plan: { ...u[msgIndex].plan!, resolved: true } }
      return u
    })
    await executePlan(idea, scenes, { useImages, useVoices })
  }

  // The user tapped "Edit" on a plan card: re-open the prompt with the idea so
  // they can tweak wording, then send again for a fresh plan.
  const editPlan = (msgIndex: number) => {
    const msg = messages[msgIndex]
    if (!msg?.plan) return
    setMessages((m) => {
      const u = [...m]
      if (u[msgIndex]?.plan) u[msgIndex] = { ...u[msgIndex], plan: { ...u[msgIndex].plan!, resolved: true } }
      return u
    })
    setPrompt(msg.plan.idea)
  }

  // Phase 1 of the pipeline: lay out the scenes and generate AI preview posters.
  // If any scene needs an AI image, we STOP and ask the user to approve the
  // posters before spending credits on video (the "approve image" step). Scenes
  // where the user uploaded their own image don't need approval — their image is
  // already their approval — so if every scene has an image we skip straight to
  // video.
  const executePlan = async (
    idea: string,
    plannedScenes: { summary: string; visualPrompt?: string; imageEditPrompt?: string; narration: string }[],
    opts?: { useImages?: boolean; useVoices?: boolean },
  ) => {
    const useImages = opts?.useImages ?? true
    const useVoices = opts?.useVoices ?? true
    setBusy(true)
    // On mobile, jump to the result pane so the user sees scenes render.
    setMobileView("result")

    const preset = scenesRef.current
    const planned: StudioScene[] = plannedScenes.map((s, i) => ({
      summary: s.summary || idea,
      visualPrompt: s.visualPrompt || s.summary || idea,
      imageEditPrompt: s.imageEditPrompt || "",
      narration: s.narration || s.summary || idea,
      status: "queued" as SceneStatus,
      progress: 0,
      posterUrl: useImages ? preset[i]?.posterUrl : undefined,
      sourceImageUrl: useImages ? preset[i]?.sourceImageUrl : undefined,
      imageEdited: preset[i]?.imageEdited,
      originalImageUrl: preset[i]?.originalImageUrl,
      voice: useVoices ? preset[i]?.voice : undefined,
    }))
    setScenesSafe(() => planned)
    setActiveScene(0)

    const imgAspect = ratio === "16:9" ? "16:9" : "9:16"

    // Scenes whose user-uploaded photo should be transformed first (e.g. "put me
    // in an office"): they have a source image, a non-empty edit prompt, and
    // haven't been edited yet.
    const editScenes = planned
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => s.sourceImageUrl && s.imageEditPrompt && !s.imageEdited)

    // Scenes with no image at all → generate an AI poster.
    const aiPosterScenes = planned
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => !s.posterUrl && !s.sourceImageUrl)

    try {
      if (editScenes.length > 0 || aiPosterScenes.length > 0) {
        setMessages((m) => [
          ...m,
          {
            role: "agent",
            text: t("Зураг бэлдэж байна...", "Preparing preview images..."),
          },
        ])

        await Promise.all([
          // Image-to-image edits: keep the user's subject, change the setting.
          ...editScenes.map(async ({ s, i }) => {
            try {
              const r = await fetch("/api/generate-image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  prompt: s.imageEditPrompt,
                  imageUrl: s.sourceImageUrl,
                  aspectRatio: imgAspect,
                  numImages: 1,
                }),
              })
              const d = await r.json()
              const url = d?.images?.[0]?.url
              if (!url) return
              // The edited photo becomes both the thumbnail and the frame we
              // animate, so the video uses the transformed (office) version.
              // Keep the original photo so "New images" can re-edit cleanly.
              setScenesSafe((prev) => {
                const u = [...prev]
                if (u[i] && !u[i].videoUrl) {
                  u[i] = {
                    ...u[i],
                    originalImageUrl: u[i].originalImageUrl ?? u[i].sourceImageUrl,
                    posterUrl: url,
                    sourceImageUrl: url,
                    imageEdited: true,
                  }
                }
                return u
              })
            } catch {
              /* edit is best-effort; fall back to animating the original */
            }
          }),
          // AI posters for text-only scenes.
          ...aiPosterScenes.map(async ({ s, i }) => {
            try {
              const r = await fetch("/api/generate-image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  prompt: s.visualPrompt || s.summary || idea,
                  aspectRatio: imgAspect,
                  style: "cinematic",
                  numImages: 1,
                }),
              })
              const d = await r.json()
              const url = d?.images?.[0]?.url
              if (!url) return
              setScenesSafe((prev) => {
                const u = [...prev]
                if (u[i] && !u[i].videoUrl && !u[i].posterUrl) u[i] = { ...u[i], posterUrl: url }
                return u
              })
            } catch {
              /* poster is best-effort; video can still run from text */
            }
          }),
        ])

        // Stop here and ask the user to approve the images before spending
        // credits. (Image generation is cheap/already counted; video is not.)
        setMessages((m) => [
          ...m,
          {
            role: "agent",
            text: t(
              "Зургуудыг бэлдлээ. Таалагдаж байвал видео үүсгэе:",
              "Here are the preview images. Approve to generate the video:",
            ),
            posterReview: { idea },
          },
        ])
        setBusy(false)
        return
      }

      // Every scene already has a final image (user uploads, no edit) — go.
      await runVideos(idea)
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          role: "agent",
          text: t("Алдаа гарлаа. Дахин оролдоно уу.", "Something went wrong. Please try again.") +
            ` (${(err as Error).message})`,
        },
      ])
      setBusy(false)
    }
  }

  // The user approved the preview posters: now spend credits and make the video.
  const approvePosters = async (msgIndex: number) => {
    const msg = messages[msgIndex]
    if (!msg?.posterReview || msg.posterReview.resolved) return
    const { idea } = msg.posterReview
    setMessages((m) => {
      const u = [...m]
      if (u[msgIndex]?.posterReview) {
        u[msgIndex] = { ...u[msgIndex], posterReview: { ...u[msgIndex].posterReview!, resolved: true } }
      }
      return u
    })
    setBusy(true)
    await runVideos(idea)
  }

  // Regenerate the AI posters for review (the user wasn't happy with them).
  const regeneratePosters = async (msgIndex: number) => {
    const msg = messages[msgIndex]
    if (!msg?.posterReview || msg.posterReview.resolved) return
    const { idea } = msg.posterReview
    // Mark this review card resolved and clear current AI posters so new ones
    // are generated (keep user-uploaded images untouched).
    setMessages((m) => {
      const u = [...m]
      if (u[msgIndex]?.posterReview) {
        u[msgIndex] = { ...u[msgIndex], posterReview: { ...u[msgIndex].posterReview!, resolved: true } }
      }
      return u
    })
    const current = scenesRef.current.map((s) => {
      // Edited user photo: restore the original so the edit re-runs cleanly
      // (don't stack edits on an already-edited image).
      if (s.imageEdited && s.originalImageUrl) {
        return {
          ...s,
          sourceImageUrl: s.originalImageUrl,
          posterUrl: undefined,
          imageEdited: false,
        }
      }
      // Untouched user photo: leave it as-is.
      if (s.sourceImageUrl) return s
      // AI poster: clear it so a fresh one is generated.
      return { ...s, posterUrl: undefined }
    })
    const plannedScenes = current.map((s) => ({
      summary: s.summary,
      visualPrompt: s.visualPrompt,
      imageEditPrompt: s.imageEditPrompt,
      narration: s.narration,
    }))
    setScenesSafe(() => current)
    await executePlan(idea, plannedScenes)
  }

  // Phase 2 of the pipeline: spend credits and produce the actual videos for
  // the (already approved) scenes currently in state.
  const runVideos = async (idea: string) => {
    const planned = scenesRef.current
    setBusy(true)
    setMobileView("result")
    setActiveScene(0)
    setMessages((m) => [
      ...m,
      {
        role: "agent",
        text: t(
          `${planned.length} хэсэг бэлдэж байна. Видео үүсгэж байна...`,
          `Generating ${planned.length} scene(s)...`,
        ),
      },
    ])

    try {
      // Produce scenes with limited concurrency. Running them fully
      // sequentially made scene 2 wait on scene 1 and scene 3 wait on both
      // (slow). Running ALL at once can trip fal's rate limit. A small pool
      // (2 at a time) is the sweet spot: much faster, still safe. Each
      // produceScene resolves on success OR timeout/failure, so the pool
      // can never get stuck on a hung scene.
      const POOL = 2
      let next = 0
      const runWorker = async () => {
        while (next < planned.length) {
          const i = next++
          setActiveScene(i)
          await produceScene(i, planned[i])
        }
      }
      await Promise.all(
        Array.from({ length: Math.min(POOL, planned.length) }, () => runWorker()),
      )

      setMessages((m) => [
        ...m,
        { role: "agent", text: t("Видео бэлэн боллоо!", "Your video is ready!") },
      ])
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          role: "agent",
          text: t("Алдаа гарлаа. Дахин оролдоно уу.", "Something went wrong. Please try again.") +
            ` (${(err as Error).message})`,
        },
      ])
    } finally {
      setBusy(false)
    }
  }

  // User answered the "use my images/voices?" confirm card.
  const resolveConfirm = async (msgIndex: number, useImages: boolean, useVoices: boolean) => {
    const msg = messages[msgIndex]
    if (!msg?.confirm || msg.confirm.resolved) return
    const { idea } = msg.confirm
    // Mark the card resolved and show what the agent understood.
    setMessages((m) => {
      const u = [...m]
      if (u[msgIndex]?.confirm) {
        u[msgIndex] = { ...u[msgIndex], confirm: { ...u[msgIndex].confirm!, resolved: true } }
      }
      const parts: string[] = []
      if (useImages && msg.confirm!.imageScenes.length) {
        parts.push(t("оруулсан зургуудыг", "your uploaded images"))
      }
      if (useVoices && msg.confirm!.voiceScenes.length) {
        parts.push(t("сонгосон хоолойнуудыг", "your picked voices"))
      }
      const note =
        parts.length > 0
          ? t(`Ойлголоо — ${parts.join(", ")} ашиглана.`, `Got it — using ${parts.join(" and ")}.`)
          : t("Ойлголоо — шинээр үүсгэнэ.", "Got it — generating fresh.")
      return [...u, { role: "agent" as const, text: note }]
    })
    await planIdea(idea, { useImages, useVoices })
  }

  const hasScenes = scenes.length > 0
  const current = scenes[activeScene]
  // Scene currently open in the editor panel (may be a not-yet-created slot).
  const currentEdit = editingScene !== null ? scenes[editingScene] : undefined
  // Is the stored narration still valid for the scene's CURRENT voice/text? When
  // the global voice changes, a scene without a per-scene voice keeps its old
  // audio + key — that stored waveform is now stale, so the timeline must treat
  // it as not-ready (prompt a refresh) instead of showing the wrong waveform.
  const currentEditNarrationFresh =
    !!currentEdit &&
    currentEdit.narrationStatus === "ready" &&
    !!currentEdit.narrationAudioUrl &&
    currentEdit.narrationKey ===
      narrationKeyFor(
        narrationTextFor(currentEdit),
        resolveSceneVoice(currentEdit).voiceId,
        resolveSceneVoice(currentEdit).lang,
      )

  const statusLabel = (s: SceneStatus) =>
    ({
      idle: "",
      planning: t("Төлөвлөж байна", "Planning"),
      queued: t("Дараалалд", "Queued"),
      processing: t("Видео үүсгэж байна", "Generating video"),
      voicing: t("Хоолой нэмж байна", "Adding voice"),
      done: t("Бэлэн", "Ready"),
      failed: t("Алдаа", "Failed"),
    })[s]

  return (
    <div className="h-screen overflow-hidden bg-background text-foreground">
      {/* Overlay navigation — opens when clicking the project name, closes on chat click */}
      <AppSidebar locale={locale} overlay open={navOpen} onOpenChange={setNavOpen} />

      {/* 35 / 65 split */}
      <div className="grid h-full grid-cols-1 lg:grid-cols-[35fr_65fr]">
        {/* LEFT — 35% chat */}
        <div
          className={`flex h-full min-h-0 flex-col border-r border-border ${
            mobileView === "chat" ? "flex" : "hidden"
          } lg:flex`}
          onClick={() => {
            if (navOpen) setNavOpen(false)
          }}
        >
          {/* Project name header — click (or hover on desktop) to open the main navigation */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setNavOpen((v) => !v)
            }}
            onMouseEnter={() => {
              // On devices with a real cursor, reveal the menu on hover so it's discoverable.
              if (typeof window !== "undefined" && window.matchMedia("(hover: hover)").matches) {
                setNavOpen(true)
              }
            }}
            className="group flex items-center gap-2 border-b border-border px-4 py-3 text-left transition-colors hover:bg-secondary/40"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Menu className="h-4 w-4" />
            </span>
            <span className="flex flex-1 flex-col">
              <span className="truncate text-sm font-semibold leading-tight">
                {t("Шинэ төсөл", "New Project")}
              </span>
              <span className="text-[11px] leading-tight text-muted-foreground">
                {t("Цэс нээх", "Open menu")}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </button>

          {/* Mobile-only tab switcher: Chat / Result */}
          <div className="flex gap-1 border-b border-border p-2 lg:hidden">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setMobileView("chat")
              }}
              className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-colors ${
                mobileView === "chat" ? "bg-accent text-accent-foreground" : "text-muted-foreground"
              }`}
            >
              {t("Чат", "Chat")}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setMobileView("result")
              }}
              className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-colors ${
                mobileView === "result" ? "bg-accent text-accent-foreground" : "text-muted-foreground"
              }`}
            >
              {t("Үр дүн", "Result")}
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {messages.length === 0 ? (
              <div className="flex h-full items-center justify-center text-center">
                <p className="max-w-xs text-sm text-muted-foreground">
                  {t(
                    "Санаагаа бичээд эхлүүлээрэй. Агент танд видео бүтээхэд туслана.",
                    "Describe your idea to get started. The agent will help you create a video.",
                  )}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {messages.map((m, i) => (
                  <div key={i} className="flex flex-col gap-2">
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                        m.role === "user"
                          ? "self-end bg-accent text-accent-foreground"
                          : "self-start border border-border bg-card/60 text-foreground"
                      }`}
                    >
                      {m.text}
                    </div>
                    {m.confirm && (
                      <ConfirmCard
                        confirm={m.confirm}
                        locale={locale}
                        onConfirm={(useImages, useVoices) => resolveConfirm(i, useImages, useVoices)}
                      />
                    )}
                    {m.clarify && (
                      <ClarifyCard
                        clarify={m.clarify}
                        locale={locale}
                        onResolve={(answers) => resolveClarify(i, answers)}
                      />
                    )}
                    {m.plan && (
                      <PlanCard
                        plan={m.plan}
                        locale={locale}
                        creditCost={activeModel.credits * m.plan.scenes.length + (lipSync ? LIPSYNC_COST * m.plan.scenes.length : 0)}
                        onStart={() => resolvePlan(i)}
                        onEdit={() => editPlan(i)}
                      />
                    )}
                    {m.posterReview && (
                      <PosterReviewCard
                        review={m.posterReview}
                        posters={scenes
                          .map((s) => s.posterUrl || s.sourceImageUrl)
                          .filter((u): u is string => !!u)}
                        locale={locale}
                        creditCost={activeModel.credits * Math.max(scenes.length, 1) + (lipSync ? LIPSYNC_COST * Math.max(scenes.length, 1) : 0)}
                        onApprove={() => approvePosters(i)}
                        onRegenerate={() => regeneratePosters(i)}
                      />
                    )}
                  </div>
                ))}
                {busy && (
                  <div className="flex items-center gap-2 self-start rounded-2xl border border-border bg-card/60 px-3 py-2 text-sm text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {t("Ажиллаж байна...", "Working...")}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Prompt input — clean studio style */}
          <div className="border-t border-border bg-background/20 p-3 space-y-2">
            {/* Collapsible settings panel */}
            {settingsOpen && (
              <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border/60 bg-card/40 px-3 py-2.5">
                {/* Aspect ratio */}
                <div className="flex items-center gap-0.5 rounded-lg border border-border bg-background/60 p-0.5">
                  {(["16:9", "9:16"] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRatio(r)}
                      aria-pressed={ratio === r}
                      className={`flex h-6 items-center justify-center rounded-md px-2 text-xs font-semibold transition-colors ${
                        ratio === r
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                {/* Video model selector */}
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setModelMenuOpen((v) => !v)}
                    className="flex h-7 items-center gap-1.5 rounded-lg border border-border bg-background/60 px-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-secondary"
                  >
                    <Film className="h-3.5 w-3.5 shrink-0 text-accent" />
                    <span className="whitespace-nowrap">{VIDEO_MODELS.find((m) => m.id === videoModel)?.name}</span>
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {VIDEO_MODELS.find((m) => m.id === videoModel)?.credits} cr
                    </span>
                    <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                  </button>
                  {modelMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setModelMenuOpen(false)} />
                      <div className="absolute bottom-full left-0 z-40 mb-1.5 max-w-[calc(100vw-3rem)] w-52 overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
                        {VIDEO_MODELS.map((m) => {
                          const selected = m.id === videoModel
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                setVideoModel(m.id)
                                setModelMenuOpen(false)
                              }}
                              className={`flex w-full items-start gap-2 px-3 py-2.5 text-left transition-colors hover:bg-secondary ${
                                selected ? "bg-accent/10" : ""
                              }`}
                            >
                              <Film className={`mt-0.5 h-4 w-4 shrink-0 ${selected ? "text-accent" : "text-muted-foreground"}`} />
                              <span className="flex min-w-0 flex-1 flex-col">
                                <span className="flex items-center justify-between gap-2">
                                  <span className="truncate text-xs font-semibold">{m.name}</span>
                                  <span className="shrink-0 text-[10px] font-medium text-accent">{m.credits} cr</span>
                                </span>
                                <span className="truncate text-[11px] text-muted-foreground">
                                  {m.engine} · {m.maxDuration}{t("с", "s")}
                                </span>
                                <span className="truncate text-[10px] text-muted-foreground">{t(m.descMn, m.descEn)}</span>
                              </span>
                              {selected && <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />}
                            </button>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
                {/* Lip-sync toggle */}
                <button
                  type="button"
                  onClick={() => setLipSync((v) => !v)}
                  aria-pressed={lipSync}
                  className={`flex h-7 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors ${
                    lipSync
                      ? "border-accent bg-accent/15 text-accent"
                      : "border-border bg-background/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <Mic className="h-3.5 w-3.5 shrink-0" />
                  {t("Уруул синк", "Lip sync")}
                  {lipSync && <span className="text-[10px] font-medium">+{LIPSYNC_COST}</span>}
                </button>
                {lipSync && (
                  <button
                    type="button"
                    onClick={() => setLipsyncEngine((e) => e === "natural" ? "pro" : "natural")}
                    className="flex h-7 shrink-0 items-center gap-1 rounded-lg border border-border bg-background/60 px-2.5 text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    {lipsyncEngine === "natural" ? "🌿" : "⚡"}
                    <span className="whitespace-nowrap">
                      {lipsyncEngine === "natural" ? t("Байгалийн", "Natural") : t("Хурдан", "Fast")}
                    </span>
                  </button>
                )}
              </div>
            )}

            {/* Main input card */}
            <div className="overflow-hidden rounded-2xl border border-border bg-card/60 transition-colors focus-within:border-accent/60">
              <input
                ref={chatImageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    const target = scenes.findIndex((s) => !s.posterUrl && !s.sourceImageUrl)
                    const idx = target >= 0 ? target : activeScene
                    setActiveScene(idx)
                    setMobileView("result")
                    uploadSceneImage(idx, file)
                  }
                  e.target.value = ""
                }}
              />
              <textarea
                ref={promptRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleSubmit()
                  }
                }}
                rows={3}
                placeholder={t("Санаагаа бичнэ үү...", "Describe your idea...")}
                className="block max-h-[200px] w-full resize-none bg-transparent px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
              />
              <div className="flex items-center justify-between border-t border-border/40 px-3 py-2">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => chatImageInputRef.current?.click()}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    aria-label={t("Зураг оруулах", "Add image")}
                    title={t("Зураг оруулах", "Add image")}
                  >
                    <ImageIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettingsOpen((v) => !v)}
                    className={`flex h-7 items-center gap-1.5 rounded-lg px-2 text-xs font-medium transition-colors ${
                      settingsOpen
                        ? "bg-accent/10 text-accent"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    {t("Тохиргоо", "Settings")}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!prompt.trim() || busy}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground transition-colors hover:bg-accent/90 disabled:opacity-40"
                  aria-label={t("Илгээх", "Submit")}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT — 65% result area */}
        <div
          className={`h-full min-h-0 flex-col overflow-y-auto p-6 lg:flex ${
            mobileView === "result" ? "flex" : "hidden"
          }`}
        >
          <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMobileView("chat")}
                  className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground lg:hidden"
                >
                  <ChevronDown className="h-3.5 w-3.5 rotate-90" />
                  {t("Чат", "Chat")}
                </button>
                <h2 className="text-sm font-semibold text-muted-foreground">
                  {hasScenes ? t("Үр дүн", "Result") : t("Studio", "Studio")}
                </h2>
              </div>
              {hasScenes && (
                <span className="rounded-full border border-border/50 bg-card/40 px-2.5 py-1 text-xs text-muted-foreground/70">
                  {scenes.length} {t("хэсэг", "scenes")} · {ratio}
                </span>
              )}
            </div>

            {/* Main video frame */}
            <div className="flex justify-center">
              <div
                className={`relative flex flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border-2 bg-card/30 text-center ${
                  current?.videoUrl ? "border-solid border-border" : "border-dashed border-border"
                } ${ratio === "16:9" ? "aspect-video w-full max-w-3xl" : "aspect-[9/16] h-[65vh]"}`}
              >
                {current?.videoUrl ? (
                  <video
                    key={current.videoUrl}
                    src={current.videoUrl}
                    controls
                    playsInline
                    className="h-full w-full object-cover"
                  />
                ) : current && current.status !== "idle" ? (
                  <>
                    {/* Poster image as the backdrop while the video renders */}
                    {current.posterUrl && (
                      <img
                        src={current.posterUrl || "/placeholder.svg"}
                        alt={current.summary || `Scene ${activeScene + 1}`}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    )}
                    <div className="absolute inset-0 bg-background/55" />
                    <div className="relative flex flex-col items-center gap-3">
                      {current.status === "failed" ? (
                        <AlertCircle className="h-7 w-7 text-destructive" />
                      ) : (
                        <Loader2 className="h-7 w-7 animate-spin text-accent" />
                      )}
                      <p className="text-sm font-medium text-foreground">
                        {t("Хэсэг", "Scene")} {activeScene + 1} · {statusLabel(current.status)}
                      </p>
                      {current.status !== "failed" && (
                        <div className="h-1.5 w-40 overflow-hidden rounded-full bg-secondary">
                          <div
                            className="h-full rounded-full bg-accent transition-all duration-500"
                            style={{ width: `${current.progress}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary/60 text-muted-foreground">
                      <Film className="h-6 w-6" />
                    </span>
                    <p className="text-sm text-muted-foreground/70">
                      {t("Чатад санаагаа бичнэ үү", "Describe your idea in the chat")}
                    </p>
                  </>
                )}

                {/* Edit image button — shown whenever a scene slot is selected */}
                {editingScene === null && (
                  <button
                    type="button"
                    onClick={() => openImageEditor(activeScene)}
                    className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-background/80 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm backdrop-blur transition-colors hover:bg-background"
                  >
                    <ImageIcon className="h-3.5 w-3.5" />
                    {current?.posterUrl ? t("Зураг солих", "Replace image") : t("Зураг оруулах", "Upload image")}
                  </button>
                )}
              </div>
            </div>

            {/* Scene editor panel: image (left) + voice (right) */}
            {editingScene !== null && (
              <div className="mt-3 flex justify-center">
                <div className="w-full max-w-3xl rounded-2xl border border-accent/40 bg-card/60 p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      <Film className="h-4 w-4 text-accent" />
                      {t("Хэсэг", "Scene")} {editingScene + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditingScene(null)}
                      className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {/* Left: image upload */}
                    <div className="flex flex-col">
                      <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <ImageIcon className="h-3.5 w-3.5" />
                        {t("Зураг", "Image")}
                      </span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file && editingScene !== null) uploadSceneImage(editingScene, file)
                          e.target.value = ""
                        }}
                      />
                      <button
                        type="button"
                        disabled={editBusy}
                        onClick={() => fileInputRef.current?.click()}
                        className="relative flex flex-1 flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border-2 border-dashed border-border bg-background/50 px-4 py-6 text-sm text-muted-foreground transition-colors hover:border-accent/60 hover:text-foreground disabled:opacity-50"
                      >
                        {currentEdit?.posterUrl && !editBusy && (
                          <img
                            src={currentEdit.posterUrl || "/placeholder.svg"}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover opacity-40"
                          />
                        )}
                        <span className="relative flex flex-col items-center gap-2">
                          {editBusy ? (
                            <>
                              <Loader2 className="h-6 w-6 animate-spin text-accent" />
                              {t("Оруулж байна...", "Uploading...")}
                            </>
                          ) : (
                            <>
                              <Upload className="h-6 w-6" />
                              {currentEdit?.posterUrl
                                ? t("Зураг солих", "Replace image")
                                : t("Зургаа сонгох", "Choose an image")}
                            </>
                          )}
                        </span>
                      </button>
                      {currentEdit?.sourceImageUrl && (
                        <span className="mt-1.5 flex items-center gap-1 text-[11px] text-accent">
                          <Film className="h-3 w-3" />
                          {t("Энэ зургийг видео болгоно", "This image becomes video")}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Mic className="h-3.5 w-3.5" />
                        {t("Хоолой", "Voice")}
                      </span>
                      <div className="flex flex-1 flex-col justify-center rounded-xl border border-border bg-background/50 p-2">
                        <VoicePicker
                          value={currentEdit?.voice ?? voiceSel}
                          onChange={(v) => editingScene !== null && setSceneVoice(editingScene, v)}
                          locale={locale}
                        />
                        <p className="mt-2 px-1 text-[11px] text-muted-foreground/60">
                          {t(
                            "Энэ хэсгийн хоолой. Хэсэг бүрд өөр хоолой сонгож болно.",
                            "Voice for this scene. Each scene can use a different voice.",
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Voice timeline — see the narration's waveform and drag where
                      the voice starts within the scene's clip window. */}
                  <AudioTimeline
                    windowSec={maxDuration}
                    offsetSec={currentEdit?.audioStartOffset ?? DEFAULT_AUDIO_OFFSET}
                    maxOffsetSec={MAX_AUDIO_OFFSET}
                    onOffsetChange={(s) => editingScene !== null && setSceneOffset(editingScene, s)}
                    status={
                      currentEdit?.narrationStatus === "generating"
                        ? "generating"
                        : currentEditNarrationFresh
                          ? "ready"
                          : currentEdit?.narrationStatus === "failed"
                            ? "failed"
                            : "idle"
                    }
                    audioUrl={currentEditNarrationFresh ? currentEdit?.narrationAudioUrl : undefined}
                    audioDurationSec={currentEditNarrationFresh ? currentEdit?.narrationDurationSec : undefined}
                    peaks={currentEditNarrationFresh ? currentEdit?.narrationPeaks : undefined}
                    waveSupported={currentEditNarrationFresh ? currentEdit?.narrationWaveSupported : undefined}
                    hasText={!!currentEdit && narrationTextFor(currentEdit).length > 0}
                    onGenerate={() => editingScene !== null && ensureSceneNarration(editingScene)}
                    locale={locale}
                  />
                </div>
              </div>
            )}

            {/* Scene strip — HeyGen style horizontal scroll */}
            <div className="mt-4 overflow-x-auto pb-1">
              <div className="flex gap-3" style={{ minWidth: "max-content" }}>
                {(hasScenes ? scenes : Array.from({ length: sceneCount }).map(() => null)).map(
                  (s, i) => {
                    const isActive = i === activeScene
                    const isDone = s?.status === "done"
                    const isFailed = s?.status === "failed"
                    const isProcessing = s && s.status !== "idle" && s.status !== "done" && s.status !== "failed"
                    const thumbW = ratio === "16:9" ? 144 : 90
                    const thumbH = ratio === "16:9" ? 82 : 144

                    return (
                      <div key={i} className="flex shrink-0 flex-col gap-1.5" style={{ width: thumbW }}>
                        {/* Thumbnail button */}
                        <button
                          type="button"
                          onClick={() => {
                            if (i === activeScene) openImageEditor(i)
                            else setActiveScene(i)
                          }}
                          style={{ height: thumbH }}
                          className={`group relative flex w-full items-center justify-center overflow-hidden rounded-xl border-2 bg-card/30 transition-all ${
                            isActive
                              ? "border-accent shadow-[0_0_12px_rgba(0,200,100,0.15)]"
                              : "border-border/40 hover:border-border"
                          }`}
                        >
                          {/* Scene number pill — top left */}
                          <span className="absolute left-1.5 top-1.5 z-10 flex h-5 min-w-[20px] items-center justify-center rounded-md bg-black/60 px-1.5 text-[10px] font-bold text-white backdrop-blur-sm">
                            {i + 1}
                          </span>

                          {/* Status badge — top right */}
                          {isDone && (
                            <span className="absolute right-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-accent shadow">
                              <Check className="h-3 w-3 text-accent-foreground" />
                            </span>
                          )}
                          {isFailed && (
                            <span className="absolute right-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-destructive shadow">
                              <AlertCircle className="h-3 w-3 text-white" />
                            </span>
                          )}
                          {isProcessing && !s?.posterUrl && (
                            <span className="absolute right-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-background/70 backdrop-blur-sm">
                              <Loader2 className="h-3 w-3 animate-spin text-accent" />
                            </span>
                          )}

                          {/* Media content */}
                          {s?.videoUrl ? (
                            <>
                              <video src={s.videoUrl} muted playsInline className="h-full w-full object-cover" />
                              <span className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
                                <Play className="h-5 w-5 fill-white text-white drop-shadow-lg" />
                              </span>
                            </>
                          ) : s?.posterUrl ? (
                            <>
                              <img src={s.posterUrl} alt={`Scene ${i + 1}`} className="h-full w-full object-cover" />
                              {isProcessing && (
                                <span className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-[1px]">
                                  <Loader2 className="h-5 w-5 animate-spin text-accent" />
                                </span>
                              )}
                            </>
                          ) : isProcessing ? (
                            <Loader2 className="h-5 w-5 animate-spin text-accent" />
                          ) : (
                            <span className="flex flex-col items-center gap-1 text-muted-foreground/30 transition-colors group-hover:text-accent/60">
                              <Plus className="h-5 w-5" />
                              <span className="text-[9px] font-medium">{t("Зураг", "Img")}</span>
                            </span>
                          )}
                        </button>

                        {/* Scene info below thumbnail */}
                        <div className="px-0.5">
                          {s?.summary ? (
                            <p
                              className={`line-clamp-2 text-[10px] leading-tight transition-colors ${
                                isActive ? "text-foreground" : "text-muted-foreground/60"
                              }`}
                            >
                              {s.summary}
                            </p>
                          ) : (
                            <p className="text-[10px] leading-tight text-muted-foreground/30">
                              {t("Хэсэг", "Scene")} {i + 1}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  },
                )}
              </div>
            </div>

            {/* Voice picker (Gemini) — Mongolian + Global languages, with preview */}
            <div className="mt-5 flex justify-center">
              <VoicePicker value={voiceSel} onChange={setVoiceSel} locale={locale} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Inline chat card: lets the user confirm whether the agent should use the
// images / voices they uploaded before sending the prompt.
function ConfirmCard({
  confirm,
  locale,
  onConfirm,
}: {
  confirm: NonNullable<ChatMessage["confirm"]>
  locale: "mn" | "en"
  onConfirm: (useImages: boolean, useVoices: boolean) => void
}) {
  const tc = (mn: string, en: string) => (locale === "mn" ? mn : en)
  const hasImages = confirm.imageScenes.length > 0
  const hasVoices = confirm.voiceScenes.length > 0
  const [useImages, setUseImages] = useState(hasImages)
  const [useVoices, setUseVoices] = useState(hasVoices)
  const resolved = !!confirm.resolved

  const sceneList = (arr: number[]) => arr.map((i) => i + 1).join(", ")

  return (
    <div className="max-w-[85%] self-start rounded-2xl border border-accent/40 bg-card/60 p-3">
      <div className="flex flex-col gap-2">
        {hasImages && (
          <label
            className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-sm transition-colors ${
              useImages && !resolved ? "border-accent/60 bg-accent/10" : "border-border bg-background/40"
            } ${resolved ? "opacity-70" : "cursor-pointer"}`}
          >
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                useImages ? "border-accent bg-accent text-accent-foreground" : "border-muted-foreground/40"
              }`}
            >
              {useImages && <Check className="h-3 w-3" />}
            </span>
            <input
              type="checkbox"
              checked={useImages}
              disabled={resolved}
              onChange={(e) => setUseImages(e.target.checked)}
              className="sr-only"
            />
            <span className="flex items-center gap-1.5">
              <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
              {tc(
                `Зургийг хөдөлгөөнт видео болгох (хэсэг ${sceneList(confirm.imageScenes)})`,
                `Animate my images into video (scene ${sceneList(confirm.imageScenes)})`,
              )}
            </span>
          </label>
        )}
        {hasVoices && (
          <label
            className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-sm transition-colors ${
              useVoices && !resolved ? "border-accent/60 bg-accent/10" : "border-border bg-background/40"
            } ${resolved ? "opacity-70" : "cursor-pointer"}`}
          >
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                useVoices ? "border-accent bg-accent text-accent-foreground" : "border-muted-foreground/40"
              }`}
            >
              {useVoices && <Check className="h-3 w-3" />}
            </span>
            <input
              type="checkbox"
              checked={useVoices}
              disabled={resolved}
              onChange={(e) => setUseVoices(e.target.checked)}
              className="sr-only"
            />
            <span className="flex items-center gap-1.5">
              <Mic className="h-3.5 w-3.5 text-muted-foreground" />
              {tc(
                `Сонгосон хоолой (хэсэг ${sceneList(confirm.voiceScenes)})`,
                `Picked voices (scene ${sceneList(confirm.voiceScenes)})`,
              )}
            </span>
          </label>
        )}
        {!resolved && (
          <button
            type="button"
            onClick={() => onConfirm(useImages, useVoices)}
            className="mt-1 flex items-center justify-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
          >
            <ArrowUp className="h-4 w-4" />
            {tc("Видео үүсгэх", "Generate video")}
          </button>
        )}
        {resolved && (
          <span className="text-xs text-muted-foreground/70">{tc("Илгээгдсэн", "Submitted")}</span>
        )}
      </div>
    </div>
  )
}

// Clarify card: the agent asks 1-2 short questions (chips) to sharpen the brief.
// The user can tap a suggested answer, type their own, or skip entirely.
function ClarifyCard({
  clarify,
  locale,
  onResolve,
}: {
  clarify: NonNullable<ChatMessage["clarify"]>
  locale: "mn" | "en"
  onResolve: (answers: string[]) => void
}) {
  const tc = (mn: string, en: string) => (locale === "mn" ? mn : en)
  const [answers, setAnswers] = useState<string[]>(() => clarify.questions.map(() => ""))
  const resolved = !!clarify.resolved

  const setAnswer = (qi: number, value: string) => {
    setAnswers((prev) => {
      const u = [...prev]
      u[qi] = value
      return u
    })
  }

  return (
    <div className="max-w-[85%] self-start rounded-2xl border border-accent/40 bg-card/60 p-3">
      <div className="flex flex-col gap-3">
        {clarify.questions.map((q, qi) => (
          <div key={qi} className="flex flex-col gap-2">
            <span className="text-sm font-medium text-foreground">{q.question}</span>
            <div className="flex flex-wrap gap-1.5">
              {q.options.map((opt) => {
                const selected = answers[qi] === opt
                return (
                  <button
                    key={opt}
                    type="button"
                    disabled={resolved}
                    onClick={() => setAnswer(qi, selected ? "" : opt)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      selected
                        ? "border-accent bg-accent text-accent-foreground"
                        : "border-border bg-background/40 text-muted-foreground hover:text-foreground"
                    } ${resolved ? "opacity-70" : ""}`}
                  >
                    {opt}
                  </button>
                )
              })}
            </div>
            {!resolved && (
              <input
                type="text"
                value={q.options.includes(answers[qi]) ? "" : answers[qi]}
                onChange={(e) => setAnswer(qi, e.target.value)}
                placeholder={tc("Эсвэл өөрөө бичих...", "Or type your own...")}
                className="w-full rounded-lg border border-border bg-background/40 px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-accent/60 focus:outline-none"
              />
            )}
          </div>
        ))}
        {!resolved ? (
          <div className="mt-1 flex items-center gap-2">
            <button
              type="button"
              onClick={() => onResolve(answers)}
              className="flex items-center justify-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
            >
              <ArrowUp className="h-4 w-4" />
              {tc("Видео үүсгэх", "Generate video")}
            </button>
            <button
              type="button"
              onClick={() => onResolve(clarify.questions.map(() => ""))}
              className="rounded-full border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {tc("Алгасах", "Skip")}
            </button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground/70">{tc("Илгээгдсэн", "Submitted")}</span>
        )}
      </div>
    </div>
  )
}

// Shows the agent's planned scenes before any credits are spent. The user taps
// "Start" to generate or "Edit" to refine the prompt. Builds trust and prevents
// wasting credits on a misunderstood brief.
function PlanCard({
  plan,
  locale,
  creditCost,
  onStart,
  onEdit,
}: {
  plan: NonNullable<ChatMessage["plan"]>
  locale: "mn" | "en"
  creditCost: number
  onStart: () => void
  onEdit: () => void
}) {
  const tc = (mn: string, en: string) => (locale === "mn" ? mn : en)
  const resolved = !!plan.resolved

  return (
    <div className="max-w-[85%] self-start rounded-2xl border border-accent/40 bg-card/60 p-3">
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {tc(`${plan.scenes.length} хэсэг`, `${plan.scenes.length} scene${plan.scenes.length > 1 ? "s" : ""}`)}
          </span>
          <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent">
            ~{creditCost} cr
          </span>
        </div>
        <ol className="flex flex-col gap-2">
          {plan.scenes.map((s, i) => (
            <li key={i} className="flex gap-2 rounded-lg border border-border bg-background/40 p-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[11px] font-bold text-accent">
                {i + 1}
              </span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-xs font-medium text-foreground">{s.summary}</span>
                {s.narration && (
                  <span className="text-[11px] italic text-muted-foreground">&ldquo;{s.narration}&rdquo;</span>
                )}
              </div>
            </li>
          ))}
        </ol>
        {!resolved ? (
          <div className="mt-0.5 flex items-center gap-2">
            <button
              type="button"
              onClick={onStart}
              className="flex items-center justify-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
            >
              <Play className="h-4 w-4" />
              {tc("Эхлүүлэх", "Start")}
            </button>
            <button
              type="button"
              onClick={onEdit}
              className="rounded-full border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {tc("Засах", "Edit")}
            </button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground/70">{tc("Эхлүүлсэн", "Started")}</span>
        )}
      </div>
    </div>
  )
}

// Shows AI-generated preview posters so the user can approve them BEFORE we
// spend credits on the (expensive) video step. This is the "approve image"
// gate — only reached when at least one scene used an AI image.
function PosterReviewCard({
  review,
  posters,
  locale,
  creditCost,
  onApprove,
  onRegenerate,
}: {
  review: NonNullable<ChatMessage["posterReview"]>
  posters: string[]
  locale: "mn" | "en"
  creditCost: number
  onApprove: () => void
  onRegenerate: () => void
}) {
  const tc = (mn: string, en: string) => (locale === "mn" ? mn : en)
  const resolved = !!review.resolved

  return (
    <div className="max-w-[85%] self-start rounded-2xl border border-accent/40 bg-card/60 p-3">
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {tc("Зургийн урьдчилсан харагдац", "Preview images")}
          </span>
          <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent">
            ~{creditCost} cr
          </span>
        </div>
        {posters.length > 0 ? (
          <div className="grid grid-cols-3 gap-1.5">
            {posters.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={url || "/placeholder.svg"}
                alt={tc(`Хэсэг ${i + 1}-ийн зураг`, `Scene ${i + 1} image`)}
                className="aspect-square w-full rounded-lg border border-border object-cover"
              />
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">{tc("Зураг алга.", "No images.")}</span>
        )}
        {!resolved ? (
          <div className="mt-0.5 flex items-center gap-2">
            <button
              type="button"
              onClick={onApprove}
              className="flex items-center justify-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
            >
              <Check className="h-4 w-4" />
              {tc("Видео үүсгэх", "Make video")}
            </button>
            <button
              type="button"
              onClick={onRegenerate}
              className="rounded-full border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {tc("Өөр зураг", "New images")}
            </button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground/70">{tc("Баталсан", "Approved")}</span>
        )}
      </div>
    </div>
  )
}
