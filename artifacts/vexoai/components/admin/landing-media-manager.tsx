"use client"

import { useEffect, useRef, useState } from "react"
import { Upload, Loader2, Trash2, Pencil, Plus, LinkIcon } from "lucide-react"

type Item = {
  slot: string
  media_url: string
  media_type: "image" | "video"
  caption: string | null
}

const SLOTS: { key: string; title: string; hint: string }[] = [
  {
    key: "director-preview",
    title: "Director Feature Preview",
    hint: "Landing-ийн \"НАЙРУУЛАГЧИЙН ТҮВШИНД ЗАСВАРЛАНА\" хэсгийн жижиг preview панел",
  },
]

export function LandingMediaManager() {
  const [items, setItems] = useState<Record<string, Item>>({})
  const [loading, setLoading] = useState(true)
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null)
  const [progress, setProgress] = useState<Record<string, number>>({})
  const [editingCaption, setEditingCaption] = useState<Record<string, string>>({})
  const [linkUrl, setLinkUrl] = useState<Record<string, string>>({})
  const [addingLink, setAddingLink] = useState<string | null>(null)
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({})

  async function load() {
    setLoading(true)
    const res = await fetch("/api/admin/landing-media")
    if (res.ok) {
      const j = await res.json()
      const map: Record<string, Item> = {}
      for (const it of j.items ?? []) map[it.slot] = it
      setItems(map)
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function onUpload(slot: string, file: File) {
    setUploadingSlot(slot)
    setProgress((p) => ({ ...p, [slot]: 0 }))
    try {
      const fd = new FormData()
      fd.append("file", file)
      const upRes = await fetch("/api/admin/landing-media/upload", { method: "POST", body: fd })
      const upJson = await upRes.json()
      if (!upRes.ok || !upJson?.url) throw new Error(upJson?.error || "Upload failed")
      const media_type = upJson.media_type || ((file.type || "").startsWith("video/") ? "video" : "image")
      const caption = editingCaption[slot] ?? items[slot]?.caption ?? ""

      const res = await fetch("/api/admin/landing-media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot, media_url: upJson.url, media_type, caption }),
      })
      if (res.ok) {
        const j = await res.json()
        setItems((prev) => ({ ...prev, [slot]: j.item }))
      } else {
        const e = await res.json().catch(() => ({}))
        alert(e.error || "Хадгалах алдаатай")
      }
    } catch (e) {
      alert("Алдаа: " + (e as Error).message)
    } finally {
      setUploadingSlot(null)
      setProgress((p) => ({ ...p, [slot]: 0 }))
    }
  }

  async function onAddLink(slot: string) {
    const url = (linkUrl[slot] ?? "").trim()
    if (!url) return
    if (!/^https?:\/\//i.test(url)) {
      alert("Зөв линк оруулна уу (http... эсвэл https...-ээр эхэлсэн)")
      return
    }
    setAddingLink(slot)
    try {
      const clean = url.split("?")[0].toLowerCase()
      // Cloudflare Stream / YouTube / Vimeo / streaming manifests are all video.
      const isStream =
        /cloudflarestream\.com|videodelivery\.net|youtube\.com|youtu\.be|vimeo\.com/.test(clean) ||
        /\.(m3u8|mpd)$/.test(clean)
      const isVideoExt = /\.(mp4|webm|mov|m4v|ogg)$/.test(clean)
      const media_type = isStream || isVideoExt ? "video" : "image"
      const caption = editingCaption[slot] ?? items[slot]?.caption ?? ""

      const res = await fetch("/api/admin/landing-media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot, media_url: url, media_type, caption }),
      })
      if (res.ok) {
        const j = await res.json()
        setItems((prev) => ({ ...prev, [slot]: j.item }))
        setLinkUrl((prev) => ({ ...prev, [slot]: "" }))
      } else {
        const e = await res.json().catch(() => ({}))
        alert(e.error || "Хадгалах алдаатай")
      }
    } catch (e) {
      alert("Алдаа: " + (e as Error).message)
    } finally {
      setAddingLink(null)
    }
  }

  async function onDelete(slot: string) {
    if (!confirm("Энэ медиаг устгах уу?")) return
    const res = await fetch(`/api/admin/landing-media?slot=${encodeURIComponent(slot)}`, { method: "DELETE" })
    if (res.ok) {
      setItems((prev) => {
        const next = { ...prev }
        delete next[slot]
        return next
      })
    }
  }

  if (loading) return <div className="text-muted-foreground text-sm">Уншиж байна...</div>

  return (
    <div className="space-y-6">
      {SLOTS.map((slot) => {
        const item = items[slot.key]
        const isUploading = uploadingSlot === slot.key
        return (
          <div key={slot.key} className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-3">
              <h3 className="font-semibold">{slot.title}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{slot.hint}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-[280px_1fr]">
              {/* Preview */}
              <div className="aspect-video overflow-hidden rounded-lg bg-secondary/50 flex items-center justify-center">
                {item ? (
                  item.media_type === "video" ? (
                    <video src={item.media_url} muted loop autoPlay playsInline className="h-full w-full object-cover" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.media_url} alt={slot.title} className="h-full w-full object-cover" />
                  )
                ) : (
                  <span className="text-xs text-muted-foreground">Хоосон — медиа байршуулна уу</span>
                )}
              </div>

              {/* Controls */}
              <div className="flex flex-col gap-3">
                <input
                  ref={(el) => {
                    fileInputs.current[slot.key] = el
                  }}
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) onUpload(slot.key, f)
                    e.target.value = ""
                  }}
                />

                <button
                  onClick={() => fileInputs.current[slot.key]?.click()}
                  disabled={isUploading}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {progress[slot.key] && progress[slot.key] < 100
                        ? `Хуулж байна... ${progress[slot.key]}%`
                        : progress[slot.key] >= 100
                          ? "Боловсруулж байна..."
                          : "Бэлдэж байна..."}
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" /> {item ? "Өөр медиагаар солих" : "Зураг/Видео байршуулах"}
                    </>
                  )}
                </button>

                {isUploading && (
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full bg-accent transition-all duration-200 ease-out"
                      style={{ width: `${progress[slot.key] ?? 0}%` }}
                    />
                  </div>
                )}

                {/* Or add by link */}
                <div className="rounded-lg border border-dashed border-border p-3">
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-medium">
                    <LinkIcon className="h-3.5 w-3.5 text-accent" />
                    Эсвэл линкээр нэмэх (хамгийн амар)
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="text"
                      value={linkUrl[slot.key] ?? ""}
                      onChange={(e) => setLinkUrl((prev) => ({ ...prev, [slot.key]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") onAddLink(slot.key)
                      }}
                      placeholder="https://example.com/video.mp4"
                      disabled={addingLink === slot.key}
                      className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60"
                    />
                    <button
                      onClick={() => onAddLink(slot.key)}
                      disabled={addingLink === slot.key || !(linkUrl[slot.key] ?? "").trim()}
                      className="inline-flex items-center justify-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
                    >
                      {addingLink === slot.key ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Нэмж байна...
                        </>
                      ) : (
                        <>
                          <Plus className="h-3.5 w-3.5" /> Нэмэх
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {item && (
                  <>
                    <div className="text-xs text-muted-foreground break-all">
                      <span className="font-medium text-foreground">URL:</span> {item.media_url}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <Pencil className="h-3 w-3 text-muted-foreground" />
                      <input
                        type="text"
                        defaultValue={item.caption ?? ""}
                        placeholder="Тайлбар (хүсвэл)"
                        onBlur={(e) =>
                          setEditingCaption((prev) => ({ ...prev, [slot.key]: e.target.value }))
                        }
                        className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-foreground placeholder:text-muted-foreground/60"
                      />
                    </div>
                    <button
                      onClick={() => onDelete(slot.key)}
                      className="self-start inline-flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="h-3 w-3" /> Устгах
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
