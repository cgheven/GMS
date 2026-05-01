import { getStaffData } from "@/lib/data";
import { StaffClient } from "@/components/modules/staff/staff-client";

export default async function TrainersPage() {
  const data = await getStaffData();
  return <StaffClient {...data} mode="trainers" />;
}
