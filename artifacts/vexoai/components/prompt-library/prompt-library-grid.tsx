"use client"

import { useState, useEffect, useCallback } from "react"
import { Play, Copy, Check, Search } from "lucide-react"

interface PromptItem {
  id: string
  title: string
  prompt_text: string
  category: string
  media_url: string
  media_type: string
  poster_url?: string | null
}

// Lazy video preview: shows the poster (or the video's first frame) until the
// user taps play, so a page full of clips stays fast — same trick as the gallery.
function PreviewMedia({ item }: { item: PromptItem }) {
  const [playing, setPlaying] = useState(false)

  if (item.media_type === "video") {
    if (!playing) {
      return (
        <>
          {item.poster_url ? (
            <img
              src={item.poster_url || "/placeholder.svg"}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <video
              src={`${item.media_url}#t=0.1`}
              muted
              playsInline
              preload="metadata"
              tabIndex={-1}
              className="pointer-events-none h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/10">
            <button
              type="button"
              onClick={() => setPlaying(true)}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-background/70 backdrop-blur-md transition-transform hover:scale-110"
              aria-label="Play video"
            >
              <Play className="h-5 w-5 fill-foreground text-foreground" />
            </button>
          </div>
        </>
      )
    }
    return (
      <video
        src={item.media_url}
        controls
        autoPlay
        playsInline
        className="h-full w-full object-cover"
      />
    )
  }

  return (
    <img
      src={item.media_url || "/placeholder.svg"}
      alt={item.title || ""}
      loading="lazy"
      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
    />
  )
}

export function PromptLibraryGrid() {
  const [items, setItems] = useState<PromptItem[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [activeCat, setActiveCat] = useState<string>("")
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    fetch("/api/prompt-library")
      .then((r) => r.json())
      .then((d) => {
        if (active && Array.isArray(d?.prompts)) setItems(d.prompts)
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const copy = useCallback(async (item: PromptItem) => {
    try {
      await navigator.clipboard.writeText(item.prompt_text)
      setCopiedId(item.id)
      setTimeout(() => setCopiedId((c) => (c === item.id ? null : c)), 1800)
      // Fire-and-forget copy counter (no await, never blocks the user).
      fetch("/api/prompt-library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      }).catch(() => {})
    } catch {
      // Clipboard may be blocked; ignore silently.
    }
  }, [])

  const categories = Array.from(new Set(items.map((i) => i.category).filter(Boolean)))

  const filtered = items.filter((i) => {
    const matchesCat = !activeCat || i.category === activeCat
    const q = query.trim().toLowerCase()
    const matchesQuery =
      !q ||
      i.title.toLowerCase().includes(q) ||
      i.prompt_text.toLowerCase().includes(q) ||
      i.category.toLowerCase().includes(q)
    return matchesCat && matchesQuery
  })

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="aspect-[4/3] animate-pulse rounded-xl bg-secondary/40" />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border/60 bg-card/40 py-20 text-center">
        <p className="text-muted-foreground">Одоогоор промпт байхгүй байна.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Search + category filters */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Промпт хайх..."
            className="w-full rounded-lg border border-border bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveCat("")}
              className={`rounded-full px-3 py-1 text-sm transition-colors ${
                !activeCat ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {"Бүгд"}
            </button>
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setActiveCat(c)}
                className={`rounded-full px-3 py-1 text-sm transition-colors ${
                  activeCat === c ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((item) => (
          <div
            key={item.id}
            className="group flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card"
          >
            <div className="relative aspect-[4/3] overflow-hidden bg-secondary/40">
              <PreviewMedia item={item} />
            </div>
            <div className="flex flex-1 flex-col gap-2 p-3">
              {item.title && <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>}
              <p className="line-clamp-3 flex-1 text-sm text-muted-foreground">{item.prompt_text}</p>
              <button
                type="button"
                onClick={() => copy(item)}
                className="mt-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                {copiedId === item.id ? (
                  <>
                    <Check className="h-4 w-4" /> {"Хууллаа"}
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" /> {"Промпт хуулах"}
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
