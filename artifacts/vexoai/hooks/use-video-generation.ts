"use client"

import { useCallback, useRef, useState } from "react"
import {
  avatarStatus,
  generateAvatarVideo,
  generateTts,
  generateVideo,
  pollUntilDone,
  saveVideo,
  stitchVideo,
  videoStatus,
} from "@/lib/create-api-client"
import { sceneHasNarration, willStitch } from "@/lib/blueprint-costs"
import type { SceneStatus, VideoBlueprint } from "@/lib/blueprint"

export type GenPhase = "idle" | "running" | "done" | "error"

export interface SceneProgress {
  id: string
  status: SceneStatus
  progress: number
  videoUrl?: string
  error?: string
}

interface SceneOutput {
  videoUrl: string
  // null = audio already baked into the clip (a_roll) or silent b_roll.
  audioUrl: string | null
}

// Identity of a run — if the editable content changes between runs we throw away
// cached scene outputs; if it's identical (a retry) we keep them so already-paid
// scenes are never regenerated/recharged.
function runKeyOf(bp: VideoBlueprint): string {
  return JSON.stringify({
    id: bp.id,
    model: bp.model,
    orientation: bp.orientation,
    avatar: bp.avatar.imageUrl ?? null,
    voice: bp.voice,
    scenes: bp.scenes.map((s) => ({
      id: s.id,
      type: s.type,
      script: s.script.trim(),
      visual: s.visualPrompt.trim(),
      dur: s.durationSec,
    })),
  })
}

/**
 * Runs the approved blueprint through the (existing, server-charged) pipeline:
 *   a_roll -> tts -> avatar-video -> poll          (audio baked in by Kling)
 *   b_roll -> [tts] + generate-video -> poll       (silent footage + optional VO)
 *   then -> stitch (lipSync:false) -> save-video
 *
 * Resumable: successful scene outputs and the stitched final are cached per run
 * key, so "Retry" after a partial failure only redoes the failed/unstarted work
 * — it never recharges scenes that already succeeded.
 */
