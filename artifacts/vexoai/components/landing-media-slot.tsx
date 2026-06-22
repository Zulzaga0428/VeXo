"use client"

import { useEffect, useState } from "react"
import { Play } from "lucide-react"

type Item = {
  slot: string
  media_url: string
  media_type: "image" | "video"
  caption?: string | null
}

export function LandingMediaSlot({
  slot,
  fallback,
  className,
}: {
  slot: string
  fallback?: React.ReactNode
  className?: string
}) {
  const [item, setItem] = useState<Item | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setFailed(false)
    fetch("/api/landing-media")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled || !j?.map) return
        if (j.map[slot]) setItem(j.map[slot])
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoaded(true))
    return () => {
      cancelled = true
    }
  }, [slot])

  if (!loaded || !item || failed) {
    return <div className={className}>{fallback}</div>
  }

  // Cloudflare Stream / YouTube / Vimeo links need an embedded iframe player;
  // plain <video> can't play DASH/HLS manifests (.mpd/.m3u8) directly.
  const embedUrl = getEmbedUrl(item.media_url)

  return (
    <div className={className}>
      {embedUrl ? (
        <iframe
          src={embedUrl}
          title={item.caption || slot}
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
          allowFullScreen
          className="h-full w-full border-0"
        />
      ) : item.media_type === "video" ? (
        <video
          src={item.media_url}
          autoPlay
          loop
          muted
          playsInline
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.media_url || "/placeholder.svg"}
          alt={item.caption || slot}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  )
}

// Convert a streaming/share URL into an embeddable player URL.
// Returns null for plain media (mp4/img) that <video>/<img> can show directly.
function getEmbedUrl(url: string): string | null {
  if (!url) return null
  try {
    // Cloudflare Stream: .../<UID>/manifest/video.mpd  OR  watch/<UID>
    const cf = url.match(/cloudflarestream\.com\/([a-f0-9]+)|videodelivery\.net\/([a-f0-9]+)/i)
    if (cf) {
      const uid = cf[1] || cf[2]
      const sub = url.match(/customer-[a-z0-9]+/i)?.[0]
      const base = sub
        ? `https://${sub}.cloudflarestream.com`
        : "https://iframe.cloudflarestream.com"
      return `${base}/${uid}/iframe?autoplay=true&muted=true&loop=true&controls=false`
    }
    // YouTube
    const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]+)/)
    if (yt) {
      const id = yt[1]
      return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&controls=0`
    }
    // Vimeo
    const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)
    if (vm) {
      return `https://player.vimeo.com/video/${vm[1]}?autoplay=1&muted=1&loop=1&background=1`
    }
  } catch {
    return null
  }
  return null
}
