"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LayoutDashboard, Users, Film, CreditCard, LogOut, Home, Sparkles, Mic, Wand2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

const items = [
  { href: "/admin", label: "Хяналтын самбар", icon: LayoutDashboard },
  { href: "/admin/users", label: "Хэрэглэгчид", icon: Users },
  { href: "/admin/videos", label: "Видеонууд", icon: Film },
  { href: "/admin/payments", label: "Төлбөр", icon: CreditCard },
  { href: "/admin/showcase", label: "Showcase", icon: Sparkles },
  { href: "/admin/voice-previews", label: "Хоолойн дээж", icon: Mic },
  { href: "/admin/prompt-library", label: "Free Prompt", icon: Wand2 },
]

export function AdminSidebar({ email }: { email: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

  return (
    <aside className="sticky top-0 hidden h-screen w-60 flex-col border-r border-border bg-card md:flex">
      <div className="border-b border-border p-4">
        <Link href="/admin" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <span className="text-sm font-bold">V</span>
          </div>
          <div>
            <p className="text-sm font-semibold">VexoAi</p>
            <p className="text-[10px] text-muted-foreground">Admin Console</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {items.map((item) => {
          const Icon = item.icon
          const active =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-accent/10 text-accent"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-border p-3">
        <div className="mb-2 px-3 py-2 text-xs">
          <p className="truncate font-medium text-foreground">{email}</p>
          <p className="text-[10px] text-muted-foreground">Admin</p>
        </div>
        <Link
          href="/app"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Home className="h-4 w-4" />
          Апп руу буцах
        </Link>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          Гарах
        </button>
      </div>
    </aside>
  )
}
