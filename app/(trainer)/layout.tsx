import { redirect } from "next/navigation";
import { getTrainerContext } from "@/lib/data";
import { TrainerShell } from "@/components/layout/trainer-shell";

export default async function TrainerLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getTrainerContext();
  if (!ctx) redirect("/login");

  return <TrainerShell staff={ctx.staff}>{children}</TrainerShell>;
}
