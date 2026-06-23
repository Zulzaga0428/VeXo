import { strict as assert } from "node:assert"
import { test } from "node:test"
import { isPersistedRun, shouldPersistRun, type PersistedRun } from "./create-run.ts"

function makeRun(updatedAt: number, overrides: Partial<PersistedRun> = {}): PersistedRun {
  return {
    runKey: "k",
    blueprint: { id: "b", scenes: [] } as unknown as PersistedRun["blueprint"],
    scenes: [{ id: "s1", ttsAudioUrl: null, job: { kind: "video", requestId: "req-1" }, videoUrl: null }],
    finalUrl: null,
    done: false,
    updatedAt,
    ...overrides,
  }
}

test("shouldPersistRun: accepts the first write when nothing is stored", () => {
  assert.equal(shouldPersistRun(null, makeRun(10)), true)
})

test("shouldPersistRun: accepts a strictly newer snapshot", () => {
  assert.equal(shouldPersistRun(makeRun(10), makeRun(11)), true)
})

test("shouldPersistRun: rejects an older snapshot (out-of-order arrival)", () => {
  const stored = makeRun(20, {
    scenes: [{ id: "s1", ttsAudioUrl: null, job: null, videoUrl: "https://done/clip.mp4" }],
  })
  const stale = makeRun(10) // older write that arrives late and lacks the videoUrl
  assert.equal(shouldPersistRun(stored, stale), false)
})

test("shouldPersistRun: rejects an equal-timestamp snapshot", () => {
  assert.equal(shouldPersistRun(makeRun(15), makeRun(15)), false)
})

test("isPersistedRun: validates scene/job shape and required fields", () => {
  assert.equal(isPersistedRun(makeRun(1)), true)
  assert.equal(isPersistedRun(null), false)
  assert.equal(isPersistedRun({ ...makeRun(1), updatedAt: "nope" }), false)
  assert.equal(isPersistedRun({ ...makeRun(1), scenes: [{ id: 1 }] }), false)
  assert.equal(
    isPersistedRun({ ...makeRun(1), scenes: [{ id: "s", ttsAudioUrl: null, videoUrl: null, job: { kind: "x", requestId: "r" } }] }),
    false,
  )
})
