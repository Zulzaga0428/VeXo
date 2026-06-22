"use client"

import { useEffect, useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GalleryGrid } from "./gallery-grid"
import { UploadDialog } from "./upload-dialog"
import { PostDialog } from "./post-dialog"
import { createClient } from "@/lib/supabase/client"

export type GalleryAuthor = {
  display_name: string | null
  username: string | null
  avatar_url: string | null
}

export type GalleryPost = {
  id: string
  user_id: string
  title: string
  description: string
  media_url: string
  media_type: "image" | "video"
  thumbnail_url: string | null
  likes_count: number
  comments_count: number
  created_at: string
  author: GalleryAuthor
  liked_by_me: boolean
}

export function GalleryClient() {
  const [items, setItems] = useState<GalleryPost[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [activePost, setActivePost] = useState<GalleryPost | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  const load = async () => {
    setLoading(true)
    const res = await fetch("/api/gallery")
    if (res.ok) {
      const j = await res.json()
      setItems(j.items)
      setCurrentUserId(j.currentUserId)
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => setIsLoggedIn(!!user))
  }, [])

  const handlePostCreated = (p: GalleryPost) => {
    setItems((prev) => [p, ...prev])
    setUploadOpen(false)
  }

  const handleLikeToggle = (postId: string, liked: boolean) => {
    setItems((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, liked_by_me: liked, likes_count: Math.max(0, p.likes_count + (liked ? 1 : -1)) }
          : p,
      ),
    )
    if (activePost?.id === postId) {
      setActivePost((prev) =>
        prev
          ? { ...prev, liked_by_me: liked, likes_count: Math.max(0, prev.likes_count + (liked ? 1 : -1)) }
          : prev,
      )
    }
  }

  const handleCommentAdded = (postId: string) => {
    setItems((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, comments_count: p.comments_count + 1 } : p)),
    )
    if (activePost?.id === postId) {
      setActivePost((prev) => (prev ? { ...prev, comments_count: prev.comments_count + 1 } : prev))
    }
  }

  const handleDelete = (postId: string) => {
    setItems((prev) => prev.filter((p) => p.id !== postId))
    setActivePost(null)
  }

  return (
    <div>
      <div className="mb-6 sm:mb-10 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-balance">Галерей</h1>
          <p className="mt-2 text-sm sm:text-base text-muted-foreground max-w-2xl">
            Хэрэглэгчдийн VexoAi-ээр бүтээсэн бүтээлүүд. Лайк дарж сэтгэгдэл бичээрэй.
          </p>
        </div>
        {isLoggedIn ? (
          <Button
            onClick={() => setUploadOpen(true)}
            className="bg-accent text-accent-foreground hover:bg-accent/90 h-10"
          >
            <Plus className="mr-2 h-4 w-4" />
            Шинэ бүтээл нэмэх
          </Button>
        ) : (
          <Button asChild variant="outline" className="h-10">
            <a href="/login">Нэмэхийн тулд нэвтрэх</a>
          </Button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] rounded-xl bg-secondary/40 animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-secondary/20 px-6 py-20 text-center">
          <p className="text-muted-foreground">Одоохондоо бүтээл байхгүй байна.</p>
          <p className="mt-1 text-sm text-muted-foreground/70">Эхний бүтээлээ нэмж бусдад үзүүл!</p>
        </div>
      ) : (
        <GalleryGrid
          items={items}
          onOpen={(p) => setActivePost(p)}
          onLikeToggle={handleLikeToggle}
          isLoggedIn={isLoggedIn}
        />
      )}

      <UploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} onCreated={handlePostCreated} />

      <PostDialog
        post={activePost}
        currentUserId={currentUserId}
        isLoggedIn={isLoggedIn}
        onClose={() => setActivePost(null)}
        onLikeToggle={handleLikeToggle}
        onCommentAdded={handleCommentAdded}
        onDelete={handleDelete}
      />
    </div>
  )
}
