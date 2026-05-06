import { getSmartEarnData } from "@/lib/data";
import { SmartEarnClient } from "@/components/modules/smart-earn/smart-earn-client";

export default async function SmartEarnPage() {
  const data = await getSmartEarnData();
  return <SmartEarnClient {...data} />;
}
