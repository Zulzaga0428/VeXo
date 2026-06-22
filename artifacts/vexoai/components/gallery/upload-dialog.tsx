"use client"

import { useRef, useState } from "react"
import { Upload, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { GalleryPost } from "./gallery-client"

export function UploadDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (p: GalleryPost) => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  if (!open) return null

  const reset = () => {
    setFile(null)
    setPreviewUrl(null)
    setTitle("")
    setDescription("")
    setError("")
    setUploading(false)
  }

  const handleFile = (f: File) => {
    if (f.size > 50 * 1024 * 1024) {
      setError("Файлын хэмжээ 50MB-аас бага байх ёстой")
      return
    }
    setFile(f)
    setPreviewUrl(URL.createObjectURL(f))
    setError("")
  }

  const handleSubmit = async () => {
    if (!file) return
    setUploading(true)
    setError("")

    try {
      const fd = new FormData()
      fd.append("file", file)
      const upRes = await fetch("/api/gallery/upload", { method: "POST", body: fd })
      if (!upRes.ok) {
        const j = await upRes.json().catch(() => ({}))
        throw new Error(j.error || "Upload failed")
      }
      const up = await upRes.json()

      const postRes = await fetch("/api/gallery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media_url: up.url,
          media_type: up.media_type,
          title,
          description,
        }),
      })
      if (!postRes.ok) {
        const j = await postRes.json().catch(() => ({}))
        throw new Error(j.error || "Save failed")
      }
      const { item } = await postRes.json()

      onCreated({
        ...item,
        author: { display_name: null, username: null, avatar_url: null },
        liked_by_me: false,
      })
      reset()
    } catch (e: any) {
      setError(e.message || "Алдаа гарлаа")
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-background p-5 sm:p-6 shadow-2xl">
        <button
          onClick={() => {
            reset()
            onClose()
          }}
          className="absolute right-3 top-3 rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <h2 className="mb-1 text-xl font-semibold">Шинэ бүтээл</h2>
        <p className="mb-5 text-sm text-muted-foreground">Зураг эсвэл видео байршуулна (max 50MB)</p>

        {!previewUrl ? (
          <button
            onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-secondary/30 px-4 py-12 transition-colors hover:border-accent/60 hover:bg-accent/5"
          >
            <Upload className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm font-medium">Файл сонгох</span>
            <span className="text-xs text-muted-foreground">PNG, JPG, MP4, WebM</span>
          </button>
        ) : (
          <div className="space-y-3">
            <div className="relative aspect-video overflow-hidden rounded-xl bg-secondary/40">
              {file?.type.startsWith("video/") ? (
                <video src={previewUrl} controls className="h-full w-full object-contain" />
              ) : (
                <img src={previewUrl || "/placeholder.svg"} alt="preview" className="h-full w-full object-contain" />
              )}
            </div>
            <button
              onClick={() => {
                setFile(null)
                setPreviewUrl(null)
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Файл солих
            </button>
            <input
              type="text"
              placeholder="Гарчиг (заавал биш)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              className="w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <textarea
              placeholder="Тайлбар бичих..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              rows={3}
              className="w-full resize-none rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleFile(f)
          }}
        />

        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

        <div className="mt-5 flex gap-2 justify-end">
          <Button variant="outline" onClick={() => { reset(); onClose() }} disabled={uploading}>
            Цуцлах
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!file || uploading}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {uploading ? "Илгээж байна..." : "Нийтлэх"}
          </Button>
        </div>
      </div>
    </div>
  )
}
