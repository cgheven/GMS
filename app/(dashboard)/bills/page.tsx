import { redirect } from "next/navigation";
import { getAuthContext, getBills, getStaffSession } from "@/lib/data";
import { hasPermission } from "@/lib/permissions";
import { Forbidden } from "@/components/forbidden";
import { BillsClient } from "@/components/modules/bills/bills-client";

export default async function BillsPage() {
  const owner = await getAuthContext();
  if (!owner?.gymId) {
    const staff = await getStaffSession();
    if (!staff) redirect("/login");
    if (!hasPermission(staff.permissions, "financials.view")) {
      return <Forbidden message="You don't have permission to view bills." />;
    }
  }
  const data = await getBills();
  return <BillsClient {...data} />;
}
