---
name: VexoAI spoken-language source of truth
description: Which field actually controls TTS language and app locale in VexoAI's blueprint.
---

The spoken/output language and the app UI locale are both derived from **`blueprint.voice.lang`** (per-character `voice.lang` for multi-cast scenes), NOT from `blueprint.language`.

**Why:** TTS generation passes `voice.lang` to the TTS route, and `create-page-client` computes `locale` from `blueprint.voice.lang`. `blueprint.language` is only set once during `normalizeBlueprint` and is effectively dead for generation — mutating it alone is a no-op that just creates a display/state mismatch.

**How to apply:** Any UI that lets the user "change the language" must change `voice.lang` (via the voice picker, which also picks an appropriate voice), not `blueprint.language`. To *show* the current language, read `voice.lang`. Routing a language affordance to the voice picker keeps language and voice consistent and avoids e.g. a Mongolian camb studio voice paired with `lang:"en"`.
