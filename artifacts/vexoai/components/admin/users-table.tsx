"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Search, Coins, Pencil, Check, X } from "lucide-react"

type Profile = {
  id: string
  email: string | null
  full_name: string | null
  phone: string | null
  plan: string | null
  credits: number | null
  created_at: string
}

export function UsersTable({ users }: { users: Profile[] }) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [editing, setEditing] = useState<string | null>(null)
  const [editPlan, setEditPlan] = useState("")
  const [editCredits, setEditCredits] = useState(0)
  const [pending, startTransition] = useTransition()

  const filtered = users.filter((u) => {
    if (!query) return true
    const q = query.toLowerCase()
    return (
      (u.email ?? "").toLowerCase().includes(q) ||
      (u.full_name ?? "").toLowerCase().includes(q) ||
      (u.phone ?? "").toLowerCase().includes(q)
    )
  })

  const startEdit = (u: Profile) => {
    setEditing(u.id)
    setEditPlan(u.plan ?? "free")
    setEditCredits(u.credits ?? 0)
  }

  const save = (id: string) => {
    startTransition(async () => {
      await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, plan: editPlan, credits: editCredits }),
      })
      setEditing(null)
      router.refresh()
    })
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="border-b border-border p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Email, нэр, утсаар хайх..."
            className="w-full rounded-lg border border-border bg-background pl-10 pr-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-xs text-muted-foreground">
            <tr>
              <th className="p-3 text-left font-medium">Хэрэглэгч</th>
              <th className="p-3 text-left font-medium">Утас</th>
              <th className="p-3 text-left font-medium">Plan</th>
              <th className="p-3 text-left font-medium">Credit</th>
              <th className="p-3 text-left font-medium">Бүртгүүлсэн</th>
              <th className="p-3 text-right font-medium">Үйлдэл</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((u) => (
              <tr key={u.id} className="hover:bg-secondary/30">
                <td className="p-3">
                  <p className="font-medium">{u.full_name || "—"}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </td>
                <td className="p-3 text-muted-foreground">{u.phone || "—"}</td>
                <td className="p-3">
                  {editing === u.id ? (
                    <select
                      value={editPlan}
                      onChange={(e) => setEditPlan(e.target.value)}
                      className="rounded border border-border bg-background px-2 py-1 text-xs"
                    >
                      <option value="free">free</option>
                      <option value="standard">standard</option>
                      <option value="pro">pro</option>
                      <option value="premium">premium</option>
                    </select>
                  ) : (
                    <span className="rounded-full border border-border px-2 py-0.5 text-xs">
                      {u.plan || "free"}
                    </span>
                  )}
                </td>
                <td className="p-3">
                  {editing === u.id ? (
                    <input
                      type="number"
                      value={editCredits}
                      onChange={(e) => setEditCredits(Number(e.target.value))}
                      className="w-20 rounded border border-border bg-background px-2 py-1 text-xs"
                    />
                  ) : (
                    <span className="flex items-center gap-1 text-accent">
                      <Coins className="h-3 w-3" />
                      {u.credits ?? 0}
                    </span>
                  )}
                </td>
                <td className="p-3 text-xs text-muted-foreground">
                  {new Date(u.created_at).toLocaleDateString("mn-MN")}
                </td>
                <td className="p-3 text-right">
                  {editing === u.id ? (
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => save(u.id)}
                        disabled={pending}
                        className="rounded p-1.5 text-emerald-500 hover:bg-emerald-500/10"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setEditing(null)}
                        className="rounded p-1.5 text-muted-foreground hover:bg-secondary"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEdit(u)}
                      className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="p-8 text-center text-sm text-muted-foreground"
                >
                  Хэрэглэгч олдсонгүй
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
