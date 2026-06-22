"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Share2, X, CheckCircle2 } from "lucide-react"

type Props = {
  defaultTitle?: string
  locale: "mn" | "en"
  onClose: () => void
  onShared?: () => void
} & ({ videoId: string; imageUrl?: never } | { videoId?: never; imageUrl: string })

export function ShareToGalleryDialog({
  videoId,
  imageUrl,
  defaultTitle = "",
  locale,
  onClose,
  onShared,
}: Props) {
  const [title, setTitle] = useState(defaultTitle.slice(0, 80))
  const [description, setDescription] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const handleShare = async () => {
    setError("")
    setSubmitting(true)
    try {
      const endpoint = imageUrl ? "/api/gallery/share-image" : "/api/gallery/share"
      const payload = imageUrl
        ? { imageUrl, title, description }
        : { videoId, title, description }
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Failed")
      setSuccess(true)
      onShared?.()
      setTimeout(onClose, 1400)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <Share2 className="h-4 w-4" />
            </div>
            <h3 className="text-base font-semibold">
              {locale === "mn" ? "Галерейд хуваалцах" : "Share to Gallery"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {success ? (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent/20 text-accent">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium">
              {locale === "mn" ? "Амжилттай хуваалцлаа!" : "Shared successfully!"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                {locale === "mn" ? "Гарчиг" : "Title"}
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={80}
                placeholder={locale === "mn" ? "Бүтээлийн нэр" : "Title"}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                {locale === "mn" ? "Тайлбар (заавал биш)" : "Description (optional)"}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder={
                  locale === "mn" ? "Бүтээлийнхээ тухай..." : "Tell us about it..."
                }
                className="mt-1 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
            {error && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            )}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={onClose} className="flex-1">
                {locale === "mn" ? "Болих" : "Cancel"}
              </Button>
              <Button
                onClick={handleShare}
                disabled={submitting || !title.trim()}
                className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Share2 className="mr-1.5 h-3.5 w-3.5" />
                    {locale === "mn" ? "Хуваалцах" : "Share"}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
