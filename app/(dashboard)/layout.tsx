import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/data";
import { GymProvider } from "@/contexts/gym-context";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAuthContext();
  if (!ctx?.user) redirect("/login");

  return (
    <GymProvider profile={ctx.profile} gym={ctx.gym} gyms={ctx.gyms ?? []}>
      <DashboardShell>{children}</DashboardShell>
    </GymProvider>
  );
}
