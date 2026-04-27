import { getBills } from "@/lib/data";
import { BillsClient } from "@/components/modules/bills/bills-client";

export default async function BillsPage() {
  const data = await getBills();
  return <BillsClient {...data} />;
}
