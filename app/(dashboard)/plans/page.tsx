import { getMembershipPlans } from "@/lib/data";
import { PlansClient } from "@/components/modules/plans/plans-client";

export default async function PlansPage() {
  const data = await getMembershipPlans();
  return (
    <>
      {/* DEBUG — remove after fix */}
      <p className="text-xs text-muted-foreground px-6 pt-3">gymId: {data.gymId ?? "NULL"}</p>
      <PlansClient {...data} />
    </>
  );
}
