import { redirect } from "next/navigation";
import { getAuthContext, getComplianceReportData, getStaffSession } from "@/lib/data";
import { hasPermission } from "@/lib/permissions";
import { Forbidden } from "@/components/forbidden";
import { ComplianceClient } from "@/components/modules/reports/compliance-client";

export default async function CompliancePage() {
  const owner = await getAuthContext();
  if (!owner?.gymId) {
    const staff = await getStaffSession();
    if (!staff) redirect("/login");
    if (!hasPermission(staff.permissions, "reports.view")) {
      return <Forbidden message="You don't have permission to view compliance reports." />;
    }
  }
  const data = await getComplianceReportData();
  if (!data) return <div className="p-8 text-muted-foreground">No gym selected.</div>;
  return <ComplianceClient {...data} />;
}
