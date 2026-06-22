"use client"

import { useEffect, useState, useRef } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Upload,
  Trash2,
  GripVertical,
  Loader2,
  Image as ImageIcon,
  Film,
  Plus,
  Save,
  LinkIcon,
} from "lucide-react"

type ShowcaseItem = {
  id: string
  title_mn: string
  title_en: string
  media_url: string
  media_type: "image" | "video"
  poster_url: string | null
  sort_order: number
  is_active: boolean
}

export function AdminShowcaseManager() {
  const [items, setItems] = useState<ShowcaseItem[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [linkUrl, setLinkUrl] = useState("")
  const [addingLink, setAddingLink] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    setLoading(true)
    const res = await fetch("/api/admin/showcase?all=true")
    const json = await res.json()
    setItems(json.items ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const handleFileUpload = async (file: File) => {
    setUploading(true)
    setProgress(0)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const upRes = await fetch("/api/admin/showcase/upload", { method: "POST", body: fd })
      const upJson = await upRes.json()
      if (!upRes.ok || !upJson?.url) throw new Error(upJson?.error || "Upload failed")
      const media_type = upJson.media_type || ((file.type || "").startsWith("video/") ? "video" : "image")

      // Create item
      const createRes = await fetch("/api/admin/showcase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media_url: upJson.url,
          media_type,
          sort_order: items.length,
          is_active: true,
        }),
      })
      if (!createRes.ok) throw new Error("Create failed")
      const { item: created } = await createRes.json()
      // Optimistic — append directly without reloading entire list
      if (created) {
        setItems((prev) => [...prev, created])
      } else {
        await load()
      }
    } catch (e) {
      alert("Алдаа гарлаа: " + (e as Error).message)
    } finally {
      setUploading(false)
      setProgress(0)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleAddLink = async () => {
    const url = linkUrl.trim()
    if (!url) return
    if (!/^https?:\/\//i.test(url)) {
      alert("Зөв линк оруулна уу (http... эсвэл https...-ээр эхэлсэн)")
      return
    }
    setAddingLink(true)
    try {
      // Guess media type from the URL extension.
      const clean = url.split("?")[0].toLowerCase()
      const isVideo = /\.(mp4|webm|mov|m4v|ogg)$/.test(clean)
      const media_type = isVideo ? "video" : "image"

      const createRes = await fetch("/api/admin/showcase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media_url: url,
          media_type,
          sort_order: items.length,
          is_active: true,
        }),
      })
      if (!createRes.ok) throw new Error("Create failed")
      const { item: created } = await createRes.json()
      if (created) {
        setItems((prev) => [...prev, created])
      } else {
        await load()
      }
      setLinkUrl("")
    } catch (e) {
      alert("Алдаа гарлаа: " + (e as Error).message)
    } finally {
      setAddingLink(false)
    }
  }

  const updateItem = async (id: string, patch: Partial<ShowcaseItem>) => {
    setSavingId(id)
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)))
    try {
      await fetch(`/api/admin/showcase/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
    } finally {
      setSavingId(null)
    }
  }

  const deleteItem = async (id: string) => {
    if (!confirm("Энэ зүйлийг устгах уу?")) return
    await fetch(`/api/admin/showcase/${id}`, { method: "DELETE" })
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  const move = async (id: string, dir: -1 | 1) => {
    const idx = items.findIndex((i) => i.id === id)
    const target = idx + dir
    if (idx < 0 || target < 0 || target >= items.length) return
    const next = [...items]
    ;[next[idx], next[target]] = [next[target], next[idx]]
    setItems(next)
    // Persist new sort_order for all
    await Promise.all(
      next.map((it, i) =>
        fetch(`/api/admin/showcase/${it.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sort_order: i }),
        }),
      ),
    )
  }

  return (
    <div className="space-y-6">
      {/* Upload */}
      <div className="rounded-xl border border-dashed border-border bg-card/50 p-6">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFileUpload(file)
          }}
        />
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
            <Upload className="h-5 w-5 text-accent" />
          </div>
          <div>
            <p className="font-medium">Шинэ зураг / видео нэмэх</p>
            <p className="text-xs text-muted-foreground">JPG, PNG, MP4 (макс ~50MB)</p>
          </div>
          <Button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {progress > 0 && progress < 100
                  ? `Илгээж байна... ${progress}%`
                  : progress >= 100
                    ? "Боловсруулж байна..."
                    : "Бэлдэж байна..."}
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Файл сонгох
              </>
            )}
          </Button>
          {uploading && (
            <div className="w-full max-w-xs">
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-accent transition-all duration-200 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Or add by link */}
        <div className="mt-5 border-t border-border pt-5">
          <div className="flex items-center gap-2 text-sm font-medium">
            <LinkIcon className="h-4 w-4 text-accent" />
            Эсвэл линкээр нэмэх
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Зураг эсвэл видеоны шууд линкийг (https://...) хуулж тавина уу. Хамгийн амар арга.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddLink()
              }}
              placeholder="https://example.com/video.mp4"
              disabled={addingLink}
              className="flex-1"
            />
            <Button
              type="button"
              onClick={handleAddLink}
              disabled={addingLink || !linkUrl.trim()}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {addingLink ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Нэмж байна...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Нэмэх
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Одоогоор зүйл байхгүй байна. Эхний зургаа нэмнэ үү.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((item, idx) => (
            <div
              key={item.id}
              className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:flex-row"
            >
              {/* Drag handle + order */}
              <div className="flex flex-row items-center gap-1 sm:flex-col sm:gap-2">
                <button
                  type="button"
                  onClick={() => move(item.id, -1)}
                  disabled={idx === 0}
                  className="rounded p-1 text-muted-foreground hover:bg-secondary disabled:opacity-30"
                >
                  ▲
                </button>
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                <button
                  type="button"
                  onClick={() => move(item.id, 1)}
                  disabled={idx === items.length - 1}
                  className="rounded p-1 text-muted-foreground hover:bg-secondary disabled:opacity-30"
                >
                  ▼
                </button>
              </div>

              {/* Preview */}
              <div className="relative h-32 w-full overflow-hidden rounded-lg bg-secondary sm:w-32 sm:flex-shrink-0">
                {item.media_type === "video" ? (
                  <video
                    src={item.media_url}
                    poster={item.poster_url ?? undefined}
                    className="h-full w-full object-cover"
                    muted
                    playsInline
                  />
                ) : (
                  <Image
                    src={item.media_url}
                    alt={item.title_mn || "Showcase"}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                )}
                <div className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded bg-background/80 px-1.5 py-0.5 text-[10px] backdrop-blur">
                  {item.media_type === "video" ? (
                    <Film className="h-3 w-3" />
                  ) : (
                    <ImageIcon className="h-3 w-3" />
                  )}
                  {item.media_type}
                </div>
              </div>

              {/* Form */}
              <div className="flex flex-1 flex-col gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Гарчиг (Монгол)</Label>
                    <Input
                      value={item.title_mn}
                      onChange={(e) =>
                        setItems((prev) =>
                          prev.map((i) => (i.id === item.id ? { ...i, title_mn: e.target.value } : i)),
                        )
                      }
                      onBlur={() => updateItem(item.id, { title_mn: item.title_mn })}
                      placeholder="Жишээ: Кофе шоп реклам"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Title (English)</Label>
                    <Input
                      value={item.title_en}
                      onChange={(e) =>
                        setItems((prev) =>
                          prev.map((i) => (i.id === item.id ? { ...i, title_en: e.target.value } : i)),
                        )
                      }
                      onBlur={() => updateItem(item.id, { title_en: item.title_en })}
                      placeholder="Coffee Shop"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={item.is_active}
                      onCheckedChange={(v) => updateItem(item.id, { is_active: v })}
                    />
                    <span className="text-xs text-muted-foreground">
                      {item.is_active ? "Идэвхтэй" : "Нуугдсан"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {savingId === item.id && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Save className="h-3 w-3" />
                        Хадгалж байна...
                      </span>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteItem(item.id)}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
