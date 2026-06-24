---
name: VexoAI generation run cache key
description: Why runKeyOf must include all cast-affecting fields to avoid reusing stale paid footage.
---

`runKeyOf(bp)` in `hooks/use-video-generation.ts` is the identity that decides whether a re-run reuses already-paid scene artifacts (TTS audio + video jobs) or regenerates them.

**Rule:** Every field that can change what a scene renders MUST be projected into `runKeyOf`. This includes per-scene `characterIdx` and the full `bp.characters[]` cast (each character's avatar imageUrl + voice), not just the primary `bp.avatar`/`bp.voice`.

**Why:** The blueprint became multi-character (per-scene cast assigned via `characterIdx`, extra actors in `bp.characters`). The original key only hashed the primary avatar/voice + script/visual/duration. So switching a scene's actor, or editing a non-primary actor's avatar/voice, did NOT change the key → cached footage was reused → the generated video silently ignored the user's cast edits while still charging them.

**How to apply:** Any future addition of a per-scene or per-character editable field that affects output (new avatar fields, lip-sync toggles, background, etc.) must be added to `runKeyOf` in lockstep. If a "my edit didn't take effect on regenerate" bug appears, suspect a missing field in `runKeyOf` first.
