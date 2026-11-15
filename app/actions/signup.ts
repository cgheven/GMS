"use server";

import { submitOnboarding } from "./onboarding";
import { sendSignupConfirmationEmail } from "@/lib/email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const HEARD_FROM = [
  "referral", "instagram", "whatsapp", "google", "facebook", "other",
] as const;
type HeardFrom = (typeof HEARD_FROM)[number];

export type SignupInput = {
  gymName: string;
  ownerName: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  heardFrom?: string;
  // Honeypot — real users leave it empty; bots fill it. Deliberately NOT named
  // "website"/"url" so password-manager autofill can't populate it.
  contactRef2?: string;
};

export type SignupResult = { success: true } | { success: false; error: string };

/**
 * Public self-registration (prospect funnel). GMS is invite-only — this does
 * NOT create an auth user. It lands a pulse_prospects lead (reusing the same
 * validated insert as the onboarding wizard) and emails the person a
 * confirmation. The Pulse team then provisions the gym.
 */
export async function requestSignup(input: SignupInput): Promise<SignupResult> {
  // Honeypot tripped — pretend success, do nothing.
  if (input?.contactRef2) return { success: true };

  const email = input?.email?.trim() ?? "";
  if (!EMAIL_RE.test(email)) {
    return { success: false, error: "Enter a valid email address." };
  }

  const heardFrom: HeardFrom | undefined =
    input.heardFrom && (HEARD_FROM as readonly string[]).includes(input.heardFrom)
      ? (input.heardFrom as HeardFrom)
      : undefined;

  // Reuse the onboarding insert (validation, length caps, PK phone check, spam
  // metadata) with sensible self-serve defaults for the wizard-only fields.
  const result = await submitOnboarding({
    gym_name: input.gymName?.trim() ?? "",
    owner_name: input.ownerName?.trim() ?? "",
    email,
    phone: input.phone?.trim() ?? "",
    city: input.city?.trim() ?? "",
    country: (input.country ?? "").toUpperCase() || "PK",
    heard_from: heardFrom ?? null,
    plan_choice: "starter",
    billing_cycle: "monthly",
    branch_type: "single",
    branch_count: 1,
  });

  if ("error" in result) {
    return { success: false, error: result.error };
  }

  // Best-effort confirmation — never fail the signup if mail is down.
  await sendSignupConfirmationEmail(email, {
    ownerName: input.ownerName,
    gymName: input.gymName,
  });

  return { success: true };
}
