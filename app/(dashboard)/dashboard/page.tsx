import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getAuthContext, getDashboardData, getLeadsSummary, getStaffSession } from "@/lib/data";
import { DashboardClient } from "@/components/modules/dashboard/dashboard-client";
import { NoAccess } from "@/components/no-access";
import DashboardLoading from "./loading";

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardData />
    </Suspense>
  );
}

async function DashboardData() {
  // Dashboard is OWNER-only (shows financial KPIs, profit/loss, full gym
  // overview). Staff sessions are redirected to /members — their primary
  // work area. Staff who don't have members.view_all fall through to
  // /leads, then /check-ins. Staff with ZERO permissions land on a
  // friendly NoAccess page instead of looping through Forbidden.
  const owner = await getAuthContext();
  if (!owner?.gymId) {
    const staff = await getStaffSession();
    if (!staff) redirect("/login");
    // Route staff to their landing page based on permissions
    if (staff.permissions.includes("members.view_all") || staff.permissions.includes("members.add")) {
      redirect("/members");
    }
    if (staff.permissions.includes("leads.view")) {
      redirect("/leads");
    }
    if (staff.permissions.includes("checkins.record")) {
      redirect("/check-ins");
    }
    // Empty-perms staff (cook / other / freshly-added without configured
    // perms). Don't redirect to login — they ARE authenticated; just have
    // nothing to do. Show friendly landing instead of redirect loop.
    return <NoAccess fullName={staff.fullName} gymName={staff.gymName} />;
  }
  const [data, leadsSummary] = await Promise.all([
    getDashboardData(),
    getLeadsSummary(),
  ]);
  return <DashboardClient data={data} leadsSummary={leadsSummary} />;
}
