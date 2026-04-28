"use server";
import { revalidateTag } from "next/cache";
import { getAuthContext } from "@/lib/data";

export async function revalidatePayments() {
  const ctx = await getAuthContext();
  if (!ctx?.gymId) return;
  // A payment touches dashboard stats + reports + members outstanding balance.
  revalidateTag(`payments-${ctx.gymId}`);
  revalidateTag(`dashboard-${ctx.gymId}`);
  revalidateTag(`reports-${ctx.gymId}`);
  revalidateTag(`members-${ctx.gymId}`);
}
