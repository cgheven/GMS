import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getAuthContext, getMembers, getStaffSession } from "@/lib/data";
import { hasPermission } from "@/lib/permissions";
import { Forbidden } from "@/components/forbidden";
import { MembersClient } from "@/components/modules/members/members-client";
import MembersLoading from "./loading";

export default function MembersPage() {
  return (
    <Suspense fallback={<MembersLoading />}>
      <MembersData />
    </Suspense>
  );
}

async function MembersData() {
  const owner = await getAuthContext();
  if (owner?.gymId) {
    const data = await getMembers();
    return <MembersClient {...data} />;
  }

  const staff = await getStaffSession();
  if (!staff) redirect("/login");
  if (!hasPermission(staff.permissions, "members.view_all")) {
    return <Forbidden message="You don't have permission to view members." />;
  }

  const data = await getMembers();
  return <MembersClient {...data} />;
}
