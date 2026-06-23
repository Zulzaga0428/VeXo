"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowUp, Loader2, Plus, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ChatMessage } from "@/hooks/use-blueprint-chat"

interface ChatPanelProps {
  locale: "mn" | "en"
  messages: ChatMessage[]
  thinking: boolean
  hasBlueprint: boolean
  disabled?: boolean
  onSubmit: (text: string) => void
  onAnswerClarify: (answer: string) => void
  onNewVideo?: () => void
}

export function ChatPanel({
  locale,
  messages,
  thinking,
  hasBlueprint,
  disabled = false,
  onSubmit,
  onAnswerClarify,
  onNewVideo,
}: ChatPanelProps) {
  const t = (mn: string, en: string) => (locale === "mn" ? mn : en)
  const [input, setInput] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages, thinking])

  const send = () => {
    const v = input.trim()
    if (!v || thinking || disabled) return
    onSubmit(v)
    setInput("")
  }

  const suggestions =
    locale === "mn"
      ? [
          "Кофе шопын богино реклам хийе",
          "Шинэ апп танилцуулах видео",
          "Өөрийгөө танилцуулсан мессеж",
        ]
      : ["A short coffee shop ad", "An app launch teaser", "A personal intro message"]

  return (
    <div className="flex h-full flex-col bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="text-sm font-medium">{t("Найруулагч", "Director")}</span>
        {onNewVideo && (
          <button
            onClick={onNewVideo}
            className="ml-auto flex items-center gap-1 rounded-lg border border-accent/30 bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent transition hover:bg-accent/20"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("Шинэ бичлэг", "Create New")}
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 ring-1 ring-accent/20">
              <Sparkles className="h-6 w-6 text-accent" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">{t("Юу хийх вэ?", "What should we make?")}</p>
              <p className="text-xs text-muted-foreground">
                {t(
                  "Санаагаа бичээрэй — би видео төлөвлөгөө гаргаж өгье.",
                  "Describe your idea — I'll draft a video plan.",
                )}
              </p>
            </div>
            <div className="flex w-full flex-col gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => onSubmit(s)}
                  disabled={disabled}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-left text-xs text-muted-foreground transition hover:border-accent/50 hover:bg-accent/5 hover:text-foreground disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={cn("flex flex-col gap-2", m.role === "user" ? "items-end" : "items-start")}>
            <div
              className={cn(
                "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm",
                m.role === "user"
                  ? "bg-accent text-accent-foreground"
                  : "bg-muted text-foreground",
              )}
            >
              {m.text}
            </div>
            {m.clarify && m.clarify.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {m.clarify.flatMap((q) =>
                  q.options.map((opt) => (
                    <button
                      key={`${q.question}-${opt}`}
                      onClick={() => onAnswerClarify(opt)}
                      disabled={thinking || disabled}
                      className="rounded-full border border-border bg-background px-3 py-1 text-xs transition hover:border-accent/50 hover:text-accent disabled:opacity-50"
                    >
                      {opt}
                    </button>
                  )),
                )}
              </div>
            )}
          </div>
        ))}

        {thinking && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {t("Бодож байна…", "Thinking…")}
          </div>
        )}
      </div>

      <div className="border-t border-border p-3">
        <div className="flex items-end gap-2 rounded-xl border border-border bg-background p-2 transition-colors focus-within:border-accent/50">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            rows={1}
            disabled={disabled}
            placeholder={
              disabled
                ? t("Видео үүсгэж байна…", "Generating video…")
                : hasBlueprint
                  ? t("Төлөвлөгөөг засах хүсэлт…", "Ask to change the plan…")
                  : t("Видеоныхоо санааг бичээрэй…", "Describe your video idea…")
            }
            className="max-h-32 flex-1 resize-none bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-60"
          />
          <button
            onClick={send}
            disabled={!input.trim() || thinking || disabled}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground transition hover:opacity-90 disabled:opacity-40"
          >
            {thinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  )
}
