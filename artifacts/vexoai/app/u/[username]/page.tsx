import { ProfileView } from "@/components/profile/profile-view"

export const dynamic = "force-dynamic"

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params
  return <ProfileView username={username} />
}
