import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { isAdminEmail } from "@/lib/supabase/admin"
import { AdminSidebar } from "@/components/admin-sidebar"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login?redirect=/admin")
  }

  if (!isAdminEmail(user.email)) {
    redirect("/app")
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar email={user.email ?? ""} />
      <main className="flex-1 overflow-x-hidden">{children}</main>
    </div>
  )
}
