"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Camera,
  Save,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  MapPin,
  AtSign,
  Sparkles,
  CreditCard,
  AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"

type Profile = {
  id: string
  display_name: string | null
  username: string | null
  bio: string | null
  avatar_url: string | null
  banner_url: string | null
  website: string | null
  location: string | null
  credits: number | null
  email: string
}

export function ProfileEditor() {
  const router = useRouter()
  const [locale] = useState<"en" | "mn">("mn")
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)

  const t = (mn: string, en: string) => (locale === "mn" ? mn : en)

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => {
        if (r.status === 401) {
          router.push("/login")
          return null
        }
        return r.json()
      })
      .then((j) => {
        if (j?.profile) setProfile(j.profile)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [router])

  const update = (key: keyof Profile, value: string) => {
    setProfile((p) => (p ? { ...p, [key]: value } : p))
  }

  const handleSave = async () => {
    if (!profile) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: profile.display_name,
          username: profile.username,
          bio: profile.bio,
          website: profile.website,
          location: profile.location,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || "Failed")
      } else {
        setProfile((p) => (p ? { ...p, ...json.profile, email: p.email } : p))
        setSavedFlash(true)
        setTimeout(() => setSavedFlash(false), 1800)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleUpload = async (file: File, kind: "avatar" | "banner") => {
    const setter = kind === "avatar" ? setUploadingAvatar : setUploadingBanner
    setter(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("kind", kind)
      const res = await fetch("/api/profile/upload", { method: "POST", body: fd })
      const json = await res.json()
      if (res.ok && json.url) {
        setProfile((p) => (p ? { ...p, [kind === "avatar" ? "avatar_url" : "banner_url"]: json.url } : p))
      } else {
        setError(json.error || "Upload failed")
      }
    } finally {
      setter(false)
    }
  }

  if (loading || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    )
  }

  const initials = (profile.display_name || profile.email || "?")
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="sticky top-0 z-30 border-b border-border/50 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link href="/app/dashboard" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            {t("Буцах", "Back")}
          </Link>
          <h1 className="text-sm font-semibold">{t("Профайл засах", "Edit Profile")}</h1>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="bg-accent text-accent-foreground hover:bg-accent/90 h-8"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : savedFlash ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <>
                <Save className="h-3.5 w-3.5 mr-1.5" />
                {t("Хадгалах", "Save")}
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 sm:px-6 pb-16">
        {/* Banner + Avatar */}
        <div className="relative mt-4 overflow-hidden rounded-xl sm:rounded-2xl border border-border">
          <div className="relative h-40 sm:h-56 w-full bg-gradient-to-br from-accent/20 via-secondary to-background">
            {profile.banner_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.banner_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />
            <button
              onClick={() => bannerInputRef.current?.click()}
              disabled={uploadingBanner}
              className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-background/80 backdrop-blur-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-background disabled:opacity-60 transition-colors"
            >
              {uploadingBanner ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Camera className="h-3.5 w-3.5" />
              )}
              {t("Ковер солих", "Change cover")}
            </button>
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], "banner")}
            />
          </div>

          {/* Avatar overlapping */}
          <div className="flex items-end gap-4 px-4 sm:px-6 -mt-12 sm:-mt-14 pb-4">
            <div className="relative">
              <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-full ring-4 ring-background bg-secondary overflow-hidden flex items-center justify-center">
                {profile.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-2xl sm:text-3xl font-bold text-muted-foreground">{initials}</span>
                )}
              </div>
              <button
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute bottom-0 right-0 inline-flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-accent text-accent-foreground ring-2 ring-background hover:bg-accent/90 disabled:opacity-60 transition-colors"
              >
                {uploadingAvatar ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], "avatar")}
              />
            </div>

            <div className="flex-1 min-w-0 pb-1">
              <div className="text-base sm:text-lg font-bold truncate">
                {profile.display_name || t("Нэрээ оруулна уу", "Set your name")}
              </div>
              {profile.username && (
                <div className="text-sm text-muted-foreground truncate">@{profile.username}</div>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Stats card */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Link
            href="/app/pricing"
            className="group rounded-xl border border-accent/30 bg-gradient-to-br from-accent/10 to-transparent p-4 transition-all hover:border-accent/60 hover:shadow-[0_0_20px_hsl(var(--accent)/0.15)]"
          >
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CreditCard className="h-3.5 w-3.5" />
              {t("Кредит", "Credits")}
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-accent">{profile.credits ?? 0}</span>
              <span className="text-[10px] text-accent/70 group-hover:translate-x-0.5 transition-transform">
                {t("Цэнэглэх", "Top up")} →
              </span>
            </div>
          </Link>
          <div className="rounded-xl border border-border bg-secondary/30 p-4">
            <div className="text-xs text-muted-foreground">{t("Имэйл", "Email")}</div>
            <div className="mt-1 text-sm font-medium truncate">{profile.email}</div>
          </div>
          <Link
            href={profile.username ? `/u/${profile.username}` : "#"}
            className={`rounded-xl border border-border bg-secondary/30 p-4 transition-colors ${
              profile.username ? "hover:border-accent/40 hover:bg-secondary/50" : "opacity-60 pointer-events-none"
            }`}
          >
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              {t("Нийтийн профайл", "Public profile")}
            </div>
            <div className="mt-1 text-sm font-medium truncate text-accent">
              {profile.username ? `/u/${profile.username}` : t("Хэрэглэгчийн нэр оруулна уу", "Set username first")}
            </div>
          </Link>
        </div>

        {/* Form */}
        <div className="mt-4 sm:mt-6 grid gap-4 sm:gap-5 rounded-xl sm:rounded-2xl border border-border bg-card p-4 sm:p-6">
          <Field
            label={t("Харуулах нэр", "Display name")}
            value={profile.display_name || ""}
            onChange={(v) => update("display_name", v)}
            placeholder={t("Жишээ: Болд Б.", "e.g. John Doe")}
          />
          <Field
            label={t("Хэрэглэгчийн нэр", "Username")}
            icon={<AtSign className="h-3.5 w-3.5" />}
            prefix="@"
            value={profile.username || ""}
            onChange={(v) => update("username", v.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20))}
            placeholder="bold_b"
            hint={t("3-20 тэмдэгт. Зөвхөн a-z, 0-9, _", "3-20 chars. Only a-z, 0-9, _")}
          />
          <Field
            label={t("Тухай мэдээлэл", "Bio")}
            value={profile.bio || ""}
            onChange={(v) => update("bio", v.slice(0, 200))}
            placeholder={t("Өөрийнхөө тухай хэлээрэй...", "Tell us about yourself...")}
            multiline
            hint={`${(profile.bio || "").length}/200`}
          />
          <div className="grid sm:grid-cols-2 gap-4">
            <Field
              label={t("Байршил", "Location")}
              icon={<MapPin className="h-3.5 w-3.5" />}
              value={profile.location || ""}
              onChange={(v) => update("location", v)}
              placeholder={t("Улаанбаатар", "Ulaanbaatar")}
            />
            <Field
              label={t("Вэбсайт", "Website")}
              icon={<ExternalLink className="h-3.5 w-3.5" />}
              value={profile.website || ""}
              onChange={(v) => update("website", v)}
              placeholder="https://..."
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  icon,
  prefix,
  hint,
  multiline,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  icon?: React.ReactNode
  prefix?: string
  hint?: string
  multiline?: boolean
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          {icon}
          {label}
        </span>
        {hint && <span className="text-[10px] text-muted-foreground/70">{hint}</span>}
      </div>
      <div className="relative flex items-stretch rounded-lg border border-border bg-background focus-within:border-accent/60 focus-within:ring-2 focus-within:ring-accent/20 transition-all">
        {prefix && (
          <span className="flex items-center px-3 text-sm text-muted-foreground border-r border-border">
            {prefix}
          </span>
        )}
        {multiline ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={3}
            className="flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/50 resize-none"
          />
        ) : (
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/50"
          />
        )}
      </div>
    </label>
  )
}
