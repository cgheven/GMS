import { createAdminClient } from "@/lib/supabase/admin";

export async function writeAuditLog(data: {
  actor_id: string;
  actor_email: string;
  action: string;
  entity: string;
  entity_id?: string;
  meta?: Record<string, unknown>;
}) {
  try {
    const admin = createAdminClient();
    await admin.from("pulse_audit_log").insert({
      actor_id: data.actor_id,
      actor_email: data.actor_email,
      action: data.action,
      entity: data.entity,
      entity_id: data.entity_id ?? null,
      meta: data.meta ?? null,
    });
  } catch {
    // Audit failures must never block the main action
  }
}
