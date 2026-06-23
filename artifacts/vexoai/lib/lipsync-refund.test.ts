// Integration tests for lip-sync refund durability and the natural->pro
// fallback charge hand-off. These drive the REAL route handlers + REAL
// credits.ts against an in-memory mirror of migration 0001's RPC semantics
// (see lib/test-helpers/fake-state.ts), so they lock in the billing invariants:
// a recovered job refunds exactly once, the fallback transfers a single charge,
// and concurrent polls / a second instance can never double-refund.
//
// Runtime wiring (the `@/` alias + Supabase/FAL/next/server fakes) is set up by
// test/register.mjs, loaded via NODE_OPTIONS in the package `test` script.
import { strict as assert } from "node:assert"
import { test, beforeEach } from "node:test"
import {
  resetState,
  seedCharge,
  getChargeRow,
  getCredits,
  setCredits,
  setFailUpsert,
  queueSubmitId,
  setFalStatus,
  setFalResult,
} from "./test-helpers/fake-state.ts"
import { NextRequest } from "./test-helpers/next-server.ts"
import { pendingLipsyncJobs, type LipsyncJob } from "./lipsync-jobs.ts"
import { refundCharge } from "./credits.ts"
import { GET as statusGET } from "../app/api/lipsync-status/route.ts"
import { POST as submitPOST } from "../app/api/lipsync/route.ts"

const NATURAL = "fal-ai/latentsync"
const PRO = "fal-ai/sync-lipsync/v2"

function statusRequest(requestId: string) {
  return new NextRequest(
    `https://test.local/api/lipsync-status?requestId=${encodeURIComponent(requestId)}`,
  ) as unknown as Parameters<typeof statusGET>[0]
}

function submitRequest(body: unknown) {
  return new NextRequest("https://test.local/api/lipsync", { body }) as unknown as Parameters<
    typeof submitPOST
  >[0]
}

function media(): Pick<LipsyncJob, "videoUrl" | "audioUrl"> {
  return { videoUrl: "https://cdn.test/clip.mp4", audioUrl: "https://cdn.test/voice.mp3" }
}

beforeEach(() => {
  // credits already spent at submit time -> the user starts at 0 for poll tests.
  resetState({ user: { id: "u1" }, credits: { u1: 0 } })
  pendingLipsyncJobs.clear()
})

test("recovered (map-less) FAILED job refunds exactly once via the status poll", async () => {
  // No in-memory job (server restarted / other instance) — only the durable row.
  seedCharge({ request_id: "r1", user_id: "u1", cost: 6, model: PRO })
  setFalStatus("r1", "FAILED")

  const first = await statusGET(statusRequest("r1"))
  assert.equal((await first.json()).status, "failed")
  assert.equal(getChargeRow("r1")?.status, "refunded")
  assert.equal(getCredits("u1"), 6)

  // A second terminal poll must be an idempotent no-op — no double refund.
  const second = await statusGET(statusRequest("r1"))
  assert.equal((await second.json()).status, "failed")
  assert.equal(getCredits("u1"), 6)
})

test("natural->pro fallback transfers the single charge and only one refund is possible across the chain", async () => {
  seedCharge({ request_id: "nat1", user_id: "u1", cost: 6, model: NATURAL })
  setFalStatus("nat1", "FAILED")
  pendingLipsyncJobs.set("nat1", { ...media(), userId: "u1", engine: "natural", model: NATURAL })
  queueSubmitId("pro1")

  const fallback = await statusGET(statusRequest("nat1"))
  const fallbackJson = await fallback.json()
  assert.equal(fallbackJson.status, "fallback")
  assert.equal(fallbackJson.requestId, "pro1")
  assert.equal(fallbackJson.engine, "pro")

  // Charge MOVED, not refunded: old settled, successor pending, no credit yet.
  assert.equal(getChargeRow("nat1")?.status, "settled")
  assert.equal(getChargeRow("pro1")?.status, "pending")
  assert.equal(getChargeRow("pro1")?.model, PRO)
  assert.equal(getChargeRow("pro1")?.cost, 6)
  assert.equal(getChargeRow("pro1")?.user_id, "u1")
  assert.equal(getCredits("u1"), 0)
  assert.equal(pendingLipsyncJobs.has("pro1"), true)
  assert.equal(pendingLipsyncJobs.has("nat1"), false)

  // The successor fails on pro -> refund exactly once.
  setFalStatus("pro1", "FAILED")
  const failed = await statusGET(statusRequest("pro1"))
  assert.equal((await failed.json()).status, "failed")
  assert.equal(getChargeRow("pro1")?.status, "refunded")
  assert.equal(getCredits("u1"), 6)

  // The settled predecessor can never be refunded again -> no second credit.
  assert.equal(await refundCharge("nat1"), 0)
  assert.equal(getCredits("u1"), 6)
})

