"use server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthContext } from "@/lib/data";

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
