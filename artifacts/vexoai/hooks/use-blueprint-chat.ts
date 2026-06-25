"use client"

import { useCallback, useState } from "react"
import { streamBlueprint } from "@/lib/create-api-client"
import { normalizeBlueprint, type VideoBlueprint } from "@/lib/blueprint"

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  text: string
  // Marks the assistant message that announced a (re)built plan.
  isPlan?: boolean
}

function mid(): string {
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

/**
 * Drives the chat side of the Create flow:
 *   idea -> agent thinks -> blueprint (no clarification chips)
 *   later messages -> revise the existing blueprint
 * The blueprint itself is owned by the page; this hook reads it via getBlueprint
 * and hands new versions back through onBlueprint.
 */
export function useBlueprintChat(opts: {
  locale: "mn" | "en"
  getBlueprint: () => VideoBlueprint | null
  onBlueprint: (bp: VideoBlueprint) => void
}) {
  const { locale, getBlueprint, onBlueprint } = opts
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [thinking, setThinking] = useState(false)
  const [statusSteps, setStatusSteps] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const push = useCallback((m: Omit<ChatMessage, "id">) => {
    setMessages((prev) => [...prev, { ...m, id: mid() }])
  }, [])

  const buildPlan = useCallback(
    async (idea: string) => {
      setThinking(true)
      setStatusSteps([])
      setError(null)
      const current = getBlueprint() ?? undefined

      await streamBlueprint(
        { idea, locale, model: current?.model ?? "standard", currentBlueprint: current },
        {
          onStatus: (msg) => setStatusSteps((prev) => [...prev, msg]),
          onDone: (data) => {
            const bp = normalizeBlueprint(data.blueprint, {
              fallbackLanguage: locale,
              fallbackModel: current?.model ?? "standard",
              voice: current?.voice,
              avatar: current?.avatar,
              keepId: current?.id,
              version: current ? current.version + 1 : 1,
            })
            onBlueprint(bp)
            push({ role: "assistant", text: data.reply, isPlan: true })
          },
          onError: (message, statusCode) => {
            const msg =
              statusCode === 429
                ? locale === "mn"
                  ? "Өдрийн чатын хязгаарт хүрлээ. Маргааш дахин оролдоно уу."
                  : "Daily chat limit reached. Try again tomorrow."
                : message
            setError(msg)
            push({ role: "assistant", text: msg })
          },
        },
      )

      setThinking(false)
    },
    [locale, getBlueprint, onBlueprint, push],
  )

  const submit = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || thinking) return
      push({ role: "user", text: trimmed })
      // Agent decides everything — orientation, style, voice — no clarification step.
      await buildPlan(trimmed)
    },
    [thinking, buildPlan, push],
  )

  const reset = useCallback(() => {
    setMessages([])
    setError(null)
    setThinking(false)
    setStatusSteps([])
  }, [])

  return { messages, thinking, statusSteps, error, submit, reset }

}
