import { getAuthContext, getStaffData } from "@/lib/data";
import { Forbidden } from "@/components/forbidden";
import { StaffClient } from "@/components/modules/staff/staff-client";

export default async function TrainersPage() {
  const owner = await getAuthContext();
  if (!owner?.gymId) {
    return <Forbidden message="Trainer management is owner-only." />;
  }
  const data = await getStaffData();
  return <StaffClient {...data} mode="trainers" />;
}
