"use client"

import { useEffect, useState } from "react"
import { X, Heart, MessageCircle, Trash2, Send, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { GalleryPost } from "./gallery-client"

type CommentAuthor = {
  display_name: string | null
  username: string | null
  avatar_url: string | null
}

type Comment = {
  id: string
  user_id: string
  content: string
  created_at: string
  author: CommentAuthor
}

function authorLabel(a: CommentAuthor | null | undefined) {
  if (!a) return "anonymous"
  if (a.username) return `@${a.username}`
  if (a.display_name) return a.display_name
  return "anonymous"
}

function authorInitial(a: CommentAuthor | null | undefined) {
  const label = a?.display_name || a?.username || "A"
  return label[0]!.toUpperCase()
}

export function PostDialog({
  post,
  currentUserId,
  isLoggedIn,
  onClose,
  onLikeToggle,
  onCommentAdded,
  onDelete,
}: {
  post: GalleryPost | null
  currentUserId: string | null
  isLoggedIn: boolean
  onClose: () => void
  onLikeToggle: (id: string, liked: boolean) => void
  onCommentAdded: (id: string) => void
  onDelete: (id: string) => void
}) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [newComment, setNewComment] = useState("")
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    if (!post) return
    setLoadingComments(true)
    fetch(`/api/gallery/${post.id}/comments`)
      .then((r) => r.json())
      .then((j) => setComments(j.items ?? []))
      .finally(() => setLoadingComments(false))
  }, [post?.id])

  if (!post) return null

  const handleLike = async () => {
    if (!isLoggedIn) {
      window.location.href = "/login"
      return
    }
    const wasLiked = post.liked_by_me
    onLikeToggle(post.id, !wasLiked)
    const res = await fetch(`/api/gallery/${post.id}/like`, { method: "POST" })
    if (!res.ok) onLikeToggle(post.id, wasLiked)
  }

  const handleSubmitComment = async () => {
    const txt = newComment.trim()
    if (!txt || posting) return
    if (!isLoggedIn) {
      window.location.href = "/login"
      return
    }
    setPosting(true)
    const res = await fetch(`/api/gallery/${post.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: txt }),
    })
    if (res.ok) {
      const { item } = await res.json()
      setComments((prev) => [item, ...prev])
      onCommentAdded(post.id)
      setNewComment("")
    }
    setPosting(false)
  }

  const handleDelete = async () => {
    if (!confirm("Энэ бүтээлийг устгах уу?")) return
    const res = await fetch(`/api/gallery/${post.id}`, { method: "DELETE" })
    if (res.ok) onDelete(post.id)
  }

  const isOwner = currentUserId && currentUserId === post.user_id

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-6 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative grid h-full max-h-[95vh] w-full max-w-5xl grid-rows-[auto,1fr] sm:grid-rows-1 sm:grid-cols-[1.2fr,1fr] overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Media side */}
        <div className="relative flex items-center justify-center bg-black sm:max-h-none max-h-[55vh]">
          {post.media_type === "video" ? (
            <video src={post.media_url} controls autoPlay playsInline className="max-h-full max-w-full" />
          ) : (
            <img src={post.media_url || "/placeholder.svg"} alt={post.title} className="max-h-full max-w-full object-contain" />
          )}
          <button
            onClick={onClose}
            className="absolute right-3 top-3 rounded-lg bg-background/70 p-2 text-foreground backdrop-blur-md hover:bg-background sm:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Info / comments side */}
        <div className="flex flex-col overflow-hidden border-t sm:border-t-0 sm:border-l border-border">
          <div className="flex items-start justify-between gap-2 border-b border-border p-4">
            <div className="min-w-0 flex-1">
              {post.title && <h3 className="truncate font-semibold">{post.title}</h3>}
              <p className="text-xs text-muted-foreground">{authorLabel(post.author)}</p>
            </div>
            <div className="flex items-center gap-1">
              {isOwner && (
                <button
                  onClick={handleDelete}
                  className="rounded-md p-2 text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
                  aria-label="delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={onClose}
                className="hidden sm:flex rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {post.description && (
            <p className="border-b border-border p-4 text-sm text-muted-foreground whitespace-pre-wrap">
              {post.description}
            </p>
          )}

          <div className="flex items-center gap-4 border-b border-border px-4 py-3">
            <button onClick={handleLike} className="inline-flex items-center gap-1.5 text-sm transition-transform hover:scale-105">
              <Heart className={`h-5 w-5 ${post.liked_by_me ? "fill-red-500 text-red-500" : ""}`} />
              <span className="font-medium">{post.likes_count}</span>
            </button>
            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <MessageCircle className="h-5 w-5" />
              <span className="font-medium">{post.comments_count}</span>
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loadingComments ? (
              <p className="text-center text-xs text-muted-foreground">Уншиж байна...</p>
            ) : comments.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground">Эхний сэтгэгдлийг бичээрэй!</p>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="flex gap-2">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent overflow-hidden">
                    {c.author?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.author.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      authorInitial(c.author)
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium">{authorLabel(c.author)}</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">{c.content}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-border p-3">
            {isLoggedIn ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Сэтгэгдэл бичих..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSubmitComment()
                  }}
                  maxLength={1000}
                  disabled={posting}
                  className="flex-1 rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm outline-none focus:border-accent"
                />
                <Button
                  size="sm"
                  onClick={handleSubmitComment}
                  disabled={!newComment.trim() || posting}
                  className="bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            ) : (
              <Button variant="outline" className="w-full" asChild>
                <a href="/login">Сэтгэгдэл бичихийн тулд нэвтэрнэ үү</a>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
