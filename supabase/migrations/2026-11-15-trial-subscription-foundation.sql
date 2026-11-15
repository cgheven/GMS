-- Self-serve trial + subscription foundation (account = owner profile).
--
-- trial_ends_at : 14-day trial set at provisioning; null = no trial (legacy owners).
-- frozen        : read-only lock after the trial lapses with no active subscription.
-- subscription_*: mirrored from Paddle webhooks.
--
-- SECURITY: these are written ONLY by the service-role (provisioning / freeze job /
-- Paddle webhook). The 2026-11-15 grant lockdown already revoked table-level UPDATE
-- from authenticated (only full_name is granted back), so an owner CANNOT self-extend
-- their trial or clear `frozen` from the client — no extra revoke needed here.

ALTER TABLE public.pulse_profiles
  ADD COLUMN IF NOT EXISTS trial_ends_at                   timestamptz,
  ADD COLUMN IF NOT EXISTS frozen                          boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS subscription_status             text,        -- trialing|active|past_due|paused|canceled|null
  ADD COLUMN IF NOT EXISTS subscription_plan               text,        -- starter|growth|pro|null
  ADD COLUMN IF NOT EXISTS paddle_customer_id              text,
  ADD COLUMN IF NOT EXISTS paddle_subscription_id          text,
  ADD COLUMN IF NOT EXISTS subscription_current_period_end timestamptz;

-- Existing (already-provisioned) owners are NOT on a trial and NOT frozen — they
-- keep full access. Only new self-serve signups get a trial_ends_at.

-- Pending email-verification signups (double opt-in). An unverified signup must
-- never create an auth user (pre-registration squatting / email-bomb), so we store
-- a hashed token here and provision the real account only when the link is clicked.
CREATE TABLE IF NOT EXISTS public.pulse_pending_signups (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email            text NOT NULL,
  normalized_email text NOT NULL,
  token_hash       text NOT NULL,
  owner_name       text,
  gym_name         text,
  phone            text,
  city             text,
  country          text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz NOT NULL,
  consumed_at      timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS pulse_pending_signups_token_uq ON public.pulse_pending_signups (token_hash);
CREATE INDEX IF NOT EXISTS pulse_pending_signups_email_idx ON public.pulse_pending_signups (normalized_email) WHERE consumed_at IS NULL;

-- Service-role only (provisioning reads/writes via the admin client).
ALTER TABLE public.pulse_pending_signups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pulse_pending_signups FROM anon, authenticated;
