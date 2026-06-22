"use client"

import { DashboardHome } from "@/components/dashboard-home"
import { SiteFooter } from "@/components/site-footer"

export default function LandingPage() {
  // The landing page now shows the dashboard home (the agent chat box +
  // category templates) so first-time visitors can explore without signing in.
  // The sidebar handles the signed-out state (login/register instead of credits).
  return <DashboardHome locale="mn" footer={<SiteFooter locale="mn" />} />
}
