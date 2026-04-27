import { getPaymentsData } from "@/lib/data";
import { PaymentsClient } from "@/components/modules/payments/payments-client";

export default async function PaymentsPage() {
  const data = await getPaymentsData();
  return <PaymentsClient {...data} />;
}
