import { redirect } from "next/navigation";
import { getAuthContext, getDashboardData, getStaffSession } from "@/lib/data";
import { hasPermission } from "@/lib/permissions";
import { Forbidden } from "@/components/forbidden";
import { LeaderboardClient } from "@/components/modules/leaderboard/leaderboard-client";

export default async function LeaderboardPage() {
  const owner = await getAuthContext();
  if (!owner?.gymId) {
    const staff = await getStaffSession();
    if (!staff) redirect("/login");
    if (!hasPermission(staff.permissions, "reports.view")) {
      return <Forbidden message="You don't have permission to view the leaderboard." />;
    }
  }
  const data = await getDashboardData();
  return <LeaderboardClient data={data} />;
}
