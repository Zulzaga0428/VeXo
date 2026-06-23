import { Suspense } from "react"
import { CreatePageClient } from "@/components/create/create-page-client"

export default function CreatePage() {
  return (
    <Suspense fallback={null}>
      <CreatePageClient />
    </Suspense>
  )
}
