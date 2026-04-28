import { getDashboardData } from "@/lib/data";
import { LeaderboardClient } from "@/components/modules/leaderboard/leaderboard-client";

export default async function LeaderboardPage() {
  const data = await getDashboardData();
  return <LeaderboardClient data={data} />;
}
