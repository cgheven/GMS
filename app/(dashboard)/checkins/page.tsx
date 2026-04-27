import { getCheckIns } from "@/lib/data";
import { CheckInsClient } from "@/components/modules/checkins/checkins-client";

export default async function CheckInsPage() {
  const data = await getCheckIns();
  return <CheckInsClient {...data} />;
}
