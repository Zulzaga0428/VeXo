"use client"

import { useState, useRef, useEffect } from "react"
import { Play } from "lucide-react"
import type { Locale } from "@/lib/i18n"

type ShowcaseItem = {
  id: string
  videoUrl?: string
  posterUrl: string
  titleMn: string
  titleEn: string
}

const fallbackItems: ShowcaseItem[] = [
  { id: "coffee", posterUrl: "/showcase/showcase-1.jpg", titleMn: "Кофе шоп реклам", titleEn: "Coffee Shop" },
  { id: "beauty", posterUrl: "/showcase/showcase-2.jpg", titleMn: "Гоо сайхан брэнд", titleEn: "Beauty Brand" },
  { id: "restaurant", posterUrl: "/showcase/showcase-3.jpg", titleMn: "Ресторан бүтээгдэхүүн", titleEn: "Restaurant" },
  { id: "fashion", posterUrl: "/showcase/showcase-4.jpg", titleMn: "Хувцасны брэнд", titleEn: "Fashion Brand" },
  { id: "tech", posterUrl: "/showcase/showcase-5.jpg", titleMn: "Tech бүтээгдэхүүн", titleEn: "Tech Product" },
]

export function AccordionShowcase({ locale }: { locale: Locale }) {
  const [items, setItems] = useState<ShowcaseItem[]>([])
  const [loaded, setLoaded] = useState(false)
  const [activeIndex, setActiveIndex] = useState<number>(2)
  const [failedVideos, setFailedVideos] = useState<Record<string, boolean>>({})
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([])
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch("/api/admin/showcase", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled) return
        if (json?.items?.length) {
          const mapped: ShowcaseItem[] = json.items.map((it: any) => ({
            id: it.id,
            videoUrl: it.media_type === "video" ? it.media_url : undefined,
            posterUrl: it.media_type === "video" ? (it.poster_url ?? it.media_url) : it.media_url,
            titleMn: it.title_mn || "",
            titleEn: it.title_en || "",
          }))
          setItems(mapped)
          setActiveIndex(Math.min(2, mapped.length - 1))
        } else {
          // No admin items configured — show built-in samples.
          setItems(fallbackItems)
          setActiveIndex(2)
        }
        setLoaded(true)
      })
      .catch(() => {
        if (cancelled) return
        setItems(fallbackItems)
        setActiveIndex(2)
        setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const activate = (i: number) => {
    if (i < 0 || i >= items.length) return
    setActiveIndex(i)
    // pause others
    videoRefs.current.forEach((v, idx) => {
      if (!v) return
      if (idx === i) {
        v.currentTime = 0
        v.play().catch(() => {})
      } else {
        v.pause()
      }
    })
  }

  const handleEnter = (i: number) => activate(i)

  const handleLeave = (i: number) => {
    const v = videoRefs.current[i]
    if (v) v.pause()
  }

  // Mobile swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    // horizontal swipe only (ignore vertical scroll)
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) {
        activate(Math.min(activeIndex + 1, items.length - 1))
      } else {
        activate(Math.max(activeIndex - 1, 0))
      }
    }
    touchStartX.current = null
    touchStartY.current = null
  }

  return (
    <div className="relative z-10 mx-auto mt-4 sm:mt-20 w-full max-w-5xl px-4 sm:px-6">
      {!loaded ? (
        // Skeleton while loading so old/missing images never flash in.
        <div className="flex h-[240px] sm:h-[416px] gap-2 sm:gap-3">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className={`overflow-hidden rounded-2xl border border-border/60 bg-card/40 animate-pulse ${
                n === 2 ? "flex-[5]" : "flex-[1]"
              }`}
            />
          ))}
        </div>
      ) : (
      <div
        className="flex h-[240px] sm:h-[416px] gap-2 sm:gap-3 touch-pan-y"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {items.map((item, i) => {
          const isActive = activeIndex === i
          return (
            <button
              key={item.id}
              type="button"
              onMouseEnter={() => handleEnter(i)}
              onMouseLeave={() => handleLeave(i)}
              onFocus={() => handleEnter(i)}
              onBlur={() => handleLeave(i)}
              onClick={() => activate(i)}
              className={`group relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm transition-all duration-700 ease-out ${
                isActive ? "flex-[5]" : "flex-[1]"
              }`}
              style={{ minWidth: 0 }}
              aria-label={locale === "mn" ? item.titleMn : item.titleEn}
            >
              {/* Image / Video background */}
              <div className="absolute inset-0">
                {item.videoUrl && !failedVideos[item.id] ? (
                  <video
                    ref={(el) => {
                      videoRefs.current[i] = el
                    }}
                    src={item.videoUrl}
                    poster={item.posterUrl}
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    className="h-full w-full object-cover"
                    onError={() => setFailedVideos((prev) => ({ ...prev, [item.id]: true }))}
                  />
                ) : (
                  <img
                    src={item.posterUrl || "/placeholder.svg"}
                    alt={locale === "mn" ? item.titleMn : item.titleEn}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      ;(e.currentTarget as HTMLImageElement).src = "/placeholder.svg"
                    }}
                  />
                )}
                {/* Gradient overlay (lighter than before) */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                {/* Subtle accent glow on active */}
                <div
                  className={`absolute inset-0 transition-opacity duration-700 ${
                    isActive ? "opacity-100" : "opacity-0"
                  }`}
                  style={{
                    background:
                      "radial-gradient(ellipse at 50% 100%, color-mix(in oklch, var(--accent) 18%, transparent), transparent 60%)",
                  }}
                />
              </div>

              {/* Active state content — minimal, just the AI sample tag */}
              <div
                className={`absolute inset-0 flex flex-col justify-end p-4 sm:p-6 transition-all duration-700 ${
                  isActive ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
                }`}
              >
                <div className="inline-flex items-center gap-2 text-xs sm:text-sm text-foreground/85 drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]">
                  <Play className="h-3.5 w-3.5 fill-accent text-accent" />
                  <span>{locale === "mn" ? "AI үүсгэсэн жишээ" : "AI generated sample"}</span>
                </div>
              </div>
            </button>
          )
        })}
      </div>
      )}

      {/* Mobile dots indicator */}
      {loaded && (
      <div className="mt-3 flex items-center justify-center gap-1.5 sm:hidden">
        {items.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => activate(i)}
            aria-label={`Slide ${i + 1}`}
            className={`h-1.5 rounded-full transition-all ${
              activeIndex === i ? "w-6 bg-accent" : "w-1.5 bg-border"
            }`}
          />
        ))}
      </div>
      )}
    </div>
  )
}
