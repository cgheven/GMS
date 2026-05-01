"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ResearchInput {
  // Contact
  owner_name?: string;
  gym_name?: string;
  city?: string;
  phone?: string;
  email?: string;

  // About your gym
  members_count?: string;
  trainers_count?: string;
  years_running?: string;

  // How you run things today
  payment_method?: string;
  payment_tracking?: string;
  reminder_method?: string;
  trainer_tracking?: string;

  // The real cost (quantified)
  hours_chasing?: string;
  unpaid_amount?: string;
  commission_cost?: string;
  trainer_quit_loss?: string;

  // What's broken (open)
  proof_dispute?: string;
  gave_up_problem?: string;
  magic_number?: string;

  // The dream + wishlist + pricing
  dream_tool?: string;
  extra?: string;
  pricing_tier?: string;

  honeypot?: string;
}

const trim = (v: string | undefined): string | null => {
  const s = (v ?? "").trim();
  return s.length === 0 ? null : s;
};

export async function submitResearchResponse(
  input: ResearchInput,
): Promise<{ success?: boolean; error?: string }> {
  // Bot trap — silently accept and discard.
  if (input.honeypot && input.honeypot.length > 0) {
    return { success: true };
  }

  const phone = trim(input.phone);
  if (!phone) return { error: "Phone number is required so we can follow up." };
  if (phone.replace(/\D/g, "").length < 10) return { error: "Please enter a valid phone number." };

  const admin = createAdminClient();
  const ua = (await headers()).get("user-agent") ?? null;

  const { error } = await admin.from("pulse_research_responses").insert({
    owner_name: trim(input.owner_name),
    gym_name: trim(input.gym_name),
    city: trim(input.city),
    phone,
    email: trim(input.email),

    members_count: trim(input.members_count),
    trainers_count: trim(input.trainers_count),
    years_running: trim(input.years_running),

    payment_method: trim(input.payment_method),
    payment_tracking: trim(input.payment_tracking),
    reminder_method: trim(input.reminder_method),
    trainer_tracking: trim(input.trainer_tracking),

    hours_chasing: trim(input.hours_chasing),
    unpaid_amount: trim(input.unpaid_amount),
    commission_cost: trim(input.commission_cost),
    trainer_quit_loss: trim(input.trainer_quit_loss),

    proof_dispute: trim(input.proof_dispute),
    gave_up_problem: trim(input.gave_up_problem),
    magic_number: trim(input.magic_number),

    dream_tool: trim(input.dream_tool),
    extra: trim(input.extra),
    pricing_tier: trim(input.pricing_tier),

    user_agent: ua,
  });

  if (error) return { error: error.message };
  return { success: true };
}
