"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  avatarStatus,
  clearRun,
  generateAvatarVideo,
  generateTts,
  generateVideo,
  loadRun,
  pollUntilDone,
  saveRun,
  saveVideo,
  stitchVideo,
  videoStatus,
} from "@/lib/create-api-client"
import { sceneHasNarration, willStitch } from "@/lib/blueprint-costs"
import type { AvatarRef, BlueprintScene, SceneStatus, VideoBlueprint, VoiceRef } from "@/lib/blueprint"
import type { PersistedRun, PersistedScene, SceneJob } from "@/lib/create-run"

function getSceneCharacter(
  scene: BlueprintScene,
  bp: VideoBlueprint,
): { avatar: AvatarRef; voice: VoiceRef } {
  const idx = scene.characterIdx ?? 0
  if (idx > 0 && bp.characters && bp.characters[idx - 1]) {
    return bp.characters[idx - 1]
  }
  return { avatar: bp.avatar, voice: bp.voice }
}

// "paused" = a run was recovered from storage (refresh/closed tab) but not yet
// resumed; already-paid work is kept and only the rest needs generating.
export type GenPhase = "idle" | "running" | "paused" | "done" | "error"

export interface SceneProgress {
  id: string
  status: SceneStatus
  progress: number
  videoUrl?: string
  error?: string
}

// Identity of a run — if the editable content changes between runs we throw away
// cached scene work; if it's identical (a retry/resume) we keep it so already-paid
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

function emptyScene(id: string): PersistedScene {
  return { id, ttsAudioUrl: null, job: null, videoUrl: null }
}

/**
 * Runs the approved blueprint through the (existing, server-charged) pipeline:
 *   a_roll -> tts -> avatar-video -> poll          (audio baked in by Kling)
 *   b_roll -> [tts] + generate-video -> poll       (silent footage + optional VO)
 *   then -> stitch (lipSync:false) -> save-video
 *
 * Resumable across reloads: per-scene state (generated TTS audio, the accepted
 * job's requestId, and the finished clip) plus the stitched final are persisted
 * per run key. A refresh/closed tab can resume — already-rendered scenes are
 * skipped, an in-flight job is re-polled by its requestId (not re-submitted), and
 * only truly-unstarted work is generated. Nothing already paid for is recharged.
 */
