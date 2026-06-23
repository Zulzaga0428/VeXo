"use client"

import { useCallback, useRef, useState } from "react"
import { clarifyIdea, requestBlueprint, type ClarifyQuestion } from "@/lib/create-api-client"
import { normalizeBlueprint, type VideoBlueprint } from "@/lib/blueprint"

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  text: string
  // When present the message offers tappable clarification chips.
  clarify?: ClarifyQuestion[]
  // Marks the assistant message that announced a (re)built plan.
  isPlan?: boolean
}

function mid(): string {
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

/**
 * Drives the chat side of the Create flow:
 *   first idea -> optional clarify -> blueprint
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
  const [error, setError] = useState<string | null>(null)
  const pendingIdeaRef = useRef<string | null>(null)

  const push = useCallback((m: Omit<ChatMessage, "id">) => {
    setMessages((prev) => [...prev, { ...m, id: mid() }])
  }, [])

  const buildPlan = useCallback(
    async (idea: string) => {
      setThinking(true)
      setError(null)
      const current = getBlueprint() ?? undefined
      const res = await requestBlueprint({
        idea,
        locale,
        model: current?.model ?? "standard",
        currentBlueprint: current,
      })
      setThinking(false)
      if (!res.ok) {
        const msg =
          res.status === 429
            ? locale === "mn"
              ? "Өдрийн чатын хязгаарт хүрлээ. Маргааш дахин оролдоно уу."
              : "Daily chat limit reached. Try again tomorrow."
            : res.error
        setError(msg)
        push({ role: "assistant", text: msg })
        return
      }
      const bp = normalizeBlueprint(res.data.blueprint, {
        fallbackLanguage: locale,
        fallbackModel: current?.model ?? "standard",
        voice: current?.voice,
        avatar: current?.avatar,
        keepId: current?.id,
        version: current ? current.version + 1 : 1,
      })
      onBlueprint(bp)
      push({ role: "assistant", text: res.data.reply, isPlan: true })
    },
    [locale, getBlueprint, onBlueprint, push],
  )

  const submit = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || thinking) return
      push({ role: "user", text: trimmed })

      // Folding in an answer to a previously-asked clarification question.
      if (pendingIdeaRef.current) {
        const combined = `${pendingIdeaRef.current}\n\n${trimmed}`
        pendingIdeaRef.current = null
        await buildPlan(combined)
        return
      }

      // Revising an existing plan -> straight to the agent.
      if (getBlueprint()) {
        await buildPlan(trimmed)
        return
      }

      // Brand-new idea: try a single, non-blocking clarification pass.
      setThinking(true)
      const clar = await clarifyIdea(trimmed, locale)
      setThinking(false)
      if (clar.ok && clar.data.needsClarification && clar.data.questions.length > 0) {
        pendingIdeaRef.current = trimmed
        const qtext = clar.data.questions.map((q) => q.question).join("\n")
        push({ role: "assistant", text: qtext, clarify: clar.data.questions })
        return
      }
      await buildPlan(trimmed)
    },
    [thinking, getBlueprint, buildPlan, locale, push],
  )

  const answerClarify = useCallback(
    async (answer: string) => {
      if (thinking) return
      push({ role: "user", text: answer })
      if (pendingIdeaRef.current) {
        const combined = `${pendingIdeaRef.current}\n\n${answer}`
        pendingIdeaRef.current = null
        await buildPlan(combined)
      } else {
        await buildPlan(answer)
      }
    },
    [thinking, buildPlan, push],
  )

  const reset = useCallback(() => {
    pendingIdeaRef.current = null
    setMessages([])
    setError(null)
    setThinking(false)
  }, [])

  return { messages, thinking, error, submit, answerClarify, reset }
}
