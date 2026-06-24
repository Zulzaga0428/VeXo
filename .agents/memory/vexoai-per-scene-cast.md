---
name: VexoAI per-scene cast (characters[] indexing)
description: How per-scene avatar/voice casting is modeled and the invariants that keep it bug-free across scene add/delete.
---

# VexoAI per-scene cast

Each `BlueprintScene` can have its own presenter via `scene.characterIdx`:
- `0` / `undefined` → the PRIMARY cast (`bp.avatar` / `bp.voice`).
- `1+` → `bp.characters[idx - 1]` (a `Character` = `{ id, avatar, voice }`).

This contract is shared by **two** places that must stay in lockstep:
- the editor card (`components/create/blueprint-card.tsx`, `sceneChar` + `writeCast`)
- the generation pipeline (`hooks/use-video-generation.ts`, `getSceneCharacter`)

## Invariants (do not break)

- **`characters[]` is append-only — never splice/reorder it.** Deleting a scene must NOT remove its character; orphans are harmless (nothing references them; cost iterates scenes only). Splicing would silently re-point every later `characterIdx`.
- **Writes are position-independent.** Do NOT special-case "scene 0 = primary" — a scene's position changes on delete. `writeCast` decides by ownership: a valid own character is edited in place; a scene on primary edits `bp.avatar/voice` in place only if it is the SOLE primary user, otherwise it forks a cloned character so the other primary-sharers stay put.
- **Stale `characterIdx` (points past `characters[]`) is treated as primary** and recovers cleanly (fork/in-place), never indexes a missing entry.
- **b_roll has no avatar** (driven by `visualPrompt`), but b_roll narration TTS still uses the scene's character voice (`getSceneCharacter`), so per-scene voice works for both scene types.
- **`runKeyOf` must include `bp.characters` and per-scene `characterIdx`** or cached/paid scene work is wrongly reused after a cast edit on retry/resume.

**Why:** an earlier index-by-position design broke the "primary anchor" after deleting scene 0 (a forked scene became index 0 yet kept editing its own character). The sole-primary-user fork rule + append-only `characters[]` removes all reindex/orphan classes of bug.
