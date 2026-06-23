"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Film,
  History,
  LayoutGrid,
  ImageIcon,
  Settings,
  User,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Subtitles,
  Layers,
  Sparkles,
  Clapperboard,
  Menu,
  Compass,
  X,
  Shield,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"

interface AppSidebarProps {
  locale: "mn" | "en"
  onCollapsedChange?: (collapsed: boolean) => void
  // Overlay mode (HeyGen-style): no fixed desktop rail. The sidebar slides in
  // as an overlay drawer on all screen sizes, controlled by `open`/`onOpenChange`.
  overlay?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

type MenuItem = {
  id: string
  href: string
  icon: typeof Film
  labelMn: string
  labelEn: string
  badge?: string
}

const createSection: MenuItem[] = [
  { id: "dashboard", href: "/app/dashboard", icon: LayoutGrid, labelMn: "Нүүр", labelEn: "Dashboard" },
  { id: "studio", href: "/app/create", icon: Clapperboard, labelMn: "Видео үүсгэх", labelEn: "Create Video" },
  { id: "images", href: "/app/editor", icon: ImageIcon, labelMn: "Зураг үүсгэх", labelEn: "Generate Image" },
  { id: "subtitles", href: "/app/subtitle", icon: Subtitles, labelMn: "Subtitle үүсгэх", labelEn: "Subtitles" },
]

const librarySection: MenuItem[] = [
  { id: "history", href: "/app/history", icon: History, labelMn: "Миний бичлэгүүд", labelEn: "My Videos" },
  { id: "gallery", href: "/gallery", icon: Compass, labelMn: "Галерей", labelEn: "Gallery" },
  { id: "models", href: "/app/models", icon: Layers, labelMn: "AI Models", labelEn: "AI Models" },
]

const accountSection: MenuItem[] = [
  { id: "pricing", href: "/app/pricing", icon: CreditCard, labelMn: "Кредит авах", labelEn: "Buy Credits" },
  { id: "settings", href: "/app/profile", icon: User, labelMn: "Профайл", labelEn: "Profile" },
]

export function AppSidebar({ locale, onCollapsedChange, overlay = false, open, onOpenChange }: AppSidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [internalMobileOpen, setInternalMobileOpen] = useState(false)
  // In overlay mode the open state is controlled by the parent (e.g. Studio).
  const mobileOpen = overlay ? !!open : internalMobileOpen
  const setMobileOpen = overlay ? (v: boolean) => onOpenChange?.(v) : setInternalMobileOpen
  const [credits, setCredits] = useState<number | null>(null)
  const [userEmail, setUserEmail] = useState<string>("")
  const [isAdmin, setIsAdmin] = useState(false)
  // null = still checking, false = signed out, true = signed in
  const [signedIn, setSignedIn] = useState<boolean | null>(null)

  useEffect(() => {
    const supabase = createClient()
    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setSignedIn(false)
        return
      }
      setSignedIn(true)
      setUserEmail(user.email || "")
      const { data } = await supabase.from("profiles").select("credits").eq("id", user.id).single()
      if (data) setCredits(data.credits ?? 0)

      // check admin
      try {
        const res = await fetch("/api/admin/check")
        if (res.ok) {
          const j = await res.json()
          setIsAdmin(!!j.isAdmin)
        }
      } catch {}
    })()
  }, [])

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden"
      return () => {
        document.body.style.overflow = ""
      }
    }
  }, [mobileOpen])

  const handleToggle = () => {
    const newState = !collapsed
    setCollapsed(newState)
    onCollapsedChange?.(newState)
  }

  // On mobile, the sidebar is never collapsed (always full width inside drawer)
  const isCollapsedView = collapsed && !mobileOpen

  const renderItem = (item: MenuItem) => {
    const isActive = pathname === item.href
    const isDisabled = !!item.badge
    const label = locale === "mn" ? item.labelMn : item.labelEn

    return (
      <Link
        key={item.id}
        href={isDisabled ? "#" : item.href}
        onClick={(e) => {
          if (isDisabled) e.preventDefault()
          else setMobileOpen(false)
        }}
        title={isCollapsedView ? label : undefined}
        className={cn(
          "group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-all",
          isCollapsedView ? "justify-center" : "",
          isActive
            ? "bg-accent/15 text-accent shadow-[inset_0_0_0_1px_hsl(var(--accent)/0.2)]"
            : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
          isDisabled && "opacity-40 cursor-not-allowed hover:bg-transparent",
        )}
      >
        {isActive && !isCollapsedView && (
          <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-accent" />
        )}
        <item.icon
          className={cn(
            "h-4 w-4 flex-shrink-0 transition-transform",
            isActive ? "text-accent" : "group-hover:scale-110",
          )}
        />
        {!isCollapsedView && (
          <>
            <span className="flex-1 truncate font-medium">{label}</span>
            {item.badge && (
              <span className="rounded-full border border-border/60 bg-secondary px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                {item.badge}
              </span>
            )}
          </>
        )}
      </Link>
    )
  }

  const renderSectionLabel = (mn: string, en: string) => {
    if (isCollapsedView) return <div className="my-2 mx-auto h-px w-6 bg-border/60" />
    return (
      <div className="px-2.5 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/50">
        {locale === "mn" ? mn : en}
      </div>
    )
  }

  const sidebarContent = (
    <>
      <div className="flex-1 overflow-y-auto px-2 py-3">
        {renderSectionLabel("Үүсгэх", "Create")}
        <div className="space-y-0.5">{createSection.map(renderItem)}</div>

        {renderSectionLabel("Сан", "Library")}
        <div className="space-y-0.5">{librarySection.map(renderItem)}</div>

        {renderSectionLabel("Бүртгэл", "Account")}
        <div className="space-y-0.5">{accountSection.map(renderItem)}</div>

        {isAdmin && (
          <>
            {renderSectionLabel("Админ", "Admin")}
            <div className="space-y-0.5">
              <Link
                href="/admin"
                onClick={() => setMobileOpen(false)}
                title={isCollapsedView ? (locale === "mn" ? "Админ самбар" : "Admin panel") : undefined}
                className={cn(
                  "group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-all",
                  isCollapsedView ? "justify-center" : "",
                  pathname.startsWith("/admin")
                    ? "bg-accent/15 text-accent shadow-[inset_0_0_0_1px_hsl(var(--accent)/0.2)]"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                )}
              >
                {pathname.startsWith("/admin") && !isCollapsedView && (
                  <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-accent" />
                )}
                <Shield className="h-4 w-4 flex-shrink-0 group-hover:scale-110 transition-transform" />
                {!isCollapsedView && (
                  <span className="flex-1 truncate font-medium">
                    {locale === "mn" ? "Админ самбар" : "Admin Panel"}
                  </span>
                )}
              </Link>
            </div>
          </>
        )}
      </div>

      <div className="border-t border-border/40 p-2">
        {/* Signed out: show login / register instead of the credit block */}
        {signedIn === false && !isCollapsedView && (
          <div className="mb-2 space-y-2">
            <Link
              href="/register"
              onClick={() => setMobileOpen(false)}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent/90"
            >
              {locale === "mn" ? "Бүртгүүлэх" : "Sign up"}
            </Link>
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-accent/40 hover:text-foreground"
            >
              {locale === "mn" ? "Нэвтрэх" : "Sign in"}
            </Link>
          </div>
        )}

        {signedIn === false && isCollapsedView && (
          <Link
            href="/login"
            title={locale === "mn" ? "Нэвтрэх" : "Sign in"}
            className="mb-2 mx-auto flex h-9 w-9 items-center justify-center rounded-lg border border-accent/25 bg-accent/10 text-accent transition-colors hover:bg-accent/20"
          >
            <User className="h-4 w-4" />
          </Link>
        )}

        {/* Signed in: credit block */}
        {signedIn === true && !isCollapsedView && (
          <Link
            href="/app/pricing"
            onClick={() => setMobileOpen(false)}
            className="mb-2 block rounded-lg border border-accent/25 bg-gradient-to-br from-accent/10 to-accent/5 p-3 transition-colors hover:border-accent/50 hover:from-accent/15 hover:to-accent/10"
          >
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Sparkles className="h-3 w-3 text-accent" />
              {locale === "mn" ? "Кредит" : "Credits"}
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-foreground">
                {credits === null ? "—" : credits.toLocaleString()}
              </span>
            </div>
            <div className="mt-1.5 text-[11px] text-accent">{locale === "mn" ? "Дахин авах →" : "Top up →"}</div>
          </Link>
        )}

        {signedIn === true && isCollapsedView && credits !== null && (
          <div
            title={locale === "mn" ? `${credits} кредит` : `${credits} credits`}
            className="mb-2 mx-auto flex h-9 w-9 items-center justify-center rounded-lg border border-accent/25 bg-accent/10 text-[11px] font-bold text-accent"
          >
            {credits > 999 ? `${Math.floor(credits / 1000)}k` : credits}
          </div>
        )}

        {/* Collapse toggle — desktop only */}
        <button
          onClick={handleToggle}
          title={isCollapsedView ? (locale === "mn" ? "Дэлгэх" : "Expand") : undefined}
          className={cn(
            "hidden md:flex w-full items-center gap-2 rounded-lg border border-accent/30 bg-accent/10 px-2.5 py-2 text-xs font-medium text-accent shadow-[inset_0_0_0_1px_hsl(var(--accent)/0.15)] transition-all hover:border-accent/60 hover:bg-accent/20 hover:shadow-[0_0_12px_hsl(var(--accent)/0.25)]",
            isCollapsedView && "justify-center",
          )}
        >
          {isCollapsedView ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span className="font-medium">{locale === "mn" ? "Хураах" : "Collapse"}</span>
            </>
          )}
        </button>

        {!isCollapsedView && userEmail && (
          <div className="mt-2 truncate px-2.5 text-[10px] text-muted-foreground/60" title={userEmail}>
            {userEmail}
          </div>
        )}
      </div>
    </>
  )

  return (
    <>
      {/* Mobile floating menu button (hidden in overlay mode) */}
      {!overlay && (
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="md:hidden fixed bottom-5 left-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg shadow-accent/30 active:scale-95 transition-transform"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}

      {/* Backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className={cn(
            "fixed inset-0 z-50 bg-background/70 backdrop-blur-sm animate-in fade-in duration-200",
            !overlay && "md:hidden",
          )}
        />
      )}

      {/* Drawer */}
      <aside
        onMouseLeave={() => {
          // In overlay mode on hover-capable devices, close when the cursor leaves
          // so a hover-opened menu tidies itself away.
          if (overlay && typeof window !== "undefined" && window.matchMedia("(hover: hover)").matches) {
            setMobileOpen(false)
          }
        }}
        className={cn(
          "fixed left-0 top-0 z-50 h-full w-[78%] max-w-[280px] border-r border-border/50 bg-background flex flex-col transition-transform duration-300 ease-out",
          !overlay && "md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Drawer header */}
        <div className="flex h-14 items-center justify-between border-b border-border/40 px-3">
          <span className="font-semibold text-sm">VexoAi</span>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {sidebarContent}
      </aside>

      {/* Desktop fixed rail (hidden in overlay mode) */}
      {!overlay && (
        <aside
          className={cn(
            "fixed left-0 top-14 z-40 h-[calc(100vh-56px)] border-r border-border/50 bg-background/80 backdrop-blur-md transition-all duration-300 hidden md:flex flex-col",
            collapsed ? "w-16" : "w-56",
          )}
        >
          {sidebarContent}
        </aside>
      )}
    </>
  )
}
