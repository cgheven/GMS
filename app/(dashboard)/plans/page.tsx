import { getMembershipPlans } from "@/lib/data";
import { PlansClient } from "@/components/modules/plans/plans-client";

export default async function PlansPage() {
  const data = await getMembershipPlans();
  return <PlansClient {...data} />;
}
