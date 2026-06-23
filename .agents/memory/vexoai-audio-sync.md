---
name: VexoAI audio/lipsync timing
description: How per-scene narration timing works and where the "voice before lips" fix lives
---

# VexoAI narration timing

**The "voice plays before the mouth moves" problem is primarily a plain-merge problem, not a lipsync problem.** Lipsync engines (LatentSync / sync-lipsync) animate the mouth *from* the audio, so they are inherently in sync — the mouth moves exactly when speech is present.

**Per-scene delay = leading silence before speech.** A user-facing slider sets a per-scene `audioStartOffset` (default 0.5s). It is applied differently per path:

- **Plain merge path** (faceless / no-face shots): the FAL ffmpeg compose voice keyframe `timestamp` *is* the delay. Trivial and format-agnostic.
- **Lipsync path**: there is no offset param on the engines, so the only way to delay speech is to **prepend silence to the audio before syncing** (silence = closed mouth). This is done **server-side** in a dedicated pad route, not in the browser.

**Why server-side padding (not Web Audio in the browser):** narration URLs (camb.ai / FAL) may lack permissive CORS headers, so a browser `fetch()` + `decodeAudioData` can silently fail and the slider would appear broken. Server-to-server fetch has no CORS limit.

**Padding implementation:** camb.ai TTS returns **PCM WAV**, so silence is inserted by native buffer manipulation (walk RIFF chunks, find `fmt `/`data`, insert zero-filled frames aligned to `blockAlign`, fix RIFF + data size fields) — no ffmpeg needed. Non-WAV input (e.g. Gemini MP3 for global languages) is returned **unchanged** (`padded:false`); lipsync then runs with no pause, which is still correct (just no deliberate pause). The plain-merge timestamp path still works for any format.

**Gotchas:**
- Always validate the offset with `Number.isFinite` before clamping — `typeof x === "number"` is `true` for `NaN`, and a `NaN` timestamp breaks FAL compose.
- If padding/upload fails, the code falls back to undelayed audio rather than failing the scene. Acceptable, but means the pause silently won't apply in that case.

## Per-scene voice timeline (waveform + drag)

The delay slider was replaced by a draggable per-scene audio timeline (waveform inside the scene's clip window). Narration is **pre-generated for preview** so the user positions a real waveform before final render.

**Narration identity is a key: `voiceId|lang|text`.** Stored audio carries the key it was generated with. Reuse only when the *current* key matches the stored key.
- **Reuse, don't re-charge:** produce reuses the previewed audio when keys match, so TTS (1 credit) is charged once whether the user previewed or not.
- **Charge-once under races:** preview generation is deduped through an in-flight `Map<flightKey, Promise>` ref (`flightKey = index|key`). Concurrent callers (rapid clicks, or produce racing an in-progress preview) share the one promise. Produce `await`s the same ensure-narration call before reading stored audio, so it never fires a second `/api/tts`.
- **Stale-key trap:** changing the *global* voice does not touch a scene that has no per-scene voice, so its stored `narrationKey` silently goes stale. The UI must **re-derive freshness from the current key** (not trust the stored `narrationStatus === "ready"`) or it shows the wrong waveform. Treat a stale key as not-ready → prompt a refresh.

**Waveform peaks are decoded server-side** (`/api/audio-peaks`), same CORS reasoning as the padding route. Only PCM/float **WAV** (camb.ai) is decodable → `supported:true` + normalized peaks + duration; **MP3** (Gemini global voices) returns `supported:false` and the timeline shows a plain block instead of bars.
