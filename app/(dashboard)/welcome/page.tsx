import { redirect } from "next/navigation";
import { getAuthContext, getQuickSetupStatus, getStaffSession } from "@/lib/data";
import { QuickSetupClient } from "@/components/modules/welcome/quick-setup-client";

export const metadata = { title: "Quick Setup | Pulse" };

export default async function WelcomePage() {
  // Owner-only: Quick Setup configures the branch (plans, payment methods, etc.).
  const owner = await getAuthContext();
  if (!owner?.gymId) {
    const staff = await getStaffSession();
    if (!staff) redirect("/login");
    redirect("/members");
  }
  const status = await getQuickSetupStatus();
  if (!status) redirect("/dashboard");
  return <QuickSetupClient status={status} />;
}
