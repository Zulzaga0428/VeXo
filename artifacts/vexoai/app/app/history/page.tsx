"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { AppSidebar } from "@/components/app-sidebar"
import { Film, ArrowLeft, Play, Download, Clock, Trash2, Loader2, Share2 } from "lucide-react"
import { ShareToGalleryDialog } from "@/components/share-to-gallery-dialog"

interface Video {
  id: string
  prompt: string
  voice: string
  video_url: string
  status: string
  series_count: number
  scene_index: number
  created_at: string
  expires_at: string
}

export default function HistoryPage() {
  const [locale] = useState<"en" | "mn">("mn")
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [shareTarget, setShareTarget] = useState<Video | null>(null)
  const router = useRouter()

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch("/api/history")
        const data = await res.json()
        if (data.videos) {
          setVideos(data.videos)
        }
      } catch (error) {
        console.error("Failed to fetch history:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchHistory()
  }, [])

  const handleDelete = async (id: string) => {
    const supabase = createClient()
    const { error } = await supabase.from("videos").delete().eq("id", id)
    if (error) {
      alert(locale === "mn" ? "Устгах үед алдаа гарлаа" : "Delete failed")
      return
    }
    setVideos(videos.filter((v) => v.id !== id))
  }

  const getTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (locale === "mn") {
      if (minutes < 60) return `${minutes} минутын өмнө`
      if (hours < 24) return `${hours} цагийн өмнө`
      return `${days} өдрийн өмнө`
    } else {
      if (minutes < 60) return `${minutes}m ago`
      if (hours < 24) return `${hours}h ago`
      return `${days}d ago`
    }
  }

  const getExpiresIn = (dateStr: string) => {
    const diff = new Date(dateStr).getTime() - Date.now()
    const days = Math.floor(diff / 86400000)
    const hours = Math.floor((diff % 86400000) / 3600000)

    if (locale === "mn") {
      if (days > 0) return `${days} хоног ${hours} цаг үлдсэн`
      return `${hours} цаг үлдсэн`
    } else {
      if (days > 0) return `${days}d ${hours}h left`
      return `${hours}h left`
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75"></span>
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500"></span>
              </span>
              <span className="text-lg font-bold tracking-tight">VexoAi</span>
            </Link>
            <span className="text-xs text-muted-foreground">|</span>
            <span className="font-semibold text-sm">
              {locale === "mn" ? "Миний бичлэгүүд" : "My Videos"}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            {videos.length} {locale === "mn" ? "бичлэг" : "videos"}
          </div>
        </div>
      </nav>

      {/* Sidebar */}
      <AppSidebar locale={locale} />

      {/* Content - with sidebar offset */}
      <div className="ml-0 md:ml-56 transition-all duration-300">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 pt-20 pb-12">
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : videos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <Film className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">
              {locale === "mn" ? "Бичлэг байхгүй байна" : "No videos yet"}
            </p>
            <p className="text-sm text-muted-foreground/70 mt-1 mb-6">
              {locale === "mn"
                ? "Эхний бичлэгээ үүсгээрэй"
                : "Create your first video"}
            </p>
            <Link href="/app/studio">
              <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
                {locale === "mn" ? "Бичлэг үүсгэх" : "Create Video"}
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {videos.map((video) => (
              <div
                key={video.id}
                className="group rounded-xl border border-border bg-card overflow-hidden transition-all hover:border-accent/50"
              >
                {/* Video Preview */}
                <div className="relative aspect-video bg-secondary/50">
                  {playingId === video.id ? (
                    <video
                      src={`/api/video-file?pathname=${encodeURIComponent(video.video_url)}`}
                      className="h-full w-full object-cover"
                      autoPlay
                      controls
                      onEnded={() => setPlayingId(null)}
                    />
                  ) : (
                    <button
                      onClick={() => setPlayingId(video.id)}
                      className="flex h-full w-full items-center justify-center"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/20 transition-transform group-hover:scale-110">
                        <Play className="h-5 w-5 text-accent" />
                      </div>
                    </button>
                  )}
                  {/* Scene badge */}
                  {video.series_count > 1 && (
                    <div className="absolute top-2 left-2 rounded-md bg-background/80 px-2 py-0.5 text-[10px] font-medium backdrop-blur-sm">
                      Scene {video.scene_index + 1}/{video.series_count}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-3">
                  <p className="text-sm font-medium line-clamp-2 mb-2">
                    {video.prompt.length > 80
                      ? video.prompt.substring(0, 80) + "..."
                      : video.prompt}
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{getTimeAgo(video.created_at)}</span>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{getExpiresIn(video.expires_at)}</span>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <a
                      href={`/api/video-file?pathname=${encodeURIComponent(video.video_url)}`}
                      download
                      className="flex-1"
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-xs h-8"
                      >
                        <Download className="h-3 w-3 mr-1" />
                        {locale === "mn" ? "Татах" : "Download"}
                      </Button>
                    </a>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-8 border-accent/40 text-accent hover:bg-accent/10 hover:text-accent"
                      onClick={() => setShareTarget(video)}
                      title={locale === "mn" ? "Галерейд хуваалцах" : "Share to Gallery"}
                    >
                      <Share2 className="h-3 w-3 mr-1" />
                      {locale === "mn" ? "Хуваалцах" : "Share"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 px-2"
                      onClick={() => handleDelete(video.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
      </div>

      {shareTarget && (
        <ShareToGalleryDialog
          videoId={shareTarget.id}
          defaultTitle={shareTarget.prompt}
          locale={locale}
          onClose={() => setShareTarget(null)}
        />
      )}
    </div>
  )
}
