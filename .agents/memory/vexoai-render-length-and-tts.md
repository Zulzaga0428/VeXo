---
name: VexoAI render length is narration-driven; Camb TTS can loop
description: Why blueprint durationSec must be derived from script, and how Camb mars TTS repetition is handled
---

## Rendered clip length is set by the VOICE, not durationSec

In the VexoAI generation pipeline the agent's `durationSec` does NOT control the
final clip length for any narrated scene:
- **a_roll**: Kling AI Avatar makes the clip exactly as long as the TTS audio.
- **narrated b_roll**: footage is trimmed to the narration audio during stitch
  (`fal-ai/ffmpeg-api/merge-audio-video` cuts to the shorter of video/audio).
- **silent b_roll**: this is the ONLY case where `durationSec` reaches the FAL
  video model and actually sets the length.

**Why:** the agent used to promise e.g. 22s while the render came out ~11s,
because scripts were short. Users saw a dishonest number.

**How to apply:** in `normalizeBlueprint`, any scene WITH a script derives
`durationSec` from `estimateSpeechDuration` (Mongolian ≈ 2.5 words/sec, round up,
clamp 3–15, then `Math.min` with the model cap: veo3=8, standard=15). Keep the
blueprint number honest vs. the voice. Don't "fix" by trying to stretch video —
the voice length is the source of truth.

## Camb.AI mars-8.1 looping (repeats the final phrase)

`mars-8.1-pro-beta` sometimes loops the last Mongolian phrase several times on
short / loosely-punctuated text. There is NO documented API param
(temperature/repetition_penalty) to stop it, and the model can't be swapped —
mars-8.1 is the only one that reproduces cloned voices faithfully.

**Mitigations in `lib/cambai.ts`** (both, layered):
1. `sanitizeTtsText` — normalize whitespace, collapse repeated/stray punctuation,
   force a single terminal period (clean end-of-utterance signal).
2. Runtime anti-loop guard — measure the returned WAV duration; if it exceeds
   `estimateSpeechDuration(text) * 1.8` the model likely looped, so retry once and
   keep whichever attempt is closest to expected. Retry is free of extra credit
   (credits are charged once in the route, not per Camb call).

**How to apply:** WAV-only duration read (RIFF magic check) — guard is skipped for
non-WAV payloads. If looping persists, raise the 1.8x sensitivity or add tail-trim.
