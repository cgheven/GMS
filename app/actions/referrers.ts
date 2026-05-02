"use server";
import { revalidateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthContext } from "@/lib/data";
import { writeAuditLog } from "@/lib/audit";
import type { ReferrerCommissionType } from "@/types";

async function requireOwner() {
  const ctx = await getAuthContext();
  if (!ctx?.user || !ctx.gymId) return null;
  return ctx;
}

export async function createReferrer(payload: {
  full_name: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  commission_type: ReferrerCommissionType;
  commission_value: number;
}) {
  const ctx = await requireOwner();
  if (!ctx) return { error: "Unauthorized" };
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("pulse_referrers")
    .insert({ gym_id: ctx.gymId, ...payload })
    .select("id")
    .single();
  if (error) return { error: error.message };
  await writeAuditLog({ actor_id: ctx.user.id, actor_email: ctx.user.email ?? "", action: "referrer.create", entity: "referrer", entity_id: data.id, meta: { full_name: payload.full_name } });
  revalidateTag(`referrers-${ctx.gymId}`);
  return { success: true, id: data.id };
}

export async function updateReferrer(referrerId: string, payload: {
  full_name: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  commission_type: ReferrerCommissionType;
  commission_value: number;
  status: "active" | "inactive";
}) {
  const ctx = await requireOwner();
  if (!ctx) return { error: "Unauthorized" };
  const admin = createAdminClient();
  const { error } = await admin
    .from("pulse_referrers")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", referrerId)
    .eq("gym_id", ctx.gymId);
  if (error) return { error: error.message };
  revalidateTag(`referrers-${ctx.gymId}`);
  return { success: true };
}

export async function deleteReferrer(referrerId: string) {
  const ctx = await requireOwner();
  if (!ctx) return { error: "Unauthorized" };
  const admin = createAdminClient();

  const { data: referrer } = await admin
    .from("pulse_referrers")
    .select("id, full_name, user_id")
    .eq("id", referrerId)
    .eq("gym_id", ctx.gymId)
    .single();

  if (!referrer) return { error: "Referrer not found" };

  const { count: pendingCount } = await admin
    .from("pulse_referrals")
    .select("id", { count: "exact", head: true })
    .eq("referrer_id", referrerId)
    .eq("status", "pending");

  if (pendingCount && pendingCount > 0) {
    return { blocked: "has_pending_commissions" as const, count: pendingCount };
  }

  if (referrer.user_id) {
    await admin.auth.admin.deleteUser(referrer.user_id);
  }

  const { error } = await admin.from("pulse_referrers").delete().eq("id", referrerId);
  if (error) return { error: error.message };

  await writeAuditLog({ actor_id: ctx.user.id, actor_email: ctx.user.email ?? "", action: "referrer.delete", entity: "referrer", entity_id: referrerId, meta: { full_name: referrer.full_name } });
  revalidateTag(`referrers-${ctx.gymId}`);
  return { success: true };
}

export async function createReferrerLogin(referrerId: string, email: string, password: string) {
  const ctx = await requireOwner();
  if (!ctx) return { error: "Unauthorized" };
  if (!email.endsWith("@musabkhan.me")) return { error: "Email must use @musabkhan.me domain" };

  const admin = createAdminClient();
  const { data: referrer } = await admin
    .from("pulse_referrers")
    .select("id, full_name, user_id")
    .eq("id", referrerId)
    .eq("gym_id", ctx.gymId)
    .single();

  if (!referrer) return { error: "Referrer not found" };
  if (referrer.user_id) return { error: "Login already exists" };

  const { data: newUser, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: referrer.full_name, role: "referrer" },
  });
  if (authErr) return { error: authErr.message };

  await admin.from("pulse_referrers").update({ user_id: newUser.user.id, email, updated_at: new Date().toISOString() }).eq("id", referrerId);
  revalidateTag(`referrers-${ctx.gymId}`);
  return { success: true, userId: newUser.user.id };
}

export async function removeReferrerLogin(referrerId: string) {
  const ctx = await requireOwner();
  if (!ctx) return { error: "Unauthorized" };
  const admin = createAdminClient();
  const { data: referrer } = await admin
    .from("pulse_referrers")
    .select("id, user_id")
    .eq("id", referrerId)
    .eq("gym_id", ctx.gymId)
    .single();

  if (!referrer?.user_id) return { error: "No login exists" };
  await admin.auth.admin.deleteUser(referrer.user_id);
  await admin.from("pulse_referrers").update({ user_id: null, updated_at: new Date().toISOString() }).eq("id", referrerId);
  revalidateTag(`referrers-${ctx.gymId}`);
  return { success: true };
}

export async function markReferralPaid(referralId: string) {
  const ctx = await requireOwner();
  if (!ctx) return { error: "Unauthorized" };
  const admin = createAdminClient();
  const { error } = await admin
    .from("pulse_referrals")
    .update({ status: "paid", paid_at: new Date().toISOString(), paid_by: ctx.user.id })
    .eq("id", referralId)
    .eq("gym_id", ctx.gymId);
  if (error) return { error: error.message };
  revalidateTag(`referrers-${ctx.gymId}`);
  return { success: true };
}
