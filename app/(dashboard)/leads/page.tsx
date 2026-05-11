import { redirect } from "next/navigation";
import { getAuthContext, getLeadsData, getStaffSession } from "@/lib/data";
import { hasPermission } from "@/lib/permissions";
import { Forbidden } from "@/components/forbidden";
import { LeadsClient } from "@/components/modules/leads/leads-client";

export default async function LeadsPage() {
  const owner = await getAuthContext();
  if (!owner?.gymId) {
    const staff = await getStaffSession();
    if (!staff) redirect("/login");
    if (!hasPermission(staff.permissions, "leads.view")) {
      return <Forbidden message="You don't have permission to view leads." />;
    }
  }
  const data = await getLeadsData();
  return <LeadsClient {...data} />;
}
