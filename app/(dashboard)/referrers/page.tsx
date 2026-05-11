import { getAuthContext, getReferrersData } from "@/lib/data";
import { Forbidden } from "@/components/forbidden";
import { ReferrersClient } from "@/components/modules/referrers/referrers-client";

export default async function ReferrersPage() {
  const owner = await getAuthContext();
  if (!owner?.gymId) {
    return <Forbidden message="Referrer management is owner-only." />;
  }
  const data = await getReferrersData();
  return <ReferrersClient {...data} />;
}
