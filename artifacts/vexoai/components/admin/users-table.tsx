"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Search, Coins, Pencil, Check, X, Gift } from "lucide-react"

type Profile = {
  id: string
  email: string | null
  full_name: string | null
  phone: string | null
  plan: string | null
  credits: number | null
  created_at: string
}

const GIFT_PRESETS = [50, 100, 500, 1000]

export function UsersTable({ users }: { users: Profile[] }) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [editing, setEditing] = useState<string | null>(null)
  const [editPlan, setEditPlan] = useState("")
  const [editCredits, setEditCredits] = useState(0)
  const [gifting, setGifting] = useState<string | null>(null)
  const [giftAmount, setGiftAmount] = useState(100)
  const [giftMsg, setGiftMsg] = useState<Record<string, string>>({})
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
    setGifting(null)
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

  const sendGift = (userId: string) => {
    startTransition(async () => {
      const res = await fetch("/api/admin/gift-credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, amount: giftAmount }),
      })
      const data = await res.json()
      if (res.ok) {
        setGiftMsg((m) => ({ ...m, [userId]: `+${giftAmount} ✓ (нийт: ${data.newCredits})` }))
        setTimeout(() => {
          setGiftMsg((m) => { const n = { ...m }; delete n[userId]; return n })
          setGifting(null)
          router.refresh()
        }, 2000)
      } else {
        setGiftMsg((m) => ({ ...m, [userId]: `Алдаа: ${data.error}` }))
      }
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
              <>
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
                      <div className="flex justify-end gap-1">
                        {/* Gift credits button */}
                        <button
                          onClick={() => { setGifting(gifting === u.id ? null : u.id); setEditing(null); setGiftAmount(100) }}
                          title="Credits бэлэглэх"
                          className={`rounded p-1.5 transition-colors ${gifting === u.id ? "text-amber-500 bg-amber-500/10" : "text-muted-foreground hover:bg-secondary hover:text-amber-500"}`}
                        >
                          <Gift className="h-4 w-4" />
                        </button>
                        {/* Edit button */}
                        <button
                          onClick={() => startEdit(u)}
                          className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>

                {/* Gift panel — expands inline below the row */}
                {gifting === u.id && (
                  <tr key={`gift-${u.id}`} className="bg-amber-500/5 border-amber-500/20">
                    <td colSpan={6} className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Gift className="h-4 w-4 text-amber-500 shrink-0" />
                        <span className="text-xs font-medium text-amber-600 dark:text-amber-400 shrink-0">
                          {u.email} — credits нэмэх:
                        </span>
                        {/* Quick presets */}
                        {GIFT_PRESETS.map((n) => (
                          <button
                            key={n}
                            onClick={() => setGiftAmount(n)}
                            className={`rounded px-2 py-0.5 text-xs font-semibold transition-colors ${giftAmount === n ? "bg-amber-500 text-white" : "border border-border hover:border-amber-500 hover:text-amber-500"}`}
                          >
                            +{n}
                          </button>
                        ))}
                        {/* Custom amount */}
                        <input
                          type="number"
                          value={giftAmount}
                          min={1}
                          max={99999}
                          onChange={(e) => setGiftAmount(Math.max(1, Number(e.target.value)))}
                          className="w-20 rounded border border-border bg-background px-2 py-0.5 text-xs focus:border-amber-500 focus:outline-none"
                        />
                        {giftMsg[u.id] ? (
                          <span className="text-xs font-semibold text-emerald-500">{giftMsg[u.id]}</span>
                        ) : (
                          <>
                            <button
                              onClick={() => sendGift(u.id)}
                              disabled={pending}
                              className="rounded bg-amber-500 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                            >
                              Бэлэглэх
                            </button>
                            <button
                              onClick={() => setGifting(null)}
                              className="text-xs text-muted-foreground hover:text-foreground"
                            >
                              Цуцлах
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">
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
