import { getComplianceReportData } from "@/lib/data";
import { ComplianceClient } from "@/components/modules/reports/compliance-client";

export default async function CompliancePage() {
  const data = await getComplianceReportData();
  if (!data) return <div className="p-8 text-muted-foreground">No gym selected.</div>;
  return <ComplianceClient {...data} />;
}
