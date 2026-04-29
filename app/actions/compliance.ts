"use server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthContext } from "@/lib/data";
import { writeAuditLog } from "@/lib/audit";

interface SaveSettingsInput {
  ntn?: string | null;
  fields?: string[];
  notes?: string | null;
  headerTitle?: string | null;
  taxRate?: number | null;
  taxInclusive?: boolean;
  taxLabel?: string | null;
}

export async function saveComplianceSettings(input: SaveSettingsInput) {
  const ctx = await getAuthContext();
  if (!ctx?.gymId) return { error: "Unauthorized" };
  const admin = createAdminClient();
  const reportSettings: Record<string, unknown> = {};
  if (input.fields !== undefined)       reportSettings.fields = input.fields;
  if (input.notes !== undefined)        reportSettings.notes = input.notes;
  if (input.headerTitle !== undefined)  reportSettings.headerTitle = input.headerTitle;
  if (input.taxRate !== undefined)      reportSettings.taxRate = input.taxRate;
  if (input.taxInclusive !== undefined) reportSettings.taxInclusive = input.taxInclusive;
  if (input.taxLabel !== undefined)     reportSettings.taxLabel = input.taxLabel;

  const { error } = await admin
    .from("pulse_gyms")
    .update({
      ...(input.ntn !== undefined ? { ntn: input.ntn } : {}),
      report_settings: reportSettings,
    })
    .eq("id", ctx.gymId);
  if (error) return { error: error.message };
  return { success: true };
}

interface LogReportInput {
  memberCount: number;
  totalRevenue: number;
  startDate: string;
  endDate: string;
  fields: string[];
}

export async function logComplianceReport(input: LogReportInput) {
  const ctx = await getAuthContext();
  if (!ctx?.gymId || !ctx.user) return { error: "Unauthorized" };
  await writeAuditLog({
    actor_id: ctx.user.id,
    actor_email: ctx.user.email ?? "",
    action: "compliance.report.generated",
    entity: "gym",
    entity_id: ctx.gymId,
    meta: {
      member_count: input.memberCount,
      total_revenue: input.totalRevenue,
      period: `${input.startDate} → ${input.endDate}`,
      fields: input.fields,
    },
  });
  return { success: true };
}
