import { redirect } from "next/navigation";
import { getTrainerPageData } from "@/lib/data";
import { TrainerClient } from "@/components/modules/trainer/trainer-client";

export default async function TrainerPage() {
  const data = await getTrainerPageData();
  if (!data) redirect("/login");
  return <TrainerClient {...data} />;
}
