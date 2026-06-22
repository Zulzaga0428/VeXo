import { createAdminClient } from "@/lib/supabase/admin"
import { UsersTable } from "@/components/admin/users-table"

export const dynamic = "force-dynamic"

export default async function AdminUsersPage() {
  const supabase = createAdminClient()
  const { data: users } = await supabase
    .from("profiles")
    .select("id, email, full_name, phone, plan, credits, created_at")
    .order("created_at", { ascending: false })

  return (
    <div className="p-6 sm:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Хэрэглэгчид</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Нийт {users?.length ?? 0} хэрэглэгч
        </p>
      </div>
      <UsersTable users={users ?? []} />
    </div>
  )
}
