import { uploadFile } from "@/lib/storage"

export type UploadedMedia = {
  pathname: string
  url: string
}

export async function uploadPublicMedia(folder: string, file: File): Promise<UploadedMedia> {
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin"
  const key = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const url = await uploadFile(key, file, file.type || undefined)
  return { pathname: key, url }
}
