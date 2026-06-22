"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, MapPin, ExternalLink, Heart, Film, Sparkles, Loader2, Calendar } from "lucide-react"

type PublicProfile = {
  id: string
  display_name: string | null
  username: string
  bio: string | null
  avatar_url: string | null
  banner_url: string | null
  website: string | null
  location: string | null
  created_at: string
}
type Post = {
  id: string
  title: string
  media_url: string
  media_type: "image" | "video"
  thumbnail_url: string | null
  likes_count: number
  comments_count: number
}

export function ProfileView({ username }: { username: string }) {
  const [locale] = useState<"en" | "mn">("mn")
  const t = (mn: string, en: string) => (locale === "mn" ? mn : en)
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [stats, setStats] = useState({ posts: 0, likes: 0 })
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    fetch(`/api/profile/${encodeURIComponent(username)}`)
      .then((r) => {
        if (r.status === 404) {
          setNotFound(true)
          setLoading(false)
          return null
        }
        return r.json()
      })
      .then((j) => {
        if (!j) return
        setProfile(j.profile)
        setPosts(j.posts)
        setStats(j.stats)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [username])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    )
  }

  if (notFound || !profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <div className="text-6xl font-bold text-muted-foreground/20">404</div>
        <p className="mt-4 text-muted-foreground">{t("Хэрэглэгч олдсонгүй", "User not found")}</p>
        <Link href="/gallery" className="mt-6 text-sm text-accent hover:underline">
          {t("Галерей руу буцах", "Back to Gallery")}
        </Link>
      </div>
    )
  }

  const initials = (profile.display_name || profile.username)
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()

  const joinedDate = new Date(profile.created_at).toLocaleDateString(locale === "mn" ? "mn-MN" : "en-US", {
    year: "numeric",
    month: "long",
  })

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="sticky top-0 z-30 border-b border-border/50 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/gallery" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            {t("Галерей", "Gallery")}
          </Link>
          <Link href="/" className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
            </span>
            <span className="text-sm font-bold">VexoAi</span>
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 sm:px-6 pb-16">
        {/* Banner */}
        <div className="relative mt-4 h-40 sm:h-56 overflow-hidden rounded-xl sm:rounded-2xl border border-border bg-gradient-to-br from-accent/20 via-secondary to-background">
          {profile.banner_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.banner_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/20 to-transparent" />
        </div>

        {/* Header info */}
        <div className="relative -mt-14 sm:-mt-16 px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="h-24 w-24 sm:h-32 sm:w-32 rounded-full ring-4 ring-background bg-secondary overflow-hidden flex items-center justify-center flex-shrink-0">
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt={profile.display_name || ""} className="h-full w-full object-cover" />
              ) : (
                <span className="text-2xl sm:text-4xl font-bold text-muted-foreground">{initials}</span>
              )}
            </div>
            <div className="flex-1 min-w-0 sm:pb-2">
              <h1 className="text-xl sm:text-2xl font-bold truncate">
                {profile.display_name || profile.username}
              </h1>
              <div className="text-sm text-muted-foreground">@{profile.username}</div>
            </div>
          </div>

          {profile.bio && (
            <p className="mt-4 text-sm text-foreground/90 max-w-2xl whitespace-pre-wrap leading-relaxed">{profile.bio}</p>
          )}

          {/* Meta row */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            {profile.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {profile.location}
              </span>
            )}
            {profile.website && (
              <a
                href={profile.website.startsWith("http") ? profile.website : `https://${profile.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-accent hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                {profile.website.replace(/^https?:\/\//, "")}
              </a>
            )}
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {t("Нэгдсэн", "Joined")} {joinedDate}
            </span>
          </div>

          {/* Stats */}
          <div className="mt-4 flex gap-3 sm:gap-6">
            <Stat icon={<Film className="h-3.5 w-3.5" />} label={t("Бүтээл", "Posts")} value={stats.posts} />
            <Stat icon={<Heart className="h-3.5 w-3.5" />} label={t("Лайк", "Likes")} value={stats.likes} />
          </div>
        </div>

        {/* Posts grid */}
        <div className="mt-8 px-4 sm:px-6">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-accent" />
            {t("Бүтээлүүд", "Creations")}
            <span className="text-xs text-muted-foreground font-normal">({posts.length})</span>
          </div>

          {posts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-secondary/20 py-16 text-center">
              <Film className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <p className="mt-3 text-sm text-muted-foreground">
                {t("Одоогоор бүтээл байхгүй байна", "No creations yet")}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
              {posts.map((p) => (
                <Link
                  key={p.id}
                  href={`/gallery?post=${p.id}`}
                  className="group relative aspect-[3/4] overflow-hidden rounded-lg sm:rounded-xl border border-border bg-secondary"
                >
                  {p.media_type === "video" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.thumbnail_url || "/placeholder.svg"}
                      alt={p.title}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.media_url}
                      alt={p.title}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute bottom-2 left-2 right-2 flex items-center gap-2 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="inline-flex items-center gap-1">
                      <Heart className="h-3 w-3 fill-white" />
                      {p.likes_count}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      💬 {p.comments_count}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-1.5">
      <span className="text-accent">{icon}</span>
      <span className="text-sm font-bold">{value.toLocaleString()}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}
