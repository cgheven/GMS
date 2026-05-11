import { redirect } from "next/navigation";
import { getAuthContext, getCheckIns, getStaffSession } from "@/lib/data";
import { hasPermission } from "@/lib/permissions";
import { Forbidden } from "@/components/forbidden";
import { CheckInsClient } from "@/components/modules/check-ins/check-ins-client";

export default async function CheckInsPage() {
  const owner = await getAuthContext();
  if (!owner?.gymId) {
    const staff = await getStaffSession();
    if (!staff) redirect("/login");
    if (!hasPermission(staff.permissions, "checkins.record")) {
      return <Forbidden message="You don't have permission to record check-ins." />;
    }
  }
  const data = await getCheckIns();
  return <CheckInsClient {...data} />;
}
