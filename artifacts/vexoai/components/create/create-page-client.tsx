"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Menu, Sparkles, X } from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { useBlueprintChat } from "@/hooks/use-blueprint-chat"
import { useVideoGeneration } from "@/hooks/use-video-generation"
import type { VideoBlueprint } from "@/lib/blueprint"
import { ChatPanel } from "@/components/create/chat-panel"
import { ArtifactsPanel, type CreateView } from "@/components/create/artifacts-panel"
import { BlueprintEditor } from "@/components/create/blueprint-editor"
import { GenerationTimeline } from "@/components/create/generation-timeline"
import { VideoResult } from "@/components/create/video-result"

export function CreatePageClient() {
  const searchParams = useSearchParams()
  const [blueprint, setBlueprint] = useState<VideoBlueprint | null>(null)
  const [view, setView] = useState<CreateView>("plan")
  const [navOpen, setNavOpen] = useState(false)

  // Keep a ref so the chat hook always reads the latest plan in its closures.
  const blueprintRef = useRef<VideoBlueprint | null>(null)
  useEffect(() => {
    blueprintRef.current = blueprint
  }, [blueprint])

  const locale: "mn" | "en" = blueprint?.voice.lang === "en" ? "en" : "mn"
  const t = (mn: string, en: string) => (locale === "mn" ? mn : en)

  const getBlueprint = useCallback(() => blueprintRef.current, [])
  const onBlueprint = useCallback((bp: VideoBlueprint) => {
    setBlueprint(bp)
    setView("plan")
  }, [])

  // Skip run recovery when arriving with a fresh idea from the dashboard — that's
  // an explicit new creation, not a return to an in-progress run.
  const ideaParam = searchParams.get("idea")
  const recover = !(ideaParam && ideaParam.trim())

  const chat = useBlueprintChat({ locale, getBlueprint, onBlueprint })
  const gen = useVideoGeneration({ locale, recover })

  // When a run is recovered after a refresh, restore the editable plan so the
  // editor/artifacts panels are coherent and Resume can re-run the snapshot.
  useEffect(() => {
    if (!blueprint && gen.activeBlueprint) setBlueprint(gen.activeBlueprint)
  }, [blueprint, gen.activeBlueprint])

  // Move to the generation view as soon as a run starts/finishes.
  useEffect(() => {
    if (gen.phase !== "idle") setView("generation")
  }, [gen.phase])

  const handleGenerate = useCallback(() => {
    // Prefer the live plan; fall back to the recovered snapshot when resuming.
    const bp = blueprint ?? gen.activeBlueprint
    if (bp) gen.run(bp)
  }, [blueprint, gen])

  // While a run is in flight the chat is frozen so a revision can't swap the
  // plan out from under the in-progress generation.
  const chatDisabled = gen.phase === "running"
  const handleSubmit = useCallback(
    (text: string) => {
      if (gen.phase === "running") return
      chat.submit(text)
    },
    [gen.phase, chat],
  )
  const handleAnswerClarify = useCallback(
    (answer: string) => {
      if (gen.phase === "running") return
      chat.answerClarify(answer)
    },
    [gen.phase, chat],
  )

  // The timeline/result must follow the snapshot the run started with, not the
  // live (possibly-edited) plan.
  const genBlueprint = gen.activeBlueprint ?? blueprint

  const handleNewVideo = useCallback(() => {
    gen.reset()
    chat.reset()
    setBlueprint(null)
    setView("plan")
  }, [gen, chat])

  // Auto-start from a dashboard idea (?idea=...), once.
  const startedRef = useRef(false)
  useEffect(() => {
    if (startedRef.current) return
    const idea = searchParams.get("idea")
    if (idea && idea.trim()) {
      startedRef.current = true
      chat.submit(idea)
    }
  }, [searchParams, chat])

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <AppSidebar locale={locale} overlay open={navOpen} onOpenChange={setNavOpen} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3">
          <button
            onClick={() => setNavOpen((v) => !v)}
            aria-label={navOpen ? t("Цэс хаах", "Close menu") : t("Цэс нээх", "Open menu")}
            className="relative z-[60] flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            {navOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-accent" />
            <span className="text-sm font-semibold">{t("Видео үүсгэх", "Create Video")}</span>
          </div>
        </header>

        {/* 3-panel workspace */}
        <div className="flex min-h-0 flex-1">
          {/* Chat */}
          <div className="w-[320px] shrink-0 border-r border-border max-lg:w-[280px] max-md:hidden">
            <ChatPanel
              locale={locale}
              messages={chat.messages}
              thinking={chat.thinking}
              hasBlueprint={!!blueprint}
              onSubmit={handleSubmit}
              onAnswerClarify={handleAnswerClarify}
              disabled={chatDisabled}
            />
          </div>

          {/* Artifacts */}
          <div className="w-[240px] shrink-0 border-r border-border max-xl:w-[200px] max-lg:hidden">
            <ArtifactsPanel
              locale={locale}
              blueprint={blueprint}
              phase={gen.phase}
              finalUrl={gen.finalUrl}
              view={view}
              onSelectView={setView}
            />
          </div>

          {/* Preview / editor */}
          <div className="min-w-0 flex-1 overflow-hidden">
            {view === "generation" && genBlueprint ? (
              gen.phase === "done" && gen.finalUrl ? (
                <VideoResult
                  locale={locale}
                  blueprint={genBlueprint}
                  finalUrl={gen.finalUrl}
                  scenes={gen.scenes}
                  onNewVideo={handleNewVideo}
                  onBackToPlan={() => setView("plan")}
                />
              ) : (
                <GenerationTimeline
                  locale={locale}
                  blueprint={genBlueprint}
                  scenes={gen.scenes}
                  phase={gen.phase}
                  error={gen.error}
                  onRetry={handleGenerate}
                  onBackToPlan={() => setView("plan")}
                />
              )
            ) : blueprint ? (
              <BlueprintEditor
                locale={locale}
                blueprint={blueprint}
                generating={gen.phase === "running"}
                onChange={setBlueprint}
                onGenerate={handleGenerate}
              />
            ) : (
              <EmptyState locale={locale} />
            )}
          </div>
        </div>

        {/* Mobile chat (below md) */}
        <div className="hidden h-[45vh] border-t border-border max-md:block">
          <ChatPanel
            locale={locale}
            messages={chat.messages}
            thinking={chat.thinking}
            hasBlueprint={!!blueprint}
            onSubmit={handleSubmit}
            onAnswerClarify={handleAnswerClarify}
            disabled={chatDisabled}
          />
        </div>
      </div>
    </div>
  )
}

function EmptyState({ locale }: { locale: "mn" | "en" }) {
  const t = (mn: string, en: string) => (locale === "mn" ? mn : en)
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-accent/10 ring-1 ring-accent/20">
        <Sparkles className="h-8 w-8 text-accent" />
      </div>
      <div className="max-w-sm space-y-1.5">
        <h2 className="text-lg font-semibold">{t("Видео төлөвлөгөөгөө эхлүүлээрэй", "Start your video plan")}</h2>
        <p className="text-sm text-muted-foreground">
          {t(
            "Зүүн талын чатад санаагаа бичихэд би засаж болох видео төлөвлөгөө гаргаж өгнө. Дараа нь зөвшөөрөөд үүсгэнэ.",
            "Describe your idea in the chat and I'll draft an editable video plan. Approve it, then generate.",
          )}
        </p>
      </div>
    </div>
  )
}
