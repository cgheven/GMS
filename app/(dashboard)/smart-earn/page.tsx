import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getAuthContext, getSmartEarnData, getStaffSession } from "@/lib/data";
import { hasPermission } from "@/lib/permissions";
import { Forbidden } from "@/components/forbidden";
import { SmartEarnClient } from "@/components/modules/smart-earn/smart-earn-client";
import SmartEarnLoading from "./loading";

export default function SmartEarnPage() {
  return (
    <Suspense fallback={<SmartEarnLoading />}>
      <SmartEarnData />
    </Suspense>
  );
}

async function SmartEarnData() {
  const owner = await getAuthContext();
  if (!owner?.gymId) {
    const staff = await getStaffSession();
    if (!staff) redirect("/login");
    if (!hasPermission(staff.permissions, "financials.view")) {
      return <Forbidden message="You don't have permission to view profit insights." />;
    }
  }
  const data = await getSmartEarnData();
  return <SmartEarnClient {...data} />;
}
