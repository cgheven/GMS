import { getDashboardData, getLeadsSummary } from "@/lib/data";
import { DashboardClient } from "@/components/modules/dashboard/dashboard-client";

export default async function DashboardPage() {
  const [data, leadsSummary] = await Promise.all([
    getDashboardData(),
    getLeadsSummary(),
  ]);
  return <DashboardClient data={data} leadsSummary={leadsSummary} />;
}
