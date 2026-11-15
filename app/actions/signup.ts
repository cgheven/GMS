"use server";

import { randomBytes, createHash } from "crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSignupVerificationEmail } from "@/lib/email";
import { siteUrl } from "@/lib/site-url";
import { isValidPhone, normalizePhone } from "@/lib/phone";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LINK_TTL_MINUTES = 60;
const TRIAL_DAYS = 14;

function sha256(v: string): string {
  return createHash("sha256").update(v).digest("hex");
}

export type SignupInput = {
  gymName: string;
  ownerName: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  heardFrom?: string;
  // Honeypot — real users leave it empty.
  contactRef2?: string;
};

export type SignupResult = { success: true } | { success: false; error: string };

/**
 * Self-serve signup — REQUEST step (unauthenticated, email-verify first).
 *
 * Deliberately does NOT create an auth user: an unverified signup must never
 * claim the canonical owner-email slot (pre-registration squatting / email-bomb).
 * It writes a hashed-token pending row + emails a verification link; the real
 * account + gym + 14-day trial are provisioned only on verify (verifyAndProvision),
 * by someone who controls the inbox.
 *
 * Anti-enumeration: returns the same success whether or not the email is already
 * registered — we just don't send a link (or create anything) for an existing one.
 */
export async function requestSignup(input: SignupInput): Promise<SignupResult> {
  if (input?.contactRef2) return { success: true }; // honeypot tripped — pretend success

  const email = (input?.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return { success: false, error: "Enter a valid email address." };
  }
  const country = (input.country ?? "").toUpperCase() || "PK";
  const gymName = input.gymName?.trim();
  const ownerName = input.ownerName?.trim();
  const city = input.city?.trim();
  const rawPhone = input.phone?.trim() ?? "";
  if (!gymName) return { success: false, error: "Enter your gym's name." };
  if (!ownerName) return { success: false, error: "Enter your name." };
  if (!city) return { success: false, error: "Enter your city." };
  if (!isValidPhone(rawPhone, country)) {
    return { success: false, error: "Enter a valid mobile number for the selected country." };
  }
  const phone = normalizePhone(rawPhone, country) ?? rawPhone;

  const admin = createAdminClient();

  // Rate limit: per IP and per email, so the verify-email can't be used to spam.
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  const [{ data: ipOk }, { data: emailOk }] = await Promise.all([
    admin.rpc("pulse_rate_hit", { p_bucket: `signup:ip:${ip}`, p_limit: 15, p_window_seconds: 3600 }),
    admin.rpc("pulse_rate_hit", { p_bucket: `signup:email:${email}`, p_limit: 4, p_window_seconds: 3600 }),
  ]);
  if (ipOk === false || emailOk === false) {
    return { success: true }; // uniform response — don't reveal the limit
  }

  // If an account already exists on this email, stop silently (anti-enumeration).
  const { data: existing } = await admin
    .from("pulse_profiles").select("id").eq("email", email).maybeSingle();
  if (existing) return { success: true };

  // Mint a token, store only its hash.
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = sha256(rawToken);
  const expiresAt = new Date(Date.now() + LINK_TTL_MINUTES * 60_000).toISOString();

  // Housekeeping + replace any prior live pending row for this email.
  await admin.from("pulse_pending_signups").delete().lt("expires_at", new Date().toISOString());
  await admin.from("pulse_pending_signups").delete().eq("normalized_email", email).is("consumed_at", null);
  const { error: insErr } = await admin.from("pulse_pending_signups").insert({
    email,
    normalized_email: email,
    token_hash: tokenHash,
    owner_name: ownerName.slice(0, 120),
    gym_name: gymName.slice(0, 120),
    phone,
    city: city.slice(0, 80),
    country,
    expires_at: expiresAt,
  });
  if (insErr) {
    console.error("[signup] pending insert failed:", insErr);
    return { success: false, error: "Could not start signup. Please try again." };
  }

  const link = `${siteUrl()}/signup/verify?token=${rawToken}`;
  const sent = await sendSignupVerificationEmail(email, { ownerName, gymName, link });
  if (!sent.ok) {
    return { success: false, error: "We couldn't send the verification email. Please try again." };
  }
  return { success: true };
}

export type VerifyResult =
  | { success: true; email: string }
  | { success: false; error: string };

/**
 * Self-serve signup — VERIFY + PROVISION step. Validates the emailed token, then
 * atomically creates the auth user (with the password the owner just set), their
 * gym, and the owner profile with a 14-day trial. Returns the email so the client
 * can sign them straight in.
 */
export async function verifyAndProvision(input: {
  token: string;
  password: string;
}): Promise<VerifyResult> {
  const token = (input?.token ?? "").trim();
  const password = input?.password ?? "";
  if (!token) return { success: false, error: "Missing verification token." };
  if (password.length < 8) return { success: false, error: "Password must be at least 8 characters." };

  const admin = createAdminClient();
  const { data: pending } = await admin
    .from("pulse_pending_signups")
    .select("*")
    .eq("token_hash", sha256(token))
    .maybeSingle();

  if (!pending || pending.consumed_at || new Date(pending.expires_at).getTime() < Date.now()) {
    return { success: false, error: "This link is invalid or has expired. Please sign up again." };
  }

  // Create the auth user (email pre-confirmed — the token proves inbox control).
  const { data: created, error: userErr } = await admin.auth.admin.createUser({
    email: pending.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: pending.owner_name },
  });
  if (userErr || !created?.user) {
    const already = /already|exists|registered/i.test(userErr?.message ?? "");
    return {
      success: false,
      error: already
        ? "An account with this email already exists. Please sign in."
        : "Could not create your account. Please try again.",
    };
  }
  const uid = created.user.id;
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 86_400_000).toISOString();

  // Owner profile with the trial. email is NOT NULL on pulse_profiles.
  const { error: profErr } = await admin.from("pulse_profiles").upsert({
    id: uid,
    email: pending.email,
    full_name: pending.owner_name || null,
    phone: pending.phone || null,
    branch_limit: 1,
    trial_ends_at: trialEndsAt,
    frozen: false,
  });
  if (profErr) {
    console.error("[signup] profile upsert failed:", profErr);
    // Roll back the orphaned auth user so the email can be retried.
    await admin.auth.admin.deleteUser(uid).catch(() => {});
    return { success: false, error: "Could not finish setting up your account. Please try again." };
  }

  // The gym.
  const { error: gymErr } = await admin.from("pulse_gyms").insert({
    owner_id: uid,
    name: pending.gym_name || "My Gym",
    city: pending.city || null,
    country: (pending.country || "PK").toUpperCase(),
    total_capacity: 0,
  });
  if (gymErr) {
    console.error("[signup] gym insert failed:", gymErr);
    await admin.auth.admin.deleteUser(uid).catch(() => {});
    return { success: false, error: "Could not create your gym. Please try again." };
  }

  // Consume the token so the link can't be reused.
  await admin
    .from("pulse_pending_signups")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", pending.id);

  return { success: true, email: pending.email };
}
