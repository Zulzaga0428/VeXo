"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Send, Loader2, Sparkles, CheckCircle2 } from "lucide-react"

type ChatMessage = {
  role: "user" | "assistant"
  content: string
}

interface AiChatPromptProps {
  locale: "mn" | "en"
  sceneIndex: number
  previousPrompts: string[]
  disabled?: boolean
  onPromptReady: (prompt: string) => void
}

export function AiChatPrompt({
  locale,
  sceneIndex,
  previousPrompts,
  disabled,
  onPromptReady,
}: AiChatPromptProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        locale === "mn"
          ? sceneIndex === 0
            ? "Сайн уу! Юуны тухай реклам хиймээр байна? Бүтээгдэхүүн, брэнд, эсвэл санааг нь товч хэлээрэй."
            : `Сайн байна уу! Scene ${sceneIndex + 1}-ийн санаагаа хэлээрэй. Өмнөх scene-тэй уялдуулж бэлдье.`
          : sceneIndex === 0
            ? "Hi! What kind of ad would you like to create? Tell me about the product, brand, or idea."
            : `Hello! Tell me your idea for Scene ${sceneIndex + 1}. I'll keep it consistent with the previous scenes.`,
    },
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [readyPrompt, setReadyPrompt] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading])

  const send = async () => {
    if (!input.trim() || loading || disabled) return
    const userMsg: ChatMessage = { role: "user", content: input.trim() }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput("")
    setLoading(true)

    try {
      const res = await fetch("/api/chat-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next,
          locale,
          sceneIndex,
          previousPrompts,
        }),
      })
      const data = await res.json()

      // Daily free-chat limit reached, or not signed in.
      if (!res.ok) {
        let notice: string
        if (res.status === 429) {
          notice =
            data.message ||
            (locale === "mn"
              ? "Өдрийн чатын хязгаарт хүрлээ. Маргааш дахин оролдоно уу."
              : "You've reached the daily chat limit. Please try again tomorrow.")
        } else if (res.status === 401) {
          notice =
            locale === "mn"
              ? "Чат ашиглахын тулд нэвтэрнэ үү."
              : "Please sign in to use the chat."
        } else {
          notice =
            locale === "mn"
              ? "Уучлаарай, алдаа гарлаа. Дахин оролдоно уу."
              : "Sorry, something went wrong. Please try again."
        }
        setMessages([...next, { role: "assistant", content: notice }])
        return
      }

      if (data.reply) {
        // Strip the "PROMPT: ..." block from visible reply
        const visible = data.finalPrompt
          ? data.reply.replace(/PROMPT:\s*[\s\S]+$/i, "").trim() ||
            (locale === "mn"
              ? "Бэлэн боллоо! Доорх товчоор баталгаажуулна уу."
              : "Ready! Confirm with the button below.")
          : data.reply
        setMessages([...next, { role: "assistant", content: visible }])
        if (data.finalPrompt) {
          setReadyPrompt(data.finalPrompt)
        }
      }
    } catch (e) {
      console.error("[v0] chat error", e)
      setMessages([
        ...next,
        {
          role: "assistant",
          content:
            locale === "mn"
              ? "Уучлаарай, алдаа гарлаа. Дахин оролдоно уу."
              : "Sorry, something went wrong. Please try again.",
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const useThisPrompt = () => {
    if (readyPrompt) {
      onPromptReady(readyPrompt)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-[140px] max-h-[220px] overflow-y-auto rounded-lg border border-border bg-background/50 p-2 space-y-2"
      >
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-[11px] sm:text-xs leading-relaxed ${
                m.role === "user"
                  ? "bg-accent text-accent-foreground"
                  : "bg-secondary text-foreground"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-lg bg-secondary px-2.5 py-1.5 text-xs">
              <Loader2 className="h-3 w-3 animate-spin" />
            </div>
          </div>
        )}
      </div>

      {/* Ready prompt confirmation */}
      {readyPrompt && (
        <div className="mt-2 rounded-lg border border-accent/40 bg-accent/10 p-2">
          <div className="flex items-center gap-1.5 text-[10px] font-medium text-accent mb-1">
            <Sparkles className="h-3 w-3" />
            {locale === "mn" ? "Бэлэн prompt" : "Ready prompt"}
          </div>
          <p className="text-[11px] text-foreground/80 line-clamp-3 mb-2">
            {readyPrompt}
          </p>
          <Button
            size="sm"
            className="w-full h-7 text-[11px] bg-accent text-accent-foreground hover:bg-accent/90"
            onClick={useThisPrompt}
            disabled={disabled}
          >
            <CheckCircle2 className="mr-1 h-3 w-3" />
            {locale === "mn" ? "Энэ prompt-г ашиглах" : "Use this prompt"}
          </Button>
        </div>
      )}

      {/* Input */}
      <div className="mt-2 flex gap-1.5">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          disabled={loading || disabled}
          placeholder={
            locale === "mn" ? "Агентад хэлэх..." : "Tell the agent..."
          }
          className="flex-1 rounded-lg border border-border bg-background/50 px-2.5 py-1.5 text-[11px] sm:text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
        />
        <Button
          size="sm"
          onClick={send}
          disabled={!input.trim() || loading || disabled}
          className="h-8 w-8 p-0 bg-accent text-accent-foreground hover:bg-accent/90"
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Send className="h-3 w-3" />
          )}
        </Button>
      </div>
    </div>
  )
}
