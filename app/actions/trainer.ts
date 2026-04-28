"use server";
import { revalidateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthContext, getTrainerContext } from "@/lib/data";

export async function createTrainerLogin(staffId: string, email: string, password: string) {
  const ctx = await getAuthContext();
  if (!ctx?.gymId) return { error: "Unauthorized" };

  const admin = createAdminClient();

  const { data: staff, error: staffErr } = await admin
    .from("pulse_staff")
    .select("id, full_name, gym_id, user_id")
    .eq("id", staffId)
    .eq("gym_id", ctx.gymId)
    .single();

  if (staffErr || !staff) return { error: "Staff not found" };
  if (staff.user_id) return { error: "Login already exists for this trainer" };

  const { data: newUser, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: staff.full_name, role: "trainer" },
  });

  if (authErr) return { error: authErr.message };

  const userId = newUser.user.id;

  // Trigger already created the profile with role='trainer' — just link staff
  await admin.from("pulse_staff").update({ user_id: userId }).eq("id", staffId);

  return { success: true };
}

type MemberPayload = {
  full_name: string;
  phone: string;
  cnic?: string | null;
  email?: string | null;
  gender?: string | null;
  date_of_birth?: string | null;
  emergency_contact?: string | null;
  address?: string | null;
  plan_id: string | null;
  monthly_fee: number;
  admission_fee: number;
  admission_fee_paid: boolean;
  join_date: string;
  plan_expiry_date: string | null;
  notes?: string | null;
  assigned_trainer_id?: string | null;
};

async function resolveTrainerAssignment(gymId: string, fallbackId: string, requested?: string | null) {
  if (requested === null) return null; // Gym Only
  if (!requested) return fallbackId;
  const admin = createAdminClient();
  const { data } = await admin
    .from("pulse_staff")
    .select("id")
    .eq("id", requested)
    .eq("gym_id", gymId)
    .eq("status", "active")
    .eq("role", "trainer")
    .maybeSingle();
  return data?.id ?? fallbackId;
}

export async function createMemberAsTrainer(payload: MemberPayload) {
  const ctx = await getTrainerContext();
  if (!ctx) return { error: "Unauthorized" };
  if (!ctx.staff.can_add_members) return { error: "Permission denied" };

  const admin = createAdminClient();
  const outstanding = payload.admission_fee_paid ? 0 : payload.admission_fee;
  const trainerId = await resolveTrainerAssignment(ctx.gymId, ctx.staff.id, payload.assigned_trainer_id);

  const { data: member, error } = await admin
    .from("pulse_members")
    .insert({
      gym_id: ctx.gymId,
      assigned_trainer_id: trainerId,
      full_name: payload.full_name,
      phone: payload.phone,
      cnic: payload.cnic ?? null,
      email: payload.email ?? null,
      gender: payload.gender ?? null,
      date_of_birth: payload.date_of_birth ?? null,
      emergency_contact: payload.emergency_contact ?? null,
      address: payload.address ?? null,
      plan_id: payload.plan_id,
      monthly_fee: payload.monthly_fee,
      admission_fee: payload.admission_fee,
      join_date: payload.join_date,
      plan_expiry_date: payload.plan_expiry_date,
      status: "active",
      outstanding_balance: outstanding,
      notes: payload.notes ?? null,
    })
    .select("id")
    .single();

  if (error || !member) return { error: error?.message ?? "Failed to create member" };

  // Auto-record admission payment if marked paid at onboarding
  if (payload.admission_fee_paid && payload.admission_fee > 0) {
    await admin.from("pulse_payments").insert({
      gym_id: ctx.gymId,
      member_id: member.id,
      plan_id: payload.plan_id,
      amount: payload.admission_fee,
      total_amount: payload.admission_fee,
      payment_method: "cash",
      payment_date: payload.join_date,
      for_period: "admission",
      status: "paid",
    });
  }

  revalidateTag(`members-${ctx.gymId}`);
  revalidateTag(`dashboard-${ctx.gymId}`);
  return { success: true, memberId: member.id };
}

