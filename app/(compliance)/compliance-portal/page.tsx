import { redirect } from "next/navigation";
import { getCompliancePageData } from "@/lib/data";
import { CompliancePortalClient } from "@/components/modules/compliance/compliance-portal-client";

export const metadata = { title: "Compliance Report | Pulse" };

export default async function CompliancePortalPage() {
  const data = await getCompliancePageData();
  if (!data) redirect("/login");
  return (
    <CompliancePortalClient
      gymName={data.gymName}
      members={data.members}
      pctSelf={data.pctSelf}
      pctPt={data.pctPt}
      totalSelf={data.totalSelf}
      totalPt={data.totalPt}
      shownRevenue={data.shownRevenue}
    />
  );
}
