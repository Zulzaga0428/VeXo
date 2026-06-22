"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Upload, Trash2, Loader2, Play, Pause, Mic, Check, LinkIcon } from "lucide-react"

type CambVoice = {
  id: number
  name: string
  gender: string
  language: string
}

type PreviewMap = Record<string, { audio_url: string; label: string }>

export function AdminVoicePreviewManager() {
  const [voices, setVoices] = useState<CambVoice[]>([])
  const [previews, setPreviews] = useState<PreviewMap>({})
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [linkDrafts, setLinkDrafts] = useState<Record<string, string>>({})
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({})

  const load = async () => {
    setLoading(true)
    try {
      const [vRes, pRes] = await Promise.all([
        fetch("/api/camb-voices"),
        fetch("/api/admin/voice-previews"),
      ])
      const vJson = await vRes.json()
      const pJson = await pRes.json()
      setVoices(Array.isArray(vJson?.voices) ? vJson.voices : [])
      const map: PreviewMap = {}
      for (const p of pJson?.previews ?? []) {
        map[p.voice_id] = { audio_url: p.audio_url, label: p.label ?? "" }
      }
      setPreviews(map)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const savePreview = async (voiceId: string, audioUrl: string) => {
    const res = await fetch("/api/admin/voice-previews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voice_id: voiceId, audio_url: audioUrl }),
    })
    if (!res.ok) throw new Error("Хадгалж чадсангүй")
    setPreviews((prev) => ({ ...prev, [voiceId]: { audio_url: audioUrl, label: "" } }))
  }

  const handleFileUpload = async (voiceId: string, file: File) => {
    setBusyId(voiceId)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/admin/voice-previews/upload", { method: "POST", body: fd })
      const json = await res.json()
      if (!res.ok || !json?.url) throw new Error(json?.error || "Upload failed")
      await savePreview(voiceId, json.url)
    } catch (e) {
      alert("Алдаа: " + (e as Error).message)
    } finally {
      setBusyId(null)
      const input = fileInputs.current[voiceId]
      if (input) input.value = ""
    }
  }

  const handleAddLink = async (voiceId: string) => {
    const url = (linkDrafts[voiceId] || "").trim()
    if (!url) return
    if (!/^https?:\/\//i.test(url)) {
      alert("Зөв линк оруулна уу (https://...)")
      return
    }
    setBusyId(voiceId)
    try {
      await savePreview(voiceId, url)
      setLinkDrafts((prev) => ({ ...prev, [voiceId]: "" }))
    } catch (e) {
      alert("Алдаа: " + (e as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (voiceId: string) => {
    if (!confirm("Энэ хоолойн дээжийг устгах уу?")) return
    setBusyId(voiceId)
    try {
      await fetch(`/api/admin/voice-previews?voice_id=${encodeURIComponent(voiceId)}`, {
        method: "DELETE",
      })
      setPreviews((prev) => {
        const next = { ...prev }
        delete next[voiceId]
        return next
      })
    } finally {
      setBusyId(null)
    }
  }

  const togglePlay = (voiceId: string, url: string) => {
    if (playingId === voiceId) {
      audioRef.current?.pause()
      setPlayingId(null)
      return
    }
    audioRef.current?.pause()
    const audio = new Audio(url)
    audio.crossOrigin = "anonymous"
    audioRef.current = audio
    audio.onended = () => setPlayingId(null)
    audio.onerror = () => setPlayingId(null)
    audio.play().then(
      () => setPlayingId(voiceId),
      () => setPlayingId(null),
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (voices.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        camb.ai-аас Монгол студио хоолой олдсонгүй. camb дээр хоолой clone хийсний дараа энд харагдана.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {voices.map((v) => {
        const voiceId = `camb:${v.id}`
        const preview = previews[voiceId]
        const busy = busyId === voiceId
        const playing = playingId === voiceId
        return (
          <div
            key={v.id}
            className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center"
          >
            {/* Voice info */}
            <div className="flex items-center gap-3 sm:w-56 sm:flex-shrink-0">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <Mic className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium">{v.name}</p>
                <p className="text-xs text-muted-foreground">
                  {v.gender === "male" ? "Эрэгтэй" : v.gender === "female" ? "Эмэгтэй" : "—"} ·{" "}
                  {preview ? (
                    <span className="inline-flex items-center gap-0.5 text-accent">
                      <Check className="h-3 w-3" /> Дээжтэй
                    </span>
                  ) : (
                    "Дээж байхгүй"
                  )}
                </p>
              </div>
            </div>

            {/* Current preview + controls */}
            <div className="flex flex-1 flex-col gap-3">
              {preview && (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => togglePlay(voiceId, preview.audio_url)}
                  >
                    {playing ? <Pause className="mr-1.5 h-4 w-4" /> : <Play className="mr-1.5 h-4 w-4" />}
                    {playing ? "Зогсоох" : "Сонсох"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(voiceId)}
                    disabled={busy}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}

              <input
                ref={(el) => {
                  fileInputs.current[voiceId] = el
                }}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleFileUpload(voiceId, file)
                }}
              />

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => fileInputs.current[voiceId]?.click()}
                  disabled={busy}
                  className="bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  {busy ? (
                    <>
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      Илгээж байна...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-1.5 h-4 w-4" />
                      {preview ? "Дээж солих" : "Дээж нэмэх"}
                    </>
                  )}
                </Button>

                <div className="flex flex-1 items-center gap-2">
                  <Input
                    value={linkDrafts[voiceId] ?? ""}
                    onChange={(e) =>
                      setLinkDrafts((prev) => ({ ...prev, [voiceId]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddLink(voiceId)
                    }}
                    placeholder="эсвэл линк: https://...mp3"
                    disabled={busy}
                    className="h-9 flex-1 text-sm"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => handleAddLink(voiceId)}
                    disabled={busy || !(linkDrafts[voiceId] || "").trim()}
                  >
                    <LinkIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
