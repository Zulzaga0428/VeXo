import { strict as assert } from "node:assert"
import { test } from "node:test"
import { isSchedulerEnabled, parseEnvInt } from "./reconcile-scheduler.ts"

test("isSchedulerEnabled: defaults on in production", () => {
  assert.equal(isSchedulerEnabled({ NODE_ENV: "production" } as NodeJS.ProcessEnv), true)
})

test("isSchedulerEnabled: defaults off outside production", () => {
  assert.equal(isSchedulerEnabled({ NODE_ENV: "development" } as NodeJS.ProcessEnv), false)
  assert.equal(isSchedulerEnabled({} as NodeJS.ProcessEnv), false)
})

test("isSchedulerEnabled: explicit override wins both ways", () => {
  assert.equal(
    isSchedulerEnabled({ NODE_ENV: "development", RECONCILE_SWEEP_ENABLED: "true" } as NodeJS.ProcessEnv),
    true,
  )
  assert.equal(
    isSchedulerEnabled({ NODE_ENV: "development", RECONCILE_SWEEP_ENABLED: "1" } as NodeJS.ProcessEnv),
    true,
  )
  assert.equal(
    isSchedulerEnabled({ NODE_ENV: "production", RECONCILE_SWEEP_ENABLED: "false" } as NodeJS.ProcessEnv),
    false,
  )
  assert.equal(
    isSchedulerEnabled({ NODE_ENV: "production", RECONCILE_SWEEP_ENABLED: "0" } as NodeJS.ProcessEnv),
    false,
  )
})

test("parseEnvInt: falls back on missing/invalid/non-positive values", () => {
  assert.equal(parseEnvInt(undefined, 15), 15)
  assert.equal(parseEnvInt("", 15), 15)
  assert.equal(parseEnvInt("nope", 15), 15)
  assert.equal(parseEnvInt("0", 15), 15)
  assert.equal(parseEnvInt("-5", 15), 15)
})

test("parseEnvInt: parses and rounds positive values", () => {
  assert.equal(parseEnvInt("30", 15), 30)
  assert.equal(parseEnvInt("12.6", 15), 13)
})
