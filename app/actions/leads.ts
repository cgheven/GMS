"use server";
import { revalidateTag } from "next/cache";
import { getAuthContext } from "@/lib/data";
import { createAdminClient } from "@/lib/supabase/admin";
import type { LeadSource, LeadStatus, LeadLostReason, LeadActivityType } from "@/types";

type LeadInput = {
  full_name: string;
  phone?: string | null;
  email?: string | null;
  source: LeadSource;
  source_detail?: string | null;
  interested_plan_id?: string | null;
  fitness_goals?: string | null;
  next_followup_at?: string | null;
  assigned_to?: string | null;
  notes?: string | null;
};

async function requireOwnerCtx() {
  const ctx = await getAuthContext();
  if (!ctx?.gymId || ctx.isDemo) return null;
  return ctx;
}

function bumpDashboard(gymId: string | null | undefined) {
  if (!gymId) return;
  revalidateTag(`dashboard-${gymId}`);
}

// ── Create / update / delete ─────────────────────────────────────────────────

export async function createLead(payload: LeadInput) {
  const ctx = await requireOwnerCtx();
  if (!ctx) return { error: "Unauthorized" };
  if (!payload.full_name?.trim()) return { error: "Name is required" };

  const admin = createAdminClient();
  const { data: lead, error } = await admin
    .from("pulse_leads")
    .insert({
      gym_id: ctx.gymId,
      full_name: payload.full_name.trim(),
      phone: payload.phone?.trim() || null,
      email: payload.email?.trim() || null,
      source: payload.source,
      source_detail: payload.source_detail?.trim() || null,
      interested_plan_id: payload.interested_plan_id || null,
      fitness_goals: payload.fitness_goals?.trim() || null,
      next_followup_at: payload.next_followup_at || null,
      assigned_to: payload.assigned_to || null,
      notes: payload.notes?.trim() || null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  bumpDashboard(ctx.gymId);
  return { success: true, leadId: lead.id };
}

export async function updateLead(leadId: string, payload: Partial<LeadInput>) {
  const ctx = await requireOwnerCtx();
  if (!ctx) return { error: "Unauthorized" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("pulse_leads")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", leadId)
    .eq("gym_id", ctx.gymId);
  if (error) return { error: error.message };

  bumpDashboard(ctx.gymId);
  return { success: true };
}

export async function deleteLead(leadId: string) {
  const ctx = await requireOwnerCtx();
  if (!ctx) return { error: "Unauthorized" };

  const admin = createAdminClient();
  const { error } = await admin.from("pulse_leads").delete().eq("id", leadId).eq("gym_id", ctx.gymId);
  if (error) return { error: error.message };

  bumpDashboard(ctx.gymId);
  return { success: true };
}

// ── Status transitions ───────────────────────────────────────────────────────

export async function setLeadStatus(leadId: string, status: LeadStatus) {
  const ctx = await requireOwnerCtx();
  if (!ctx) return { error: "Unauthorized" };

  const admin = createAdminClient();
  const { data: { user } } = await ctx.supabase.auth.getUser();

  const { error } = await admin
    .from("pulse_leads")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", leadId)
    .eq("gym_id", ctx.gymId);
  if (error) return { error: error.message };

  await admin.from("pulse_lead_activities").insert({
    lead_id: leadId,
    type: "status_change",
    content: `Status → ${status}`,
    created_by: user?.id ?? null,
  });

  bumpDashboard(ctx.gymId);
  return { success: true };
}

export async function markLeadLost(leadId: string, reason: LeadLostReason, note?: string) {
  const ctx = await requireOwnerCtx();
  if (!ctx) return { error: "Unauthorized" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("pulse_leads")
    .update({
      status: "lost",
      lost_reason: reason,
      lost_note: note ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", leadId)
    .eq("gym_id", ctx.gymId);
  if (error) return { error: error.message };

  await admin.from("pulse_lead_activities").insert({
    lead_id: leadId,
    type: "status_change",
    content: `Marked lost: ${reason}${note ? ` — ${note}` : ""}`,
  });

  bumpDashboard(ctx.gymId);
  return { success: true };
}

// ── Activity log ─────────────────────────────────────────────────────────────

export async function logLeadActivity(leadId: string, type: LeadActivityType, content?: string) {
  const ctx = await requireOwnerCtx();
  if (!ctx) return { error: "Unauthorized" };

  const admin = createAdminClient();
  const { data: { user } } = await ctx.supabase.auth.getUser();

  // Verify lead belongs to this gym
  const { data: lead } = await admin
    .from("pulse_leads")
    .select("id, gym_id")
    .eq("id", leadId)
    .single();
  if (!lead || lead.gym_id !== ctx.gymId) return { error: "Lead not found" };

  const { error } = await admin.from("pulse_lead_activities").insert({
    lead_id: leadId,
    type,
    content: content?.trim() || null,
    created_by: user?.id ?? null,
  });
  if (error) return { error: error.message };

  // Touch the lead so "last contact" shifts
  await admin
    .from("pulse_leads")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", leadId);

  return { success: true };
}

// ── Convert lead → member ────────────────────────────────────────────────────

type ConvertPayload = {
  plan_id: string | null;
  monthly_fee: number;
  admission_fee: number;
  admission_paid: boolean;
  join_date: string;
  plan_expiry_date: string | null;
  assigned_trainer_id?: string | null;
};

export async function convertLeadToMember(leadId: string, payload: ConvertPayload) {
  const ctx = await requireOwnerCtx();
  if (!ctx) return { error: "Unauthorized" };

  const admin = createAdminClient();
  const { data: lead } = await admin
    .from("pulse_leads")
    .select("*")
    .eq("id", leadId)
    .eq("gym_id", ctx.gymId)
    .single();
  if (!lead) return { error: "Lead not found" };

  const outstanding = payload.admission_paid ? 0 : payload.admission_fee;
  const { data: member, error } = await admin
    .from("pulse_members")
    .insert({
      gym_id: ctx.gymId,
      assigned_trainer_id: payload.assigned_trainer_id ?? null,
      full_name: lead.full_name,
      phone: lead.phone,
      email: lead.email,
      plan_id: payload.plan_id,
      monthly_fee: payload.monthly_fee,
      admission_fee: payload.admission_fee,
      join_date: payload.join_date,
      plan_expiry_date: payload.plan_expiry_date,
      status: "active",
      outstanding_balance: outstanding,
      notes: lead.fitness_goals ? `Goal: ${lead.fitness_goals}` : null,
    })
    .select("id")
    .single();
  if (error || !member) return { error: error?.message ?? "Failed to create member" };

  if (payload.admission_paid && payload.admission_fee > 0) {
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

  await admin
    .from("pulse_leads")
    .update({
      status: "won",
      converted_member_id: member.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", leadId);

  await admin.from("pulse_lead_activities").insert({
    lead_id: leadId,
    type: "status_change",
    content: "Converted to member 🎉",
  });

  if (ctx.gymId) revalidateTag(`members-${ctx.gymId}`);
  bumpDashboard(ctx.gymId);
  return { success: true, memberId: member.id };
}
