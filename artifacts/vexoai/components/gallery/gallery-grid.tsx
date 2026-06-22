"use client"

import { useState } from "react"
import { Heart, MessageCircle, Play } from "lucide-react"
import type { GalleryPost } from "./gallery-client"

export function GalleryGrid({
  items,
  onOpen,
  onLikeToggle,
  isLoggedIn,
}: {
  items: GalleryPost[]
  onOpen: (p: GalleryPost) => void
  onLikeToggle: (id: string, liked: boolean) => void
  isLoggedIn: boolean
}) {
  const handleLike = async (e: React.MouseEvent, p: GalleryPost) => {
    e.stopPropagation()
    if (!isLoggedIn) {
      window.location.href = "/login"
      return
    }
    const wasLiked = p.liked_by_me
    onLikeToggle(p.id, !wasLiked)
    const res = await fetch(`/api/gallery/${p.id}/like`, { method: "POST" })
    if (!res.ok) onLikeToggle(p.id, wasLiked) // revert
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
      {items.map((p) => (
        <button
          key={p.id}
          onClick={() => onOpen(p)}
          className="group relative aspect-[3/4] overflow-hidden rounded-xl border border-border bg-secondary/30 text-left"
        >
          {p.media_type === "video" ? (
            <InlineVideo src={p.media_url} poster={p.thumbnail_url ?? undefined} />
          ) : (
            <img
              src={p.media_url || "/placeholder.svg"}
              alt={p.title || "gallery item"}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          )}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-3">
            {p.title && <p className="line-clamp-1 text-sm font-medium text-white">{p.title}</p>}
            <p className="text-[11px] text-white/70 truncate">
              {p.author?.username
                ? `@${p.author.username}`
                : p.author?.display_name || "anonymous"}
            </p>

            <div className="mt-2 flex items-center gap-3 text-xs text-white">
              <button
                onClick={(e) => handleLike(e, p)}
                className="pointer-events-auto inline-flex items-center gap-1 transition-transform hover:scale-110"
                aria-label="like"
              >
                <Heart
                  className={`h-3.5 w-3.5 ${p.liked_by_me ? "fill-red-500 text-red-500" : "text-white"}`}
                />
                <span>{p.likes_count}</span>
              </button>
              <span className="inline-flex items-center gap-1">
                <MessageCircle className="h-3.5 w-3.5" />
                {p.comments_count}
              </span>
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}

// Shows only a lightweight preview by default (poster image, or the video's
// first frame when no poster exists), so the grid stays fast and never shows a
// blank black box. The full <video> only mounts after the user taps play.
function InlineVideo({ src, poster }: { src: string; poster?: string }) {
  const [playing, setPlaying] = useState(false)

  if (!playing) {
    return (
      <>
        {poster ? (
          <img
            src={poster || "/placeholder.svg"}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          // No poster: render the first frame of the video as a still preview.
          // muted + preload metadata + #t=0.1 makes the browser paint frame 0
          // without downloading/playing the whole clip.
          <video
            src={`${src}#t=0.1`}
            muted
            playsInline
            preload="metadata"
            tabIndex={-1}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 pointer-events-none"
          />
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/10">
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation()
              setPlaying(true)
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation()
                setPlaying(true)
              }
            }}
            className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full bg-background/70 backdrop-blur-md transition-transform hover:scale-110"
            aria-label="Play video"
          >
            <Play className="h-5 w-5 fill-foreground text-foreground" />
          </span>
        </div>
      </>
    )
  }

  return (
    <video
      src={src}
      poster={poster}
      autoPlay
      controls
      loop
      playsInline
      className="h-full w-full object-cover"
      onClick={(e) => e.stopPropagation()}
    />
  )
}
