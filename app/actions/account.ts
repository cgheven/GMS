"use server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthContext } from "@/lib/data";

const MAX_PW_LENGTH = 72; // bcrypt hard limit
const MIN_PW_LENGTH = 8;

// In-memory failed attempt tracker per user (resets on server restart / new pod).
// Provides a basic brute-force speed bump without external state.
const failedAttempts = new Map<string, { count: number; lockedUntil: number }>();
const MAX_ATTEMPTS   = 5;
const LOCKOUT_MS     = 15 * 60 * 1000; // 15 minutes

export async function changePassword(currentPassword: string, newPassword: string) {
  if (!currentPassword || !newPassword) return { error: "All fields are required." };

  const trimmed = newPassword.trim();
  if (trimmed.length < MIN_PW_LENGTH)  return { error: "Password must be at least 8 characters." };
  if (trimmed.length > MAX_PW_LENGTH)  return { error: "Password cannot exceed 72 characters." };
  if (trimmed !== newPassword)          return { error: "Password cannot start or end with spaces." };

  const ctx = await getAuthContext();
  if (!ctx?.user || !ctx.gymId) return { error: "Unauthorized" };
  if (ctx.isDemo) return { error: "Demo mode — sign up to make changes." };

  const userId = ctx.user.id;
  const email  = ctx.user.email;
  if (!email) return { error: "Unauthorized" };

  // Brute-force lockout check
  const now    = Date.now();
  const record = failedAttempts.get(userId);
  if (record && record.lockedUntil > now) {
    const minsLeft = Math.ceil((record.lockedUntil - now) / 60000);
    return { error: `Too many failed attempts. Try again in ${minsLeft} minute${minsLeft !== 1 ? "s" : ""}.` };
  }

  // Re-authenticate to verify the caller knows the current password
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { error: authErr } = await supabase.auth.signInWithPassword({ email, password: currentPassword });

  if (authErr) {
    // Increment failed attempt counter
    const attempts = (record?.count ?? 0) + 1;
    if (attempts >= MAX_ATTEMPTS) {
      failedAttempts.set(userId, { count: attempts, lockedUntil: now + LOCKOUT_MS });
      return { error: "Too many failed attempts. Account locked for 15 minutes." };
    }
    failedAttempts.set(userId, { count: attempts, lockedUntil: 0 });
    return { error: "Current password is incorrect." };
  }

  // Clear failed attempts on success
  failedAttempts.delete(userId);

  // updateUser keeps the current session alive (only invalidates other sessions).
  // admin.updateUserById would invalidate ALL sessions including the one we just created above → logout bug.
  const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
  if (updateErr) return { error: updateErr.message };

  return { success: true };
}

// Owner resets a staff member's password — no current password required.
// Verifies the staffUserId belongs to the owner's gym before updating.
export async function resetStaffPassword(staffUserId: string, newPassword: string) {
  if (!staffUserId || !newPassword) return { error: "All fields are required." };

  const trimmed = newPassword.trim();
  if (trimmed.length < MIN_PW_LENGTH) return { error: "Password must be at least 8 characters." };
  if (trimmed.length > MAX_PW_LENGTH) return { error: "Password cannot exceed 72 characters." };
  if (trimmed !== newPassword)        return { error: "Password cannot start or end with spaces." };

  const ctx = await getAuthContext();
  if (!ctx?.user || !ctx.gymId) return { error: "Unauthorized" };
  if (ctx.isDemo) return { error: "Demo mode — sign up to make changes." };

  const admin = createAdminClient();
  const gymId = ctx.gymId;

  // Verify staffUserId belongs to a staff member in this gym (across all staff types)
  const [trainerRes, smRes, cuRes] = await Promise.all([
    admin.from("pulse_staff").select("id").eq("user_id", staffUserId).eq("gym_id", gymId).maybeSingle(),
    admin.from("pulse_social_managers").select("id").eq("user_id", staffUserId).eq("gym_id", gymId).maybeSingle(),
    admin.from("pulse_compliance_users").select("id").eq("user_id", staffUserId).eq("gym_id", gymId).maybeSingle(),
  ]);

  if (!trainerRes.data && !smRes.data && !cuRes.data) return { error: "Unauthorized" };

  const { error: updateErr } = await admin.auth.admin.updateUserById(staffUserId, { password: newPassword });
  if (updateErr) return { error: updateErr.message };

  return { success: true };
}