export function useVideoGeneration(opts: { locale: "mn" | "en"; recover?: boolean }) {
  const { locale, recover = true } = opts
  const [phase, setPhase] = useState<GenPhase>("idle")
  const [scenes, setScenes] = useState<SceneProgress[]>([])
  const [finalUrl, setFinalUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Snapshot of the blueprint a run was started with, so the timeline/result
  // keep rendering the generated plan even if the user edits the live one.
  const [activeBlueprint, setActiveBlueprint] = useState<VideoBlueprint | null>(null)

  const cancelRef = useRef(false)
  // Per-scene state, keyed by scene id. The source of truth for resume.
  const sceneStateRef = useRef<Map<string, PersistedScene>>(new Map())
  const finalRef = useRef<{ key: string; url: string } | null>(null)
  const runKeyRef = useRef<string>("")

  // Serialized persistence: persist() is called many times in quick succession,
  // so rather than firing concurrent (and potentially out-of-order) writes we
  // keep only the latest pending snapshot and flush it with a single in-flight
  // request at a time. Combined with a strictly-monotonic updatedAt and the
  // server's compare-and-set guard, a stale write can never clobber newer state.
  const pendingRunRef = useRef<PersistedRun | null>(null)
  const writingRef = useRef(false)
  const lastTsRef = useRef(0)

  const t = useCallback((mn: string, en: string) => (locale === "mn" ? mn : en), [locale])

  const patch = useCallback((id: string, p: Partial<SceneProgress>) => {
    setScenes((prev) => prev.map((s) => (s.id === id ? { ...s, ...p } : s)))
  }, [])

  const flushWrites = useCallback(async () => {
    if (writingRef.current) return
    writingRef.current = true
    try {
      while (pendingRunRef.current) {
        const snap = pendingRunRef.current
        pendingRunRef.current = null
        await saveRun(snap).catch(() => {})
      }
    } finally {
      writingRef.current = false
    }
  }, [])

  // Persist the current run snapshot (best-effort) so a refresh/closed tab can
  // recover already-paid work and the final. Coalesces to the latest snapshot and
  // serializes the actual writes via flushWrites.
  const persist = useCallback(
    (bp: VideoBlueprint, key: string, done: boolean) => {
      // Strictly-monotonic timestamp so ordering is well-defined even within the
      // same millisecond.
      const ts = Math.max(Date.now(), lastTsRef.current + 1)
      lastTsRef.current = ts
      pendingRunRef.current = {
        runKey: key,
        blueprint: bp,
        scenes: bp.scenes.map((s) => sceneStateRef.current.get(s.id) ?? emptyScene(s.id)),
        finalUrl: finalRef.current?.key === key ? finalRef.current.url : null,
        done,
        updatedAt: ts,
      }
      void flushWrites()
    },
    [flushWrites],
  )

  // On mount, try to recover an unfinished (or just-completed) run for this user.
  const hydratedRef = useRef(false)
  useEffect(() => {
    if (!recover || hydratedRef.current) return
    hydratedRef.current = true
    let cancelled = false
    void (async () => {
      const res = await loadRun()
      if (cancelled || !res.ok || !res.data.run) return
      const saved = res.data.run
      sceneStateRef.current = new Map(saved.scenes.map((s) => [s.id, s]))
      runKeyRef.current = saved.runKey
      finalRef.current = saved.finalUrl ? { key: saved.runKey, url: saved.finalUrl } : null
      setActiveBlueprint(saved.blueprint)
      setScenes(
        saved.blueprint.scenes.map((s) => {
          const st = sceneStateRef.current.get(s.id)
          return st?.videoUrl
            ? { id: s.id, status: "done" as const, progress: 100, videoUrl: st.videoUrl }
            : { id: s.id, status: "idle" as const, progress: 0 }
        }),
      )
      if (saved.done && saved.finalUrl) {
        setFinalUrl(saved.finalUrl)
        setPhase("done")
      } else {
        // Recovered but unfinished — wait for the user to resume.
        setPhase("paused")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [recover])

  const run = useCallback(
    async (bp: VideoBlueprint) => {
      const key = runKeyOf(bp)
      if (key !== runKeyRef.current) {
        // Plan changed since the last run -> discard cached work.
        sceneStateRef.current = new Map()
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
          const st = sceneStateRef.current.get(s.id)
          return st?.videoUrl
            ? { id: s.id, status: "done" as const, progress: 100, videoUrl: st.videoUrl }
            : { id: s.id, status: "idle" as const, progress: 0 }
        }),
      )
      // Persist the snapshot up-front so the plan is recoverable even if the
      // first step is still in flight when the tab closes.
      persist(bp, key, false)

      // Read/update per-scene state, persisting after every meaningful change so
      // an accepted (already-paid) job survives a reload.
      const getState = (id: string): PersistedScene => sceneStateRef.current.get(id) ?? emptyScene(id)
      const setState = (st: PersistedScene) => {
        sceneStateRef.current.set(st.id, st)
        persist(bp, key, false)
      }

      const fail = (id: string, msg: string) => {
        patch(id, { status: "failed", error: msg })
        setError(msg)
        setPhase("error")
      }

      for (const scene of bp.scenes) {
        if (cancelRef.current) return

        let st = getState(scene.id)
        if (st.videoUrl) continue // already rendered — skip (and don't recharge)

        try {
          if (scene.type === "a_roll") {
            const char = getSceneCharacter(scene, bp)
            if (!char.avatar.imageUrl) throw new Error(t("Аватар зураг оруулаагүй байна", "No avatar image set"))
            if (!sceneHasNarration(scene)) throw new Error(t("Яриа хоосон байна", "Script is empty"))

            // 1. TTS — skip if already generated or a job is already in flight.
            if (!st.ttsAudioUrl && !st.job) {
              patch(scene.id, { status: "tts", progress: 8 })
              const tts = await generateTts(scene.script, char.voice.voiceId, char.voice.lang)
              if (!tts.ok) throw new Error(tts.error)
              st = { ...st, ttsAudioUrl: tts.data.audioUrl }
              setState(st)
            }
            if (cancelRef.current) return

            // 2. Submit the avatar job — skip if one was already accepted.
            let job: SceneJob
            if (st.job) {
              job = st.job
            } else {
              patch(scene.id, { status: "video", progress: 30 })
              const av = await generateAvatarVideo({
                imageUrl: char.avatar.imageUrl,
                audioUrl: st.ttsAudioUrl!,
                prompt: scene.visualPrompt || undefined,
              })
              if (!av.ok) throw new Error(av.error)
              job = { kind: "avatar", requestId: av.data.requestId }
              st = { ...st, job }
              setState(st)
            }
            if (cancelRef.current) return

            // 3. Poll the (possibly pre-existing) job.
            patch(scene.id, { status: "polling", progress: 45 })
            const done = await pollUntilDone(() => avatarStatus(job.requestId), {
              onProgress: (p) => patch(scene.id, { progress: Math.min(95, Math.max(45, p)) }),
            })
            if (!done.ok) {
              // Drop the dead job so an explicit retry can re-submit.
              st = { ...st, job: null }
              setState(st)
              throw new Error(done.error)
            }
            st = { ...st, videoUrl: done.videoUrl, job: null }
            setState(st)
            patch(scene.id, { status: "done", progress: 100, videoUrl: done.videoUrl })
          } else {
            // b_roll — needs at least a visual prompt or a script to drive it.
            const prompt = scene.visualPrompt.trim() || scene.script.trim()
            if (!prompt) throw new Error(t("Дүрслэл хоосон байна", "Visual prompt is empty"))

            // 1. Optional narration TTS — skip if already generated or a job is
            //    in flight (audio is kept for stitch even after the job submits).
            if (sceneHasNarration(scene) && !st.ttsAudioUrl && !st.job) {
              patch(scene.id, { status: "tts", progress: 8 })
              const tts = await generateTts(scene.script, bp.voice.voiceId, bp.voice.lang)
              if (!tts.ok) throw new Error(tts.error)
              st = { ...st, ttsAudioUrl: tts.data.audioUrl }
              setState(st)
            }
            if (cancelRef.current) return

            // 2. Submit the video job — skip if one was already accepted.
            let job: SceneJob
            if (st.job) {
              job = st.job
            } else {
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
              job = { kind: "video", requestId: gv.data.requestId, model: bp.model, mode: "text" }
              st = { ...st, job }
              setState(st)
            }
            if (cancelRef.current) return

            // 3. Poll the (possibly pre-existing) job.
            patch(scene.id, { status: "polling", progress: 45 })
            const done = await pollUntilDone(
              () => videoStatus(job.requestId, job.model ?? bp.model, job.mode ?? "text"),
              {
                onProgress: (p) => patch(scene.id, { progress: Math.min(95, Math.max(45, p)) }),
              },
            )
            if (!done.ok) {
              st = { ...st, job: null }
              setState(st)
              throw new Error(done.error)
            }
            st = { ...st, videoUrl: done.videoUrl, job: null }
            setState(st)
            patch(scene.id, { status: "done", progress: 100, videoUrl: done.videoUrl })
          }
        } catch (e) {
          fail(scene.id, e instanceof Error ? e.message : t("Алдаа гарлаа", "Something went wrong"))
          return
        }
      }

      if (cancelRef.current) return

      // Build the ordered clip list for stitch. a_roll has audio baked in (null
      // so stitch doesn't re-overlay); b_roll carries its own narration url.
      const produced = bp.scenes.map((s) => {
        const st = getState(s.id)
        return {
          videoUrl: st.videoUrl as string,
          audioUrl: s.type === "a_roll" ? null : st.ttsAudioUrl,
        }
      })
      if (produced.some((p) => !p.videoUrl)) {
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

      // Persist the finished run so a later refresh restores the result.
      persist(bp, key, true)

      setFinalUrl(final)
      setPhase("done")
    },
    [patch, persist, t],
  )

  const cancel = useCallback(() => {
    cancelRef.current = true
    setPhase("idle")
  }, [])

  const reset = useCallback(() => {
    cancelRef.current = true
    sceneStateRef.current = new Map()
    finalRef.current = null
    runKeyRef.current = ""
    // Drop any queued snapshot so it can't recreate the run after we clear it.
    pendingRunRef.current = null
    setActiveBlueprint(null)
    setPhase("idle")
    setScenes([])
    setFinalUrl(null)
    setError(null)
    // Discard any recoverable run on the server too.
    void clearRun()
  }, [])

  return { phase, scenes, finalUrl, error, activeBlueprint, run, cancel, reset }
}
