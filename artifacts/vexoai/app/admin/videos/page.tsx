import { createAdminClient } from "@/lib/supabase/admin"
import { VideosTable } from "@/components/admin/videos-table"

export const dynamic = "force-dynamic"

export default async function AdminVideosPage() {
  const supabase = createAdminClient()
  const { data: videos } = await supabase
    .from("videos")
    .select(
      "id, user_id, prompt, status, video_url, image_url, voice, scene_index, series_count, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(200)

  // Fetch profiles for these users
  const userIds = Array.from(
    new Set((videos ?? []).map((v) => v.user_id).filter(Boolean))
  )
  const { data: profiles } = userIds.length
    ? await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", userIds)
    : { data: [] as { id: string; email: string | null; full_name: string | null }[] }

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.id, p])
  )

  const enriched = (videos ?? []).map((v) => ({
    ...v,
    user_email: profileMap.get(v.user_id)?.email ?? null,
    user_name: profileMap.get(v.user_id)?.full_name ?? null,
  }))

  return (
    <div className="p-6 sm:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Видеонууд</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Сүүлийн {enriched.length} видео
        </p>
      </div>
      <VideosTable videos={enriched} />
    </div>
  )
}
