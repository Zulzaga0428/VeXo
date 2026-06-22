import { createAdminClient } from "@/lib/supabase/admin"
import { Users, Film, CreditCard, Coins, TrendingUp, Activity } from "lucide-react"

export const dynamic = "force-dynamic"

function fmt(n: number) {
  return new Intl.NumberFormat("mn-MN").format(n)
}

export default async function AdminDashboardPage() {
  const supabase = createAdminClient()

  const [
    { count: userCount },
    { count: videoCount },
    { count: paidCount },
    paymentsRes,
    recentUsersRes,
    recentVideosRes,
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("videos").select("*", { count: "exact", head: true }),
    supabase
      .from("payments")
      .select("*", { count: "exact", head: true })
      .eq("status", "paid"),
    supabase.from("payments").select("amount, status"),
    supabase
      .from("profiles")
      .select("id, email, full_name, plan, credits, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("videos")
      .select("id, prompt, status, created_at, user_id")
      .order("created_at", { ascending: false })
      .limit(5),
  ])

  const totalRevenue = (paymentsRes.data ?? [])
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + (p.amount ?? 0), 0)

  const stats = [
    {
      label: "Нийт хэрэглэгч",
      value: fmt(userCount ?? 0),
      icon: Users,
      color: "text-accent",
    },
    {
      label: "Үүсгэсэн видео",
      value: fmt(videoCount ?? 0),
      icon: Film,
      color: "text-blue-500",
    },
    {
      label: "Төлбөр төлсөн",
      value: fmt(paidCount ?? 0),
      icon: CreditCard,
      color: "text-emerald-500",
    },
    {
      label: "Нийт орлого (₮)",
      value: fmt(totalRevenue),
      icon: TrendingUp,
      color: "text-amber-500",
    },
  ]

  return (
    <div className="p-6 sm:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Хяналтын самбар</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          VexoAi платформын ерөнхий мэдээлэл
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <div
              key={s.label}
              className="rounded-xl border border-border bg-card p-4 sm:p-5"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {s.label}
                </p>
                <Icon className={`h-4 w-4 ${s.color}`} />
              </div>
              <p className="mt-2 text-2xl sm:text-3xl font-bold">{s.value}</p>
            </div>
          )
        })}
      </div>

      {/* Recent users + videos */}
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border p-4">
            <h2 className="text-sm font-semibold">Сүүлд бүртгүүлсэн</h2>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="divide-y divide-border">
            {(recentUsersRes.data ?? []).map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between p-4 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {u.full_name || u.email || "—"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {u.email}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="rounded-full border border-border px-2 py-0.5 text-muted-foreground">
                    {u.plan || "free"}
                  </span>
                  <span className="flex items-center gap-1 text-accent">
                    <Coins className="h-3 w-3" />
                    {u.credits ?? 0}
                  </span>
                </div>
              </div>
            ))}
            {(recentUsersRes.data ?? []).length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">
                Хэрэглэгч алга
              </p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border p-4">
            <h2 className="text-sm font-semibold">Сүүлийн видеонууд</h2>
            <Film className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="divide-y divide-border">
            {(recentVideosRes.data ?? []).map((v) => (
              <div key={v.id} className="p-4 text-sm">
                <p className="line-clamp-2 text-foreground">
                  {v.prompt || "(prompt алга)"}
                </p>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span
                    className={`rounded-full px-2 py-0.5 ${
                      v.status === "completed"
                        ? "bg-emerald-500/10 text-emerald-500"
                        : v.status === "failed"
                          ? "bg-destructive/10 text-destructive"
                          : "bg-amber-500/10 text-amber-500"
                    }`}
                  >
                    {v.status}
                  </span>
                  <span>
                    {new Date(v.created_at).toLocaleDateString("mn-MN")}
                  </span>
                </div>
              </div>
            ))}
            {(recentVideosRes.data ?? []).length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">Видео алга</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
