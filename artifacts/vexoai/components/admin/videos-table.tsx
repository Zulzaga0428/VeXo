"use client"

import { useState } from "react"
import { Search, ExternalLink, Play } from "lucide-react"

type VideoRow = {
  id: string
  user_id: string
  user_email: string | null
  user_name: string | null
  prompt: string | null
  status: string
  video_url: string | null
  image_url: string | null
  voice: string | null
  scene_index: number | null
  series_count: number | null
  created_at: string
}

export function VideosTable({ videos }: { videos: VideoRow[] }) {
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [preview, setPreview] = useState<VideoRow | null>(null)

  const filtered = videos.filter((v) => {
    if (statusFilter !== "all" && v.status !== statusFilter) return false
    if (!query) return true
    const q = query.toLowerCase()
    return (
      (v.prompt ?? "").toLowerCase().includes(q) ||
      (v.user_email ?? "").toLowerCase().includes(q) ||
      (v.user_name ?? "").toLowerCase().includes(q)
    )
  })

  const statusBadge = (s: string) => {
    if (s === "completed") return "bg-emerald-500/10 text-emerald-500"
    if (s === "failed") return "bg-destructive/10 text-destructive"
    return "bg-amber-500/10 text-amber-500"
  }

  return (
    <>
      <div className="rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Prompt, email, нэрээр хайх..."
              className="w-full rounded-lg border border-border bg-background pl-10 pr-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="all">Бүх статус</option>
            <option value="completed">Дууссан</option>
            <option value="processing">Боловсруулж буй</option>
            <option value="failed">Алдаатай</option>
            <option value="idle">Хүлээгдэж буй</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-xs text-muted-foreground">
              <tr>
                <th className="p-3 text-left font-medium">Хэрэглэгч</th>
                <th className="p-3 text-left font-medium">Prompt</th>
                <th className="p-3 text-left font-medium">Статус</th>
                <th className="p-3 text-left font-medium">Дуу</th>
                <th className="p-3 text-left font-medium">Огноо</th>
                <th className="p-3 text-right font-medium">Үйлдэл</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((v) => (
                <tr key={v.id} className="hover:bg-secondary/30">
                  <td className="p-3">
                    <p className="font-medium text-xs">
                      {v.user_name || "—"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {v.user_email || v.user_id.slice(0, 8)}
                    </p>
                  </td>
                  <td className="max-w-[300px] p-3">
                    <p className="line-clamp-2 text-xs">
                      {v.prompt || "(prompt алга)"}
                    </p>
                  </td>
                  <td className="p-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] ${statusBadge(v.status)}`}
                    >
                      {v.status}
                    </span>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {v.voice || "—"}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {new Date(v.created_at).toLocaleDateString("mn-MN")}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-1">
                      {v.video_url && (
                        <button
                          onClick={() => setPreview(v)}
                          className="rounded p-1.5 text-accent hover:bg-accent/10"
                          title="Үзэх"
                        >
                          <Play className="h-4 w-4" />
                        </button>
                      )}
                      {v.video_url && (
                        <a
                          href={v.video_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                          title="Шинэ цонхонд нээх"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="p-8 text-center text-sm text-muted-foreground"
                  >
                    Видео олдсонгүй
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Preview modal */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreview(null)}
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border p-3">
              <p className="line-clamp-1 text-sm font-medium">
                {preview.prompt || "Видео"}
              </p>
              <button
                onClick={() => setPreview(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>
            {preview.video_url && (
              <video
                src={preview.video_url}
                controls
                autoPlay
                className="aspect-video w-full bg-black"
              />
            )}
          </div>
        </div>
      )}
    </>
  )
}
