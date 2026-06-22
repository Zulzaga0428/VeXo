"use client"

import { useEffect, useRef, useState } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { ChevronDown, ChevronRight, Menu, Plus, ArrowUp, Film, Loader2, Play, AlertCircle, ImageIcon, Upload, X, Mic, Check } from "lucide-react"
import { VoicePicker, type VoiceSelection } from "@/components/studio-voice-picker"

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
  error?: string
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
  const SCENE_OPTIONS = [1, 2, 3, 5]
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

  // Set a per-scene voice (seeds placeholder scenes if none exist yet).
  const setSceneVoice = (index: number, voice: VoiceSelection) => {
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
      u[index] = { ...(u[index] || { summary: "", narration: "", status: "idle", progress: 0 }), voice }
      return u
    })
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

              // Add narration: tts → merge → save.
              try {
                // Per-scene voice wins; fall back to the global selection.
                // Respect whatever voice the user actually picked. Only swap in
                // the resolved default if the current selection isn't a usable
                // camb voice at all (e.g. a stale Gemini fallback id).
                let sceneVoice = scene.voice ?? voiceSel
                const isCambVoice = sceneVoice.voiceId.startsWith("camb:")
                if (!isCambVoice && defaultCambVoiceRef.current) {
                  sceneVoice = defaultCambVoiceRef.current
                }
                const ttsRes = await fetch("/api/tts", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    text: scene.narration || scene.summary,
                    voice: sceneVoice.voiceId,
                    language: sceneVoice.lang,
                  }),
                })
                const ttsData = await ttsRes.json()
                let finalVideo = rawVideo
                if (ttsData.audioUrl) {
                  let synced = false
                  // When lip-sync is on, drive the speaker's mouth from the
                  // narration. Falls back to a plain audio merge if it fails
                  // (e.g. product/landscape shots with no face to sync).
                  if (lipSync) {
                    try {
                      const lsRes = await fetch("/api/lipsync", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ videoUrl: rawVideo, audioUrl: ttsData.audioUrl, engine: lipsyncEngine }),
                      })
                      const lsData = await lsRes.json()
                      if (lsRes.ok && lsData.videoUrl) {
                        finalVideo = lsData.videoUrl
                        synced = true
                      }
                    } catch {
                      // ignore — fall through to plain merge
                    }
                  }
                  if (!synced) {
                    const mRes = await fetch("/api/merge-audio", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ videoUrl: rawVideo, audioUrl: ttsData.audioUrl }),
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

          {/* Prompt input */}
          <div className="border-t border-border p-3">
            <div className="rounded-2xl border border-border bg-card/60 p-2 transition-colors focus-within:border-accent/60">
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
                rows={1}
                placeholder={t("Видео, аватар, контент — хамтдаа бүтээцгээе...", "Video, avatar, content — let's create together...")}
                className="block max-h-[200px] w-full resize-none overflow-y-auto bg-transparent px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
              />
              <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-2 px-1 pt-1">
                <div className="flex min-w-0 flex-wrap items-center gap-1">
                  {/* Image upload. The picked image does NOT go into the chat —
                      it lands directly in the next empty scene thumbnail in the
                      result area, then we switch to the result view so the user
                      sees where it went. */}
                  <input
                    ref={chatImageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        // First scene without an image, else the active scene.
                        const target = scenes.findIndex((s) => !s.posterUrl && !s.sourceImageUrl)
                        const idx = target >= 0 ? target : activeScene
                        setActiveScene(idx)
                        setMobileView("result")
                        uploadSceneImage(idx, file)
                      }
                      e.target.value = ""
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => chatImageInputRef.current?.click()}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    aria-label={t("Зураг оруулах", "Add image")}
                    title={t("Зураг оруулах (хэсэгт нэмэгдэнэ)", "Add image (goes to a scene)")}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  {/* Scene count selector */}
                  <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-border bg-background/60 p-0.5">
                    {SCENE_OPTIONS.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setSceneCount(n)}
                        aria-pressed={sceneCount === n}
                        className={`flex h-6 w-6 items-center justify-center rounded-md text-xs font-semibold transition-colors ${
                          sceneCount === n
                            ? "bg-accent text-accent-foreground"
                            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  {/* Aspect ratio selector */}
                  <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-border bg-background/60 p-0.5">
                    {(["16:9", "9:16"] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRatio(r)}
                        aria-pressed={ratio === r}
                        className={`flex h-6 items-center justify-center rounded-md px-1.5 text-xs font-semibold transition-colors ${
                          ratio === r
                            ? "bg-accent text-accent-foreground"
                            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                  {/* Video model selector (dropdown) */}
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => setModelMenuOpen((v) => !v)}
                      className="flex h-7 items-center gap-1 rounded-lg border border-border bg-background/60 px-2 text-xs font-semibold text-foreground transition-colors hover:bg-secondary"
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
                  {/* Lip-sync toggle — matches the speaker's mouth to the voiceover */}
                  <button
                    type="button"
                    onClick={() => setLipSync((v) => !v)}
                    aria-pressed={lipSync}
                    title={t("Уруул синк", "Lip-sync")}
                    className={`flex h-7 shrink-0 items-center gap-1 rounded-lg border px-2 text-xs font-semibold transition-colors ${
                      lipSync
                        ? "border-accent bg-accent/15 text-accent"
                        : "border-border bg-background/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    <Mic className="h-3.5 w-3.5 shrink-0" />
                    <span className="whitespace-nowrap">{t("Уруул", "Lip")}</span>
                    {lipSync && (
                      <span className="text-[10px] font-medium text-accent">+{LIPSYNC_COST}</span>
                    )}
                  </button>
                  {/* Engine quality toggle — only visible when lip-sync is on */}
                  {lipSync && (
                    <button
                      type="button"
                      onClick={() => setLipsyncEngine((e) => e === "natural" ? "pro" : "natural")}
                      title={t(
                        lipsyncEngine === "natural" ? "Байгалийн (LatentSync) — уруул жигд, нүүрний залгаасгүй" : "Хурдан (Sync Labs) — өргөн тал, хурдан",
                        lipsyncEngine === "natural" ? "Natural (LatentSync) — seamless, organic lips" : "Fast (Sync Labs) — wide shots, faster",
                      )}
                      className="flex h-7 shrink-0 items-center gap-1 rounded-lg border border-border bg-background/60 px-2 text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    >
                      {lipsyncEngine === "natural" ? "🌿" : "⚡"}
                      <span className="whitespace-nowrap">
                        {lipsyncEngine === "natural" ? t("Байгалийн", "Natural") : t("Хурдан", "Fast")}
                      </span>
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!prompt.trim() || busy}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground transition-colors hover:bg-accent/90 disabled:opacity-40"
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
                  {hasScenes ? t("Үр дүн", "Result") : t("Үр дүн энд гарна", "Your result appears here")}
                </h2>
              </div>
              <span className="rounded-full border border-border bg-card/60 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                {sceneCount} {t("хэсэг", "scenes")} · {ratio}
              </span>
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
                </div>
              </div>
            )}

            {/* Numbered scene thumbnails below */}
            <div className="mt-3 flex flex-wrap justify-center gap-2.5">
              {(hasScenes ? scenes : Array.from({ length: sceneCount }).map(() => null)).map(
                (s, i) => {
                  const isActive = i === activeScene
                  return (
                    <div key={i} className="flex flex-col items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          // Allow selecting/editing even before a prompt is sent.
                          if (i === activeScene) openImageEditor(i)
                          else setActiveScene(i)
                        }}
                        className={`group relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-card/30 transition-all ${
                          isActive ? "border-accent ring-2 ring-accent/40" : "border-dashed border-border"
                        } ${ratio === "16:9" ? "h-16 w-28" : "h-28 w-16"}`}
                      >
                        <span className="absolute left-1.5 top-1.5 z-10 text-xs font-bold text-foreground/90 drop-shadow">
                          {i + 1}
                        </span>
                        {s && (
                          <span className="absolute right-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-background/80 text-foreground opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
                            <ImageIcon className="h-3 w-3" />
                          </span>
                        )}
                        {s?.videoUrl ? (
                          <>
                            <video src={s.videoUrl} muted playsInline className="h-full w-full object-cover" />
                            <Play className="absolute h-4 w-4 fill-foreground text-foreground" />
                          </>
                        ) : s?.posterUrl ? (
                          <>
                            <img
                              src={s.posterUrl || "/placeholder.svg"}
                              alt={`Scene ${i + 1}`}
                              className="h-full w-full object-cover"
                            />
                            {s.status !== "idle" && s.status !== "done" && (
                              <span className="absolute inset-0 flex items-center justify-center bg-background/45">
                                <Loader2 className="h-4 w-4 animate-spin text-accent" />
                              </span>
                            )}
                          </>
                        ) : s && s.status !== "idle" && s.status !== "done" ? (
                          <Loader2 className="h-4 w-4 animate-spin text-accent" />
                        ) : (
                          // Empty slot — show a clear "add image" affordance so
                          // users know the thumbnail is tappable to upload.
                          <span className="flex flex-col items-center gap-0.5 text-muted-foreground/50 transition-colors group-hover:text-accent">
                            <Plus className="h-4 w-4" />
                            <span className="text-[9px] font-medium leading-none">
                              {t("Зураг", "Image")}
                            </span>
                          </span>
                        )}
                      </button>
                      <span
                        className={`text-xs font-medium transition-colors ${
                          isActive ? "text-foreground" : "text-muted-foreground/70"
                        }`}
                      >
                        {t("Хэсэг", "Scene")} {i + 1}
                      </span>
                    </div>
                  )
                },
              )}
            </div>

            {editingScene === null && (
              <p className="mt-2 text-center text-xs text-muted-foreground/70">
                {t(
                  "Хэсэг дээр дарж сонгоод, дахин дарвал зураг оруулна",
                  "Tap a scene to select, tap again to upload an image",
                )}
              </p>
            )}

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
