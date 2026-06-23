// Server-only persistence for in-progress Create runs.
//
// Run snapshots contain the user's blueprint content and generated media URLs, so
// they must NOT live in the public media bucket. They are stored in a dedicated
// PRIVATE bucket and only ever read/written through the authenticated
// /api/create-run route using the service-role admin client — there is no public
// URL for this data.

import { createAdminClient } from "@/lib/supabase/admin"
import { shouldPersistRun, type PersistedRun } from "@/lib/create-run"

const PRIVATE_BUCKET = "vexoai-runs"

// Memoize the bucket-exists check per process (cheap, idempotent on cold start).
let bucketReady: Promise<void> | null = null
function ensureBucket(): Promise<void> {
  if (!bucketReady) {
    bucketReady = (async () => {
      const admin = createAdminClient()
      const { error } = await admin.storage.createBucket(PRIVATE_BUCKET, { public: false })
      // Bucket already existing is fine; surface anything else and allow a retry.
      if (error && !/exist/i.test(error.message)) {
        bucketReady = null
        throw error
      }
    })()
  }
  return bucketReady
}

function runPath(userId: string): string {
  return `${userId}.json`
}

export async function saveRunState(userId: string, run: PersistedRun): Promise<void> {
  await ensureBucket()
  const admin = createAdminClient()
  // Compare-and-set: never let a stale (older/equal) snapshot overwrite newer
  // state, even if writes arrive out of order. See shouldPersistRun.
  const existing = await loadRunState(userId)
  if (!shouldPersistRun(existing, run)) return
  const body = new Blob([JSON.stringify(run)], { type: "application/json" })
  const { error } = await admin.storage.from(PRIVATE_BUCKET).upload(runPath(userId), body, {
    contentType: "application/json",
    upsert: true,
  })
  if (error) throw new Error(`Run save failed: ${error.message}`)
}

export async function loadRunState(userId: string): Promise<PersistedRun | null> {
  await ensureBucket()
  const admin = createAdminClient()
  const { data, error } = await admin.storage.from(PRIVATE_BUCKET).download(runPath(userId))
  if (error || !data) return null
  try {
    return JSON.parse(await data.text()) as PersistedRun
  } catch {
    return null
  }
}

export async function clearRunState(userId: string): Promise<void> {
  await ensureBucket()
  const admin = createAdminClient()
  await admin.storage.from(PRIVATE_BUCKET).remove([runPath(userId)])
}
