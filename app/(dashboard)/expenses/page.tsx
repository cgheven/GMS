import { getExpenses } from "@/lib/data";
import { ExpensesClient } from "@/components/modules/expenses/expenses-client";

export default async function ExpensesPage() {
  const monthFilter = new Date().toISOString().slice(0, 7);
  const data = await getExpenses(monthFilter);
  return <ExpensesClient {...data} monthFilter={monthFilter} />;
}