type UpdatePayload = {
  full_name: string;
  phone: string;
  email?: string | null;
  cnic?: string | null;
  plan_id: string | null;
  monthly_fee: number;
  admission_fee: number;
  join_date: string;
  plan_expiry_date: string | null;
  notes?: string | null;
  assigned_trainer_id?: string | null;
};

export async function updateMemberAsTrainer(memberId: string, payload: UpdatePayload) {
  const ctx = await getTrainerContext();
  if (!ctx) return { error: "Unauthorized" };
  if (!ctx.staff.can_add_members) return { error: "Permission denied" };

  const admin = createAdminClient();

  // Trainer with onboarding perm can edit own members + SELF (no assigned trainer) members in same gym.
  const { data: existing } = await admin
    .from("pulse_members")
    .select("id, assigned_trainer_id, gym_id")
    .eq("id", memberId)
    .single();

  const ownsMember = existing?.assigned_trainer_id === ctx.staff.id;
  const isSelfClient = existing?.assigned_trainer_id === null;
  if (!existing || existing.gym_id !== ctx.gymId || (!ownsMember && !isSelfClient)) {
    return { error: "Member not found or not editable by you" };
  }

  const trainerId = payload.assigned_trainer_id === undefined
    ? existing.assigned_trainer_id
    : await resolveTrainerAssignment(ctx.gymId, ctx.staff.id, payload.assigned_trainer_id);

  const { error } = await admin
    .from("pulse_members")
    .update({
      full_name: payload.full_name,
      phone: payload.phone,
      email: payload.email ?? null,
      cnic: payload.cnic ?? null,
      plan_id: payload.plan_id,
      monthly_fee: payload.monthly_fee,
      admission_fee: payload.admission_fee,
      join_date: payload.join_date,
      plan_expiry_date: payload.plan_expiry_date,
      notes: payload.notes ?? null,
      assigned_trainer_id: trainerId,
    })
    .eq("id", memberId);

  if (error) return { error: error.message };

  revalidateTag(`members-${ctx.gymId}`);
  revalidateTag(`dashboard-${ctx.gymId}`);
  return { success: true };
}

export async function checkInMemberAsTrainer(memberId: string) {
  const ctx = await getTrainerContext();
  if (!ctx) return { error: "Unauthorized" };

  const admin = createAdminClient();

  // Verify member is assigned to this trainer
  const { data: member } = await admin
    .from("pulse_members")
    .select("id, gym_id, assigned_trainer_id")
    .eq("id", memberId)
    .single();

  if (!member || member.assigned_trainer_id !== ctx.staff.id || member.gym_id !== ctx.gymId) {
    return { error: "Member not found or not assigned to you" };
  }

  // Block duplicate check-in same day
  const today = new Date();
  const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const dayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

  const { data: existing } = await admin
    .from("pulse_check_ins")
    .select("id")
    .eq("member_id", memberId)
    .gte("checked_in_at", dayStart)
    .lt("checked_in_at", dayEnd)
    .maybeSingle();

  if (existing) return { error: "Already checked in today" };

  const { data: row, error } = await admin
    .from("pulse_check_ins")
    .insert({
      gym_id: ctx.gymId,
      member_id: memberId,
      check_in_method: "manual",
    })
    .select("id, checked_in_at")
    .single();

  if (error) return { error: error.message };

  revalidateTag(`dashboard-${ctx.gymId}`);
  return { success: true, checkIn: row };
}

export async function removeTrainerLogin(staffId: string) {
  const ctx = await getAuthContext();
  if (!ctx?.gymId) return { error: "Unauthorized" };

  const admin = createAdminClient();

  const { data: staff } = await admin
    .from("pulse_staff")
    .select("id, user_id, gym_id")
    .eq("id", staffId)
    .eq("gym_id", ctx.gymId)
    .single();

  if (!staff?.user_id) return { error: "No login exists" };

  await admin.auth.admin.deleteUser(staff.user_id);
  await admin.from("pulse_staff").update({ user_id: null }).eq("id", staffId);

  return { success: true };
}
