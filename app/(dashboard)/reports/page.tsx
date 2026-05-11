import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getAuthContext, getReportsData, getStaffSession } from "@/lib/data";
import { hasPermission } from "@/lib/permissions";
import { Forbidden } from "@/components/forbidden";
import { ReportsClient } from "@/components/modules/reports/reports-client";
import ReportsLoading from "./loading";

export const metadata = { title: "Reports | Pulse" };

export default function ReportsPage() {
  return (
    <Suspense fallback={<ReportsLoading />}>
      <ReportsData />
    </Suspense>
  );
}

async function ReportsData() {
  const owner = await getAuthContext();
  if (!owner?.gymId) {
    const staff = await getStaffSession();
    if (!staff) redirect("/login");
    if (!hasPermission(staff.permissions, "reports.view")) {
      return <Forbidden message="You don't have permission to view reports." />;
    }
  }
  const data = await getReportsData();
  return <ReportsClient data={data} />;
}
