import { getAdminGyms } from "@/app/actions/admin-gyms";
import { GymsClient } from "@/components/modules/admin/gyms-client";

export default async function AdminGymsPage() {
  const data = await getAdminGyms();
  return <GymsClient data={data} />;
}
