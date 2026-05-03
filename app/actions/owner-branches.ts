"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/data";

export async function createBranch(data: {
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
}): Promise<{ gymId?: string; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };
    const ctx = await getAuthContext();
    if (ctx?.isDemo) return { error: "Demo mode — sign up to make changes." };

    const admin = createAdminClient();
    // Look up branch limit + count current gyms
    const [{ data: profile }, { data: existing, count }] = await Promise.all([
      admin.from("pulse_profiles").select("branch_limit").eq("id", user.id).single(),
      admin.from("pulse_gyms").select("id", { count: "exact" }).eq("owner_id", user.id),
    ]);

    const limit = profile?.branch_limit ?? 1;
    const used = count ?? existing?.length ?? 0;

    if (used >= limit) {
      return { error: `Branch limit reached (${used}/${limit}). Contact admin to add more.` };
    }

    if (!data.name?.trim()) return { error: "Branch name is required" };

    const { data: gym, error } = await admin
      .from("pulse_gyms")
      .insert({
        owner_id: user.id,
        name: data.name.trim(),
        address: data.address?.trim() || null,
        phone: data.phone?.trim() || null,
        email: data.email?.trim() || null,
      })
      .select("id")
      .single();

    if (error) return { error: error.message };

    revalidatePath("/", "layout");
    return { gymId: gym.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to create branch" };
  }
}
