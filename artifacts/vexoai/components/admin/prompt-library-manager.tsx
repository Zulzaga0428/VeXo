"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Plus, Trash2, Loader2, Upload, Eye, EyeOff, Copy } from "lucide-react"

interface PromptRow {
  id: string
  title: string
  prompt_text: string
  category: string
  media_url: string
  media_type: string
  poster_url?: string | null
  is_active: boolean
  copy_count: number
  sort_order: number
}

const EMPTY = {
  title: "",
  prompt_text: "",
  category: "",
  media_url: "",
  media_type: "image",
  sort_order: 0,
}

export function PromptLibraryManager() {
  const [rows, setRows] = useState<PromptRow[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ ...EMPTY })
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/prompt-library")
      const data = await res.json()
      if (Array.isArray(data?.prompts)) setRows(data.prompts)
    } catch {
      setError("Жагсаалт ачаалж чадсангүй.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/admin/prompt-library/upload", { method: "POST", body: fd })
      const json = await res.json()
      if (!res.ok || !json?.url) throw new Error(json?.error || "Upload failed")
      const isVideo = json.media_type === "video" || file.type.startsWith("video")
      setForm((f) => ({ ...f, media_url: json.url, media_type: isVideo ? "video" : "image" }))
    } catch {
      setError("Файл байршуулж чадсангүй.")
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  async function save() {
    if (!form.prompt_text.trim()) {
      setError("Промптын текст шаардлагатай.")
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/prompt-library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error()
      setForm({ ...EMPTY })
      await load()
    } catch {
      setError("Хадгалж чадсангүй.")
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(row: PromptRow) {
    await fetch("/api/admin/prompt-library", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id, is_active: !row.is_active }),
    })
    await load()
  }

  async function remove(id: string) {
    if (!confirm("Энэ промптыг устгах уу?")) return
    await fetch(`/api/admin/prompt-library?id=${id}`, { method: "DELETE" })
    await load()
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Add form */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
          <Plus className="h-5 w-5" /> Шинэ промпт нэмэх
        </h2>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Гарчиг (заавал биш)"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <input
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              placeholder="Ангилал (ж: Реклам, Бүтээгдэхүүн)"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <textarea
            value={form.prompt_text}
            onChange={(e) => setForm((f) => ({ ...f, prompt_text: e.target.value }))}
            placeholder="Промптын текст (хэрэглэгч энийг хуулж авна)"
            rows={4}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <div className="flex flex-wrap items-center gap-3">
            <input ref={fileRef} type="file" accept="image/*,video/*" onChange={handleFile} className="hidden" />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:opacity-60"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Зураг/Бичлэг оруулах
            </button>
            {form.media_url && (
              <div className="flex items-center gap-2">
                {form.media_type === "video" ? (
                  <video src={form.media_url} className="h-12 w-12 rounded object-cover" muted />
                ) : (
                  <img src={form.media_url || "/placeholder.svg"} alt="" className="h-12 w-12 rounded object-cover" />
                )}
                <span className="text-xs text-muted-foreground">Бэлэн</span>
              </div>
            )}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Нэмэх
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-foreground">Промптууд ({rows.length})</h2>
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Ачаалж байна...
          </div>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground">Одоогоор промпт алга.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {rows.map((row) => (
              <div
                key={row.id}
                className="flex items-start gap-4 rounded-xl border border-border bg-card p-4"
              >
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-secondary/40">
                  {row.media_url ? (
                    row.media_type === "video" ? (
                      <video src={`${row.media_url}#t=0.1`} className="h-full w-full object-cover" muted preload="metadata" />
                    ) : (
                      <img src={row.media_url || "/placeholder.svg"} alt="" className="h-full w-full object-cover" />
                    )
                  ) : null}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    {row.title && <span className="text-sm font-semibold text-foreground">{row.title}</span>}
                    {row.category && (
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                        {row.category}
                      </span>
                    )}
                    {!row.is_active && (
                      <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                        Нуусан
                      </span>
                    )}
                  </div>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{row.prompt_text}</p>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Copy className="h-3 w-3" /> {row.copy_count} удаа хуулсан
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => toggleActive(row)}
                    className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    aria-label={row.is_active ? "Нуух" : "Идэвхжүүлэх"}
                  >
                    {row.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(row.id)}
                    className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Устгах"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
