import { redirect } from "next/navigation";
import { getComplianceContext } from "@/lib/data";
import { ComplianceShell } from "@/components/layout/compliance-shell";

export default async function ComplianceLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getComplianceContext();
  if (!ctx) redirect("/login");
  return (
    <ComplianceShell gymName={ctx.gymName} fullName={ctx.complianceUser.full_name}>
      {children}
    </ComplianceShell>
  );
}
