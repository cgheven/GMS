import { getAuthContext, getMembershipPlans } from "@/lib/data";
import { Forbidden } from "@/components/forbidden";
import { PlansClient } from "@/components/modules/plans/plans-client";

export default async function PlansPage() {
  const owner = await getAuthContext();
  if (!owner?.gymId) {
    return <Forbidden message="Membership plans are owner-only." />;
  }
  const data = await getMembershipPlans();
  return <PlansClient {...data} />;
}
