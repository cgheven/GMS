"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { PublicGym } from "@/types";

export async function getPublicGyms(): Promise<{ gyms?: PublicGym[]; error?: string }> {
  try {
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("pulse_gyms")
      .select("id,owner_id,name,address,phone,email,total_capacity,city,area,maps_url,description,gym_type,amenities")
      .eq("listing_enabled", true)
      .order("name");
    if (error) throw error;

    const gyms = (data ?? []) as (Omit<PublicGym, "active_members" | "owner_name">)[];
    if (gyms.length === 0) return { gyms: [] };

    const ids      = gyms.map((g) => g.id);
    const ownerIds = [...new Set(gyms.map((g) => g.owner_id))];

    const [{ data: members }, { data: profiles }] = await Promise.all([
      admin
        .from("pulse_members")
        .select("gym_id")
        .in("gym_id", ids)
        .eq("status", "active"),
      admin
        .from("pulse_profiles")
        .select("id, full_name")
        .in("id", ownerIds),
    ]);

    const activeMap: Record<string, number> = {};
    for (const m of members ?? []) {
      activeMap[m.gym_id] = (activeMap[m.gym_id] ?? 0) + 1;
    }

    const ownerMap: Record<string, string | null> = {};
    for (const p of profiles ?? []) {
      ownerMap[p.id] = p.full_name;
    }

    return {
      gyms: gyms.map((g) => ({
        ...g,
        owner_name: ownerMap[g.owner_id] ?? null,
        active_members: activeMap[g.id] ?? 0,
      })),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to load gyms" };
  }
}

export async function joinWaitlist(
  gymId: string,
  name: string,
  phone: string,
): Promise<{ error?: string }> {
  try {
    if (!name.trim() || !phone.trim()) throw new Error("Name and phone are required");
    const admin = createAdminClient();
    const { error } = await admin
      .from("pulse_waitlist")
      .insert({ gym_id: gymId, name: name.trim(), phone: phone.trim() });
    if (error) throw error;
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to join waitlist" };
  }
}
