import { put } from "@vercel/blob"

// The project's Blob store is configured as a PRIVATE store, so uploads must
// use access:"private". Private blobs are not publicly reachable by their raw
// URL — instead we expose them through the public proxy at /api/blob?path=...
// (see app/api/blob/route.ts). This helper uploads a file and returns that
// proxy URL, which is what we persist in the database.

export type UploadedMedia = {
  pathname: string
  url: string // public proxy URL safe to store and render
}

export async function uploadPublicMedia(folder: string, file: File): Promise<UploadedMedia> {
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin"
  const key = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  const blob = await put(key, file, {
    access: "private",
    addRandomSuffix: false,
    contentType: file.type || undefined,
  })

  return {
    pathname: blob.pathname,
    url: `/api/blob?path=${encodeURIComponent(blob.pathname)}`,
  }
}
