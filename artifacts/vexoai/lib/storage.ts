import { createAdminClient } from "@/lib/supabase/admin"

const BUCKET = "vexoai-media"

/**
 * Supabase Storage public URL үүсгэнэ.
 * Path нь аль хэдийн full URL бол хэвээр буцаана.
 */
export function getPublicUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!
  return `${base}/storage/v1/object/public/${BUCKET}/${pathOrUrl}`
}

/**
 * Supabase Storage-д файл upload хийж public URL буцаана.
 */
export async function uploadFile(
  path: string,
  data: File | Blob | Buffer | ArrayBuffer | ReadableStream,
  contentType?: string,
): Promise<string> {
  const admin = createAdminClient()
  const { error } = await admin.storage.from(BUCKET).upload(path, data as Blob, {
    contentType,
    upsert: true,
  })
  if (error) throw new Error(`Storage upload failed: ${error.message}`)
  return getPublicUrl(path)
}

/**
 * Supabase Storage-оос файл устгана.
 * Full URL эсвэл path хоёуланг хүлээн авна.
 */
export async function deleteFile(pathOrUrl: string): Promise<void> {
  if (!pathOrUrl) return
  try {
    const admin = createAdminClient()
    let path = pathOrUrl
    const marker = `/object/public/${BUCKET}/`
    if (pathOrUrl.includes(marker)) {
      path = pathOrUrl.split(marker)[1]
    }
    await admin.storage.from(BUCKET).remove([path])
  } catch {
    // Устгаж чадахгүй бол дуусгавар болгоно — critical биш
  }
}
