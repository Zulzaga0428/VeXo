import { redirect } from "next/navigation"

// The old "Create Video" page has been replaced by the Studio.
// Anyone landing on /app is sent to the dashboard home.
export default function AppIndexPage() {
  redirect("/app/dashboard")
}
