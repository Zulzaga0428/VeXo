import { createAdminClient } from "@/lib/supabase/admin"
import { CreditCard, TrendingUp, Clock, XCircle } from "lucide-react"

export const dynamic = "force-dynamic"

function fmt(n: number) {
  return new Intl.NumberFormat("mn-MN").format(n)
}

export default async function AdminPaymentsPage() {
  const supabase = createAdminClient()
  const { data: payments } = await supabase
    .from("payments")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200)

  const userIds = Array.from(
    new Set((payments ?? []).map((p) => p.user_id).filter(Boolean))
  )
  const { data: profiles } = userIds.length
    ? await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", userIds)
    : { data: [] as { id: string; email: string | null; full_name: string | null }[] }
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))

  const paid = (payments ?? []).filter((p) => p.status === "paid")
  const pending = (payments ?? []).filter((p) => p.status === "pending")
  const failed = (payments ?? []).filter((p) => p.status === "failed")
  const totalRevenue = paid.reduce((s, p) => s + (p.amount ?? 0), 0)

  const stats = [
    {
      label: "Нийт орлого",
      value: `${fmt(totalRevenue)}₮`,
      icon: TrendingUp,
      color: "text-emerald-500",
    },
    {
      label: "Амжилттай",
      value: fmt(paid.length),
      icon: CreditCard,
      color: "text-accent",
    },
    {
      label: "Хүлээгдэж буй",
      value: fmt(pending.length),
      icon: Clock,
      color: "text-amber-500",
    },
    {
      label: "Алдаатай",
      value: fmt(failed.length),
      icon: XCircle,
      color: "text-destructive",
    },
  ]

  const statusBadge = (s: string) => {
    if (s === "paid") return "bg-emerald-500/10 text-emerald-500"
    if (s === "failed") return "bg-destructive/10 text-destructive"
    if (s === "pending") return "bg-amber-500/10 text-amber-500"
    return "bg-secondary text-muted-foreground"
  }

  return (
    <div className="p-6 sm:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Төлбөр</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Төлбөрийн түүх ба орлогын статистик
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <div
              key={s.label}
              className="rounded-xl border border-border bg-card p-4"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <Icon className={`h-4 w-4 ${s.color}`} />
              </div>
              <p className="mt-2 text-xl sm:text-2xl font-bold">{s.value}</p>
            </div>
          )
        })}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-xs text-muted-foreground">
            <tr>
              <th className="p-3 text-left font-medium">Хэрэглэгч</th>
              <th className="p-3 text-left font-medium">Plan</th>
              <th className="p-3 text-left font-medium">Дүн</th>
              <th className="p-3 text-left font-medium">Credit</th>
              <th className="p-3 text-left font-medium">Статус</th>
              <th className="p-3 text-left font-medium">Invoice</th>
              <th className="p-3 text-left font-medium">Огноо</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(payments ?? []).map((p) => {
              const u = profileMap.get(p.user_id)
              return (
                <tr key={p.id} className="hover:bg-secondary/30">
                  <td className="p-3">
                    <p className="text-xs font-medium">
                      {u?.full_name || "—"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {u?.email || p.user_id.slice(0, 8)}
                    </p>
                  </td>
                  <td className="p-3">
                    <span className="rounded-full border border-border px-2 py-0.5 text-xs">
                      {p.plan_type || "—"}
                    </span>
                  </td>
                  <td className="p-3 font-medium">
                    {fmt(p.amount ?? 0)}₮
                  </td>
                  <td className="p-3 text-xs text-accent">
                    {fmt(p.credits ?? 0)}
                  </td>
                  <td className="p-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] ${statusBadge(p.status)}`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground font-mono">
                    {p.invoice_id?.slice(0, 12) || "—"}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {new Date(p.created_at).toLocaleDateString("mn-MN")}
                  </td>
                </tr>
              )
            })}
            {(payments ?? []).length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="p-8 text-center text-sm text-muted-foreground"
                >
                  Төлбөр алга
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
