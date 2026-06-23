"use client"

import { useRef, useState } from "react"
import { Loader2, Sparkles, Upload, User, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { generateImage, uploadImage } from "@/lib/create-api-client"
import type { AvatarRef, Orientation } from "@/lib/blueprint"

interface AvatarPickerProps {
  locale: "mn" | "en"
  avatar: AvatarRef
  orientation: Orientation
  required: boolean
  onChange: (a: AvatarRef) => void
}

export function AvatarPicker({ locale, avatar, orientation, required, onChange }: AvatarPickerProps) {
  const t = (mn: string, en: string) => (locale === "mn" ? mn : en)
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<"upload" | "ai" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [prompt, setPrompt] = useState("")
  const [showAi, setShowAi] = useState(false)

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      e.target.value = ""
      setBusy("upload")
      setError(null)
      const res = await uploadImage(file)
      setBusy(null)
      if (res.ok) onChange({ type: "upload", imageUrl: res.data.url, label: file.name })
      else setError(res.error)
    }
  }

  const onGenerate = async () => {
    if (!prompt.trim() || busy) return
    setBusy("ai")
    setError(null)
    const res = await generateImage({ prompt: prompt.trim(), aspectRatio: orientation, mode: "photo" })
    setBusy(null)
    if (res.ok && res.data.images[0]) {
      onChange({ type: "generated", imageUrl: res.data.images[0].url, label: prompt.trim() })
      setShowAi(false)
      setPrompt("")
    } else {
      setError(res.ok ? t("Зураг үүсээгүй", "No image returned") : res.error)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          {t("Аватар", "Avatar")}
          {required && <span className="ml-1 text-destructive">*</span>}
        </span>
        {required && !avatar.imageUrl && (
          <span className="text-[11px] text-destructive">
            {t("Танилцуулагч дүрд шаардлагатай", "Required for presenter scenes")}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted">
          {avatar.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar.imageUrl} alt="avatar" className="h-full w-full object-cover" />
          ) : (
            <User className="h-6 w-6 text-muted-foreground" />
          )}
        </div>

        <div className="flex flex-1 flex-wrap gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy !== null}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium transition hover:border-accent/50 disabled:opacity-50"
          >
            {busy === "upload" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {t("Зураг оруулах", "Upload")}
          </button>
          <button
            onClick={() => setShowAi((s) => !s)}
            disabled={busy !== null}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50",
              showAi ? "border-accent bg-accent/5 text-accent" : "border-border bg-background hover:border-accent/50",
            )}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {t("AI-аар үүсгэх", "Generate with AI")}
          </button>
          {avatar.imageUrl && (
            <button
              onClick={() => onChange({ type: "none" })}
              disabled={busy !== null}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-muted-foreground transition hover:text-destructive disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
      </div>

      {showAi && (
        <div className="flex items-end gap-2 rounded-lg border border-border bg-background p-2">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={2}
            placeholder={t("Жишээ: 30 настай эмэгтэй, цэвэрхэн дэвсгэр…", "e.g. a 30 y/o woman, clean studio backdrop…")}
            className="flex-1 resize-none bg-transparent text-xs outline-none placeholder:text-muted-foreground"
          />
          <button
            onClick={onGenerate}
            disabled={!prompt.trim() || busy !== null}
            className="inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50"
          >
            {busy === "ai" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {t("Үүсгэх", "Make")}
          </button>
        </div>
      )}
      {showAi && (
        <p className="text-[11px] text-muted-foreground">{t("AI зураг үүсгэхэд 2 кредит зарцуулна.", "AI image costs 2 credits.")}</p>
      )}
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  )
}
