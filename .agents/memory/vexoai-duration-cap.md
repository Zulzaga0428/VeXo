---
name: VexoAI per-quality scene duration cap
description: Why scene duration limits depend on the quality/model and where they must be enforced
---

# Per-quality scene duration cap

Scene `durationSec` max depends on the blueprint quality (`bp.model`): Standard (`standard`) → 15s, Premium (`veo3`) → 8s.

**Why:** product rule tied to the underlying video model; Premium/veo3 clips are short.

**How to apply:** enforce the cap at every write boundary (the duration stepper, the `setField("duration")` clamp, and the quality switch which clamps all scenes), AND normalize on load — a blueprint can arrive as veo3 with >8s scenes from generated/persisted data, so a mount/model/scenes effect clamps once (guarded by an over-cap check to avoid loops). Enforcing only on the stepper is insufficient.
