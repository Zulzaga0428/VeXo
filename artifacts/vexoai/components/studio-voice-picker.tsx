"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronDown, Check, Mic, Play, Pause, Loader2, Globe, Trash2, Sparkles } from "lucide-react"
import { VOICES } from "@/lib/voices-catalog"

// Default neutral Gemini timbre used for every "Global" language.
const GLOBAL_TIMBRE = "Achernar"
const GLOBAL_TIMBRE_ID =
  VOICES.find((v) => v.provider === "gemini" && v.providerVoiceId === GLOBAL_TIMBRE)?.id ?? "gem-achernar"

export interface VoiceSelection {
  // Gemini voice id from the catalog (carries the providerVoiceId/timbre).
  voiceId: string
  // App language code passed to the TTS route (steers Gemini's accent).
  lang: string
}

// Global language list (subset of Gemini's 80+). Mongolian lives in its own
// section above, so this is the "rest of the world".
interface LangOption {
  code: string
  flag: string
  label: string
  labelMn: string
  sample: string
}

const GLOBAL_LANGS: LangOption[] = [
  { code: "en", flag: "🇺🇸", label: "English", labelMn: "Англи", sample: "Hi there, this is how I sound." },
  { code: "zh", flag: "🇨🇳", label: "Chinese", labelMn: "Хятад", sample: "你好，这是我的声音。" },
  { code: "es", flag: "🇪🇸", label: "Spanish", labelMn: "Испани", sample: "Hola, así suena mi voz." },
  { code: "hi", flag: "🇮🇳", label: "Hindi", labelMn: "Хинди", sample: "नमस्ते, यह मेरी आवाज़ है।" },
  { code: "ar", flag: "🇸🇦", label: "Arabic", labelMn: "Араб", sample: "مرحبا، هذا هو صوتي." },
  { code: "pt", flag: "🇧🇷", label: "Portuguese", labelMn: "Португал", sample: "Olá, esta é a minha voz." },
  { code: "ru", flag: "🇷🇺", label: "Russian", labelMn: "Орос", sample: "Привет, вот так звучит мой голос." },
  { code: "ja", flag: "🇯🇵", label: "Japanese", labelMn: "Япон", sample: "こんにちは、これが私の声です。" },
  { code: "ko", flag: "🇰🇷", label: "Korean", labelMn: "Солонгос", sample: "안녕하세요, 제 목소리입니다." },
  { code: "fr", flag: "🇫🇷", label: "French", labelMn: "Франц", sample: "Bonjour, voici ma voix." },
  { code: "de", flag: "🇩🇪", label: "German", labelMn: "Герман", sample: "Hallo, so klingt meine Stimme." },
  { code: "it", flag: "🇮🇹", label: "Italian", labelMn: "Итали", sample: "Ciao, ecco la mia voce." },
  { code: "tr", flag: "🇹🇷", label: "Turkish", labelMn: "Турк", sample: "Merhaba, sesim böyle." },
  { code: "vi", flag: "🇻🇳", label: "Vietnamese", labelMn: "Вьетнам", sample: "Xin chào, đây là giọng nói của tôi." },
  { code: "id", flag: "🇮🇩", label: "Indonesian", labelMn: "Индонез", sample: "Halo, beginilah suara saya." },
  { code: "th", flag: "🇹🇭", label: "Thai", labelMn: "Тайланд", sample: "สวัสดี นี่คือเสียงของฉัน" },
  { code: "pl", flag: "🇵🇱", label: "Polish", labelMn: "Польш", sample: "Cześć, tak brzmi mój głos." },
  { code: "uk", flag: "🇺🇦", label: "Ukrainian", labelMn: "Украин", sample: "Привіт, ось мій голос." },
  { code: "nl", flag: "🇳🇱", label: "Dutch", labelMn: "Голланд", sample: "Hallo, zo klink ik." },
]

const MN_SAMPLE = "Сайн байна уу, энэ миний хоолой."

// A premium camb.ai voice (Mongolian studio / cloned voices in the VEXO folder).
interface CambVoice {
  id: number
  name: string
  gender: string
  language: string
}

interface VoicePickerProps {
  value: VoiceSelection
  onChange: (sel: VoiceSelection) => void
  locale: "en" | "mn"
}

