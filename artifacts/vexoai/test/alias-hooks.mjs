// Test-only ESM resolve hook (registered via test/register.mjs).
//
// 1. Resolves the project's `@/*` path alias to real on-disk files so the
//    node:test runner can load the actual route/credits modules (node does not
//    read tsconfig `paths`).
// 2. Redirects the external I/O boundaries (Supabase clients, the FAL client,
//    next/server) to in-memory fakes under lib/test-helpers so tests never touch
//    a network or require service credentials.
//
// Everything else (credits.ts, fal-video.ts, lipsync-jobs.ts, the route
// handlers) loads for real, so tests exercise the actual merged behavior.
import { statSync } from "node:fs"
import { dirname, join, resolve as resolvePath } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const root = resolvePath(dirname(fileURLToPath(import.meta.url)), "..")

const REDIRECTS = {
  "@/lib/supabase/admin": "lib/test-helpers/supabase-admin.ts",
  "@/lib/supabase/server": "lib/test-helpers/supabase-server.ts",
  "@fal-ai/client": "lib/test-helpers/fal.ts",
  "next/server": "lib/test-helpers/next-server.ts",
}

function fileUrl(relPath) {
  return pathToFileURL(join(root, relPath)).href
}

function isFile(path) {
  try {
    return statSync(path).isFile()
  } catch {
    return false
  }
}

function resolveAlias(specifier) {
  const rest = specifier.slice(2)
  const base = join(root, rest)
  const candidates = [`${base}.ts`, `${base}.tsx`, join(base, "index.ts"), `${base}.js`, base]
  for (const candidate of candidates) {
    if (isFile(candidate)) return pathToFileURL(candidate).href
  }
  return null
}

export async function resolve(specifier, context, nextResolve) {
  const redirect = REDIRECTS[specifier]
  if (redirect) return { url: fileUrl(redirect), shortCircuit: true }
  if (specifier.startsWith("@/")) {
    const url = resolveAlias(specifier)
    if (url) return { url, shortCircuit: true }
  }
  return nextResolve(specifier, context)
}
