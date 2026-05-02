import { getReferrersData } from "@/lib/data";
import { ReferrersClient } from "@/components/modules/referrers/referrers-client";

export default async function ReferrersPage() {
  const data = await getReferrersData();
  return <ReferrersClient {...data} />;
}
