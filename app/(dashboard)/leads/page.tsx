import { getLeadsData } from "@/lib/data";
import { LeadsClient } from "@/components/modules/leads/leads-client";

export default async function LeadsPage() {
  const data = await getLeadsData();
  return <LeadsClient {...data} />;
}
