"use server";
import { revalidateTag } from "next/cache";
import { getAuthContext } from "@/lib/data";

export async function revalidatePayments() {
  const ctx = await getAuthContext();
  if (ctx?.gymId) revalidateTag(`payments-${ctx.gymId}`);
}