export function VoicePicker({ value, onChange, locale }: VoicePickerProps) {
  const [open, setOpen] = useState(false)
  const [previewing, setPreviewing] = useState<string | null>(null)
  const [loadingPreview, setLoadingPreview] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [camb, setCamb] = useState<CambVoice[]>([])
  // Admin-uploaded preview clips: voice_id -> audio_url. When present we play
  // these instead of calling TTS (no credits spent, curated quality).
  const [clips, setClips] = useState<Record<string, string>>({})
  const audioRef = useRef<HTMLAudioElement | null>(null)
  // Ensures we only auto-pick the default studio voice once (don't fight the user).
  const autoPickedRef = useRef(false)

  // Load premium camb.ai Mongolian / studio voices once.
  useEffect(() => {
    let active = true
    fetch("/api/camb-voices")
      .then((r) => r.json())
      .then((d) => {
        if (active && Array.isArray(d?.voices)) setCamb(d.voices)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  // Load admin-uploaded preview clips once.
  useEffect(() => {
    let active = true
    fetch("/api/voice-previews")
      .then((r) => r.json())
      .then((d) => {
        if (!active || !Array.isArray(d?.previews)) return
        const map: Record<string, string> = {}
        for (const p of d.previews) {
          if (p.voice_id && p.audio_url) map[p.voice_id] = p.audio_url
        }
        setClips(map)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  // When studio voices load and the user hasn't picked a real Mongolian studio
  // voice yet, auto-select the first camb voice so generations use it — but only
  // once, and never override a real choice.
  useEffect(() => {
    if (autoPickedRef.current) return
    if (camb.length === 0) return
    const usingDefault = value.voiceId === GLOBAL_TIMBRE_ID || value.voiceId === "mn-gem-achernar"
    if (usingDefault) {
      autoPickedRef.current = true
      const first = camb[0]
      onChange({ voiceId: `camb:${first.id}`, lang: first.language || "mn" })
    }
  }, [camb, value.voiceId, onChange])

  const activeCamb = camb.find((c) => value.voiceId === `camb:${c.id}`)
  const globalLang = GLOBAL_LANGS.find((l) => l.code === value.lang)
  const isMn = !activeCamb && value.lang === "mn"

  // Label shown on the closed trigger.
  const triggerName = activeCamb
    ? activeCamb.name
      : isMn
        ? locale === "mn"
          ? "Монгол"
          : "Mongolian"
        : locale === "mn"
          ? globalLang?.labelMn ?? globalLang?.label ?? value.lang
          : globalLang?.label ?? value.lang
  const triggerFlag = activeCamb ? "🇲🇳" : isMn ? "🇲🇳" : globalLang?.flag ?? "🌐"

  async function preview(key: string, text: string, voiceId: string, lang: string) {
    // If this row is already playing, a second click stops it.
    if (previewing === key) {
      if (audioRef.current) audioRef.current.pause()
      setPreviewing(null)
      setLoadingPreview(null)
      return
    }
    // Switching to another row while one is loading/playing — stop the old one.
    if (audioRef.current) audioRef.current.pause()
    if (previewing) setPreviewing(null)
    setLoadingPreview(null)

    // If an admin uploaded a curated preview clip for this voice, just play it —
    // no TTS call, no credits, instant playback.
    const clipUrl = clips[voiceId]
    if (clipUrl) {
      setPreviewError(null)
      const audio = new Audio(clipUrl)
      audio.crossOrigin = "anonymous"
      audioRef.current = audio
      setPreviewing(key)
      audio.onended = () => setPreviewing(null)
      audio.onerror = () => {
        setPreviewError(locale === "mn" ? "Аудио ачаалж чадсангүй." : "Audio failed to load.")
        setPreviewing(null)
      }
      try {
        await audio.play()
      } catch {
        setPreviewError(locale === "mn" ? "Аудио тоглуулж чадсангүй." : "Couldn't start playback.")
        setPreviewing(null)
      }
      return
    }

    setPreviewing(key)
    setLoadingPreview(key)
    setPreviewError(null)
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: voiceId, language: lang }),
      })
      if (!res.ok) {
        // Surface the real reason instead of silently doing nothing.
        let msg =
          locale === "mn" ? "Хоолой тоглуулахад алдаа гарлаа." : "Could not play this voice."
        if (res.status === 401) {
          msg = locale === "mn" ? "Нэвтэрнэ үү." : "Please sign in."
        } else if (res.status === 402) {
          msg = locale === "mn" ? "Кредит дууссан байна." : "You're out of credits."
        } else {
          const data = await res.json().catch(() => null)
          if (data?.error) msg = String(data.error)
        }
        setPreviewError(msg)
        setLoadingPreview(null)
        setPreviewing(null)
        return
      }
      const data = await res.json()
      if (data?.audioUrl) {
        if (audioRef.current) {
          audioRef.current.pause()
        }
        const audio = new Audio(data.audioUrl)
        audio.crossOrigin = "anonymous"
        audioRef.current = audio
        setLoadingPreview(null)
        audio.onended = () => setPreviewing(null)
        audio.onerror = () => {
          setPreviewError(
            locale === "mn" ? "Аудио ачаалж чадсангүй." : "Audio failed to load.",
          )
          setPreviewing(null)
        }
        try {
          await audio.play()
        } catch {
          // Autoplay blocked or decode error — tell the user.
          setPreviewError(
            locale === "mn" ? "Аудио тоглуулж чадсангүй." : "Couldn't start playback.",
          )
          setPreviewing(null)
        }
      } else {
        setPreviewError(
          locale === "mn" ? "Аудио буцаж ирсэнгүй." : "No audio was returned.",
        )
        setLoadingPreview(null)
        setPreviewing(null)
      }
    } catch {
      setPreviewError(
        locale === "mn" ? "Сүлжээний алдаа." : "Network error.",
      )
      setLoadingPreview(null)
      setPreviewing(null)
    }
  }

  return (
    <div className="relative w-full max-w-xs">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 rounded-xl border border-border bg-card/60 px-3 py-2.5 text-left transition-colors hover:border-accent/50"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
          <Mic className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] uppercase tracking-wide text-muted-foreground/70">
            {locale === "mn" ? "Хоолой" : "Voice"}
          </span>
          <span className="flex items-center gap-1.5 truncate text-sm font-semibold text-foreground">
            <span aria-hidden>{triggerFlag}</span>
            {triggerName}
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full z-20 mb-2 max-h-80 w-full overflow-y-auto rounded-xl border border-border bg-popover p-1.5 shadow-xl">
            {/* ── Premium camb.ai studio voices (high-quality Mongolian) ── */}
            {camb.length > 0 && (
              <>
                <p className="mt-1 flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                  <Sparkles className="h-3 w-3 text-accent" />
                  {locale === "mn" ? "Студио хоолой" : "Studio Voices"}
                </p>
                {camb.map((c) => {
                  const cid = `camb:${c.id}`
                  const active = value.voiceId === cid
                  const key = `camb-${c.id}`
                  const sampleText = c.language === "en" ? "Hi there, this is how I sound." : MN_SAMPLE
                  return (
                    <Row
                      key={c.id}
                      active={active}
                      title={c.name}
                      subtitle={
                        c.gender === "male"
                          ? locale === "mn" ? "Эрэгтэй · Студио чанар" : "Male · Studio quality"
                          : locale === "mn" ? "Эмэгтэй · Студио чанар" : "Female · Studio quality"
                      }
                      flag="🇲🇳"
                      previewing={previewing === key}
                      loading={loadingPreview === key}
                      onSelect={() => {
                        onChange({ voiceId: cid, lang: c.language || "mn" })
                        setOpen(false)
                      }}
                      onPreview={() => preview(key, sampleText, cid, c.language || "mn")}
                    />
                  )
                })}
              </>
            )}

            {/* ── Global section ── */}
            <p className="mt-1 flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
              <Globe className="h-3 w-3" />
              {locale === "mn" ? "Дэлхийн хэлнүүд" : "Global"}
            </p>
            {GLOBAL_LANGS.map((l) => {
              const active = !isMn && value.lang === l.code
              const key = `g-${l.code}`
              return (
                <Row
                  key={l.code}
                  active={active}
                  title={locale === "mn" ? l.labelMn : l.label}
                  subtitle={l.label}
                  flag={l.flag}
                  previewing={previewing === key}
                  loading={loadingPreview === key}
                  onSelect={() => {
                    onChange({ voiceId: GLOBAL_TIMBRE_ID, lang: l.code })
                    setOpen(false)
                  }}
                  onPreview={() => preview(key, l.sample, GLOBAL_TIMBRE_ID, l.code)}
                />
              )
            })}

            {previewError && (
              <p className="mt-1 rounded-lg bg-destructive/10 px-2.5 py-2 text-[12px] font-medium text-destructive">
                {previewError}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

interface RowProps {
  active: boolean
  title: string
  subtitle: string
  flag: string
  previewing: boolean
  loading?: boolean
  onSelect: () => void
  onPreview: () => void
  onDelete?: () => void
}

function Row({ active, title, subtitle, flag, previewing, loading, onSelect, onPreview, onDelete }: RowProps) {
  return (
    <div
      className={`group flex items-center gap-2 rounded-lg px-2 py-2 transition-colors ${
        active ? "bg-accent/15" : "hover:bg-secondary"
      }`}
    >
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <span className="text-base" aria-hidden>
          {flag}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-sm font-medium ${active ? "text-accent" : "text-foreground"}`}>
            {title}
          </span>
          <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
        </span>
        {active && <Check className="h-4 w-4 shrink-0 text-accent" />}
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete voice"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
      <button
        type="button"
        onClick={onPreview}
        aria-label={previewing ? "Stop preview" : "Play preview"}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : previewing ? (
          <Pause className="h-4 w-4 fill-current" />
        ) : (
          <Play className="h-4 w-4 fill-current" />
        )}
      </button>
    </div>
  )
}