test("concurrent terminal polls on the same charge cannot double-refund", async () => {
  seedCharge({ request_id: "c1", user_id: "u1", cost: 6, model: PRO })
  setFalStatus("c1", "FAILED")

  const [a, b] = await Promise.all([statusGET(statusRequest("c1")), statusGET(statusRequest("c1"))])
  assert.equal((await a.json()).status, "failed")
  assert.equal((await b.json()).status, "failed")

  assert.equal(getCredits("u1"), 6) // refunded once, not twice
  assert.equal(getChargeRow("c1")?.status, "refunded")
})

test("concurrent fallback polls produce exactly one successor and no double charge", async () => {
  seedCharge({ request_id: "nat2", user_id: "u1", cost: 6, model: NATURAL })
  setFalStatus("nat2", "FAILED")
  pendingLipsyncJobs.set("nat2", { ...media(), userId: "u1", engine: "natural", model: NATURAL })
  queueSubmitId("proA")
  queueSubmitId("proB")

  const [a, b] = await Promise.all([statusGET(statusRequest("nat2")), statusGET(statusRequest("nat2"))])
  const outcomes = [(await a.json()).status, (await b.json()).status].sort()
  // Exactly one wins the transfer (fallback); the loser discards its orphan job.
  assert.deepEqual(outcomes, ["fallback", "processing"])

  assert.equal(getChargeRow("nat2")?.status, "settled")
  const successors = ["proA", "proB"].filter((id) => getChargeRow(id))
  assert.equal(successors.length, 1)
  assert.equal(getChargeRow(successors[0])?.status, "pending")
  assert.equal(getCredits("u1"), 0) // charge moved, never refunded
})

test("a settled (succeeded) charge cannot be refunded by a later failure poll", async () => {
  seedCharge({ request_id: "ok1", user_id: "u1", cost: 6, model: PRO })
  setFalStatus("ok1", "COMPLETED")
  setFalResult("ok1", { videoUrl: "https://cdn.test/done.mp4" })

  const done = await statusGET(statusRequest("ok1"))
  const doneJson = await done.json()
  assert.equal(doneJson.status, "done")
  assert.equal(doneJson.videoUrl, "https://cdn.test/done.mp4")
  assert.equal(getChargeRow("ok1")?.status, "settled")

  // A later spurious FAILED poll (settle ordering protects the charge).
  setFalStatus("ok1", "FAILED")
  await statusGET(statusRequest("ok1"))
  assert.equal(getChargeRow("ok1")?.status, "settled")
  assert.equal(getCredits("u1"), 0)
})

test("submit records a lipsync charge keyed by the FAL requestId", async () => {
  setCredits("u1", 10)
  queueSubmitId("s1")

  const res = await submitPOST(submitRequest({ ...media(), engine: "natural" }))
  const json = await res.json()
  assert.equal(res.status, 200)
  assert.equal(json.requestId, "s1")
  assert.equal(json.engine, "natural")

  const row = getChargeRow("s1")
  assert.equal(row?.kind, "lipsync")
  assert.equal(row?.model, NATURAL)
  assert.equal(row?.status, "pending")
  assert.equal(row?.cost, 6)
  assert.equal(getCredits("u1"), 4) // 10 - 6
  assert.equal(pendingLipsyncJobs.has("s1"), true)
})

test("submit compensates (refunds) when the charge row cannot be recorded", async () => {
  setCredits("u1", 10)
  queueSubmitId("s2")
  setFailUpsert(true) // recordCharge cannot persist the row

  const res = await submitPOST(submitRequest({ ...media(), engine: "natural" }))
  const json = await res.json()
  assert.equal(res.status, 503)
  assert.equal(json.requestId, undefined) // no pollable job handed back
  assert.equal(getChargeRow("s2")?.status, "refunded") // compensated row
  assert.equal(getCredits("u1"), 10) // 10 - 6 (deduct) + 6 (compensate) = 10
  assert.equal(pendingLipsyncJobs.has("s2"), false)
})