export function useVideoGeneration(opts: { locale: "mn" | "en" }) {
  const { locale } = opts
  const [phase, setPhase] = useState<GenPhase>("idle")
  const [scenes, setScenes] = useState<SceneProgress[]>([])
  const [finalUrl, setFinalUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Snapshot of the blueprint a run was started with, so the timeline/result
  // keep rendering the generated plan even if the user edits the live one.
  const [activeBlueprint, setActiveBlueprint] = useState<VideoBlueprint | null>(null)

  const cancelRef = useRef(false)
  const producedRef = useRef<Map<string, SceneOutput>>(new Map())
  const finalRef = useRef<{ key: string; url: string } | null>(null)
  const runKeyRef = useRef<string>("")

  const t = useCallback((mn: string, en: string) => (locale === "mn" ? mn : en), [locale])

  const patch = useCallback((id: string, p: Partial<SceneProgress>) => {
    setScenes((prev) => prev.map((s) => (s.id === id ? { ...s, ...p } : s)))
  }, [])

  const run = useCallback(
    async (bp: VideoBlueprint) => {
      const key = runKeyOf(bp)
      if (key !== runKeyRef.current) {
        // Plan changed since the last run -> discard cached outputs.
        producedRef.current = new Map()
        finalRef.current = null
        runKeyRef.current = key
      }
      setActiveBlueprint(bp)
      cancelRef.current = false
      setPhase("running")
      setError(null)
      setFinalUrl(null)
      setScenes(
        bp.scenes.map((s) => {
          const cached = producedRef.current.get(s.id)
          return cached
            ? { id: s.id, status: "done" as const, progress: 100, videoUrl: cached.videoUrl }
            : { id: s.id, status: "idle" as const, progress: 0 }
        }),
      )

      const produced: SceneOutput[] = []

      const fail = (id: string, msg: string) => {
        patch(id, { status: "failed", error: msg })
        setError(msg)
        setPhase("error")
      }

      for (const scene of bp.scenes) {
        if (cancelRef.current) return

        // Reuse already-paid output on retry.
        const cached = producedRef.current.get(scene.id)
        if (cached) {
          produced.push(cached)
          continue
        }

        try {
          if (scene.type === "a_roll") {
            if (!bp.avatar.imageUrl) throw new Error(t("Аватар зураг оруулаагүй байна", "No avatar image set"))
            if (!sceneHasNarration(scene)) throw new Error(t("Яриа хоосон байна", "Script is empty"))

            patch(scene.id, { status: "tts", progress: 8 })
            const tts = await generateTts(scene.script, bp.voice.voiceId, bp.voice.lang)
            if (!tts.ok) throw new Error(tts.error)
            if (cancelRef.current) return

            patch(scene.id, { status: "video", progress: 30 })
            const av = await generateAvatarVideo({
              imageUrl: bp.avatar.imageUrl,
              audioUrl: tts.data.audioUrl,
              prompt: scene.visualPrompt || undefined,
            })
            if (!av.ok) throw new Error(av.error)
            if (cancelRef.current) return

            patch(scene.id, { status: "polling", progress: 45 })
            const done = await pollUntilDone(() => avatarStatus(av.data.requestId), {
              onProgress: (p) => patch(scene.id, { progress: Math.min(95, Math.max(45, p)) }),
            })
            if (!done.ok) throw new Error(done.error)

            const out: SceneOutput = { videoUrl: done.videoUrl, audioUrl: null }
            producedRef.current.set(scene.id, out)
            patch(scene.id, { status: "done", progress: 100, videoUrl: done.videoUrl })
            produced.push(out)
          } else {
            // b_roll — needs at least a visual prompt or a script to drive it.
            const prompt = scene.visualPrompt.trim() || scene.script.trim()
            if (!prompt) throw new Error(t("Дүрслэл хоосон байна", "Visual prompt is empty"))

            let audioUrl: string | null = null
            if (sceneHasNarration(scene)) {
              patch(scene.id, { status: "tts", progress: 8 })
              const tts = await generateTts(scene.script, bp.voice.voiceId, bp.voice.lang)
              if (!tts.ok) throw new Error(tts.error)
              audioUrl = tts.data.audioUrl
            }
            if (cancelRef.current) return

            patch(scene.id, { status: "video", progress: 30 })
            const gv = await generateVideo({
              mode: "text",
              prompt,
              duration: scene.durationSec,
              aspectRatio: bp.orientation,
              model: bp.model,
              generateAudio: false,
            })
            if (!gv.ok) throw new Error(gv.error)
            if (cancelRef.current) return

            patch(scene.id, { status: "polling", progress: 45 })
            const done = await pollUntilDone(() => videoStatus(gv.data.requestId, bp.model, "text"), {
              onProgress: (p) => patch(scene.id, { progress: Math.min(95, Math.max(45, p)) }),
            })
            if (!done.ok) throw new Error(done.error)

            const out: SceneOutput = { videoUrl: done.videoUrl, audioUrl }
            producedRef.current.set(scene.id, out)
            patch(scene.id, { status: "done", progress: 100, videoUrl: done.videoUrl })
            produced.push(out)
          }
        } catch (e) {
          fail(scene.id, e instanceof Error ? e.message : t("Алдаа гарлаа", "Something went wrong"))
          return
        }
      }

      if (cancelRef.current) return
      if (produced.length === 0) {
        setError(t("Видео үүсээгүй", "No video produced"))
        setPhase("error")
        return
      }

      let final: string
      if (finalRef.current?.key === key) {
        // Stitching already succeeded for this exact plan — don't recharge it.
        final = finalRef.current.url
      } else if (willStitch(bp)) {
        const stitch = await stitchVideo({
          videoUrls: produced.map((p) => p.videoUrl),
          aspectRatio: bp.orientation,
          audioUrls: produced.map((p) => p.audioUrl),
          lipSync: false,
        })
        if (!stitch.ok) {
          setError(stitch.error)
          setPhase("error")
          return
        }
        final = stitch.data.videoUrl
        finalRef.current = { key, url: final }
      } else {
        final = produced[0].videoUrl
        finalRef.current = { key, url: final }
      }

      // Persist to history (best-effort — a save failure shouldn't lose the video).
      try {
        await saveVideo({
          videoUrl: final,
          prompt: bp.title,
          voice: bp.voice.voiceId,
          seriesCount: bp.scenes.length,
          sceneIndex: 0,
        })
      } catch {
        // ignore
      }

      setFinalUrl(final)
      setPhase("done")
    },
    [patch, t],
  )

  const cancel = useCallback(() => {
    cancelRef.current = true
    setPhase("idle")
  }, [])

  const reset = useCallback(() => {
    cancelRef.current = true
    producedRef.current = new Map()
    finalRef.current = null
    runKeyRef.current = ""
    setActiveBlueprint(null)
    setPhase("idle")
    setScenes([])
    setFinalUrl(null)
    setError(null)
  }, [])

  return { phase, scenes, finalUrl, error, activeBlueprint, run, cancel, reset }
}
