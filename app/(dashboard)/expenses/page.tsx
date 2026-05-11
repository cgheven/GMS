import { redirect } from "next/navigation";
import { getAuthContext, getExpenses, getStaffSession } from "@/lib/data";
import { hasPermission } from "@/lib/permissions";
import { Forbidden } from "@/components/forbidden";
import { ExpensesClient } from "@/components/modules/expenses/expenses-client";

export default async function ExpensesPage() {
  const owner = await getAuthContext();
  if (!owner?.gymId) {
    const staff = await getStaffSession();
    if (!staff) redirect("/login");
    if (!hasPermission(staff.permissions, "financials.view")) {
      return <Forbidden message="You don't have permission to view expenses." />;
    }
  }
  const monthFilter = new Date().toISOString().slice(0, 7);
  const data = await getExpenses(monthFilter);
  return <ExpensesClient {...data} monthFilter={monthFilter} />;
}
