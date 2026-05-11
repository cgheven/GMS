import { redirect } from "next/navigation";
import { getAuthContext, getPaymentsData, getStaffSession } from "@/lib/data";
import { hasPermission } from "@/lib/permissions";
import { Forbidden } from "@/components/forbidden";
import { PaymentsClient } from "@/components/modules/payments/payments-client";

export default async function PaymentsPage() {
  const owner = await getAuthContext();
  if (!owner?.gymId) {
    const staff = await getStaffSession();
    if (!staff) redirect("/login");
    if (
      !hasPermission(staff.permissions, "payments.view") &&
      !hasPermission(staff.permissions, "payments.create")
    ) {
      return <Forbidden message="You don't have permission to view payments." />;
    }
  }
  const data = await getPaymentsData();
  return <PaymentsClient {...data} />;
}
