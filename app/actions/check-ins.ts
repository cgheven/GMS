"use server";
import { revalidateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthContext, getStaffSession } from "@/lib/data";
import { hasPermission, type PermissionKey } from "@/lib/permissions";
import { writeAuditLog } from "@/lib/audit";

/**
 * Authorize a check-in mutation: owner OR non-owner staff with the
 * given permission. Owners always pass (demo blocked). Trainer flow is
 * unaffected — trainers use checkInMemberAsTrainer on /trainer.
 */
async function requireOwnerOrPermission(perm: PermissionKey) {
  const owner = await getAuthContext();
  if (owner?.user && owner.gymId && !owner.isDemo) {
    return {
      gymId: owner.gymId as string,
      user: owner.user,
      isOwner: true as const,
      staffId: null as string | null,
    };
  }
  const staff = await getStaffSession();
  if (staff && hasPermission(staff.permissions, perm)) {
    return {
      gymId: staff.gymId,
      user: staff.user,
      isOwner: false as const,
      staffId: staff.staffId,
    };
  }
  return null;
}

/**
 * Manually record a check-in for a member. Routes through admin client
 * so non-owner staff with the `checkins.record` permission can write
 * even though RLS blocks them directly.
 */
export async function recordCheckIn(memberId: string) {
  const ctx = await requireOwnerOrPermission("checkins.record");
  if (!ctx) return { error: "Unauthorized" };
  const admin = createAdminClient();

  // Verify member belongs to this gym (tenant guard)
  const { data: member } = await admin
    .from("pulse_members")
    .select("id, full_name, gym_id")
    .eq("id", memberId)
    .eq("gym_id", ctx.gymId)
    .single();
  if (!member) return { error: "Member not found" };

  const { data, error } = await admin
    .from("pulse_check_ins")
    .insert({
      gym_id: ctx.gymId,
      member_id: memberId,
      check_in_method: "manual",
    })
    .select("*, member:pulse_members(full_name,photo_url,member_number,status,assigned_trainer_id,trainer:pulse_staff(full_name))")
    .single();
  if (error) return { error: error.message };

  await writeAuditLog({
    actor_id: ctx.user.id,
    actor_email: ctx.user.email ?? "",
    action: "checkin.record",
    entity: "check_in",
    entity_id: data.id,
    meta: {
      member_id: memberId,
      member_name: member.full_name,
      by_role: ctx.isOwner ? "owner" : "staff",
    },
  });
  revalidateTag(`dashboard-${ctx.gymId}`);
  return { success: true, checkIn: data };
}
