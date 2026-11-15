-- SECURITY hardening bundle.

-- (#7) pulse_waitlist had a PUBLIC SELECT policy, letting anyone with the public
-- anon key harvest name+phone of every listed gym's waitlist. The app never reads
-- the waitlist from the client (joinWaitlist is an admin-client INSERT only), so
-- drop the public read entirely. Owner/admin policies remain for the dashboard.
DROP POLICY IF EXISTS pulse_waitlist_public_select ON public.pulse_waitlist;

-- (#4, #8) Shared, atomic rate limiter backing the biometric endpoint and the
-- public signup/onboarding funnel. Keyed by an opaque bucket string; a fixed
-- window that resets lazily. SECURITY DEFINER so it works regardless of caller.
CREATE TABLE IF NOT EXISTS public.pulse_rate_limits (
  bucket       text PRIMARY KEY,
  count        int NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pulse_rate_limits ENABLE ROW LEVEL SECURITY; -- no policies: service-role only

CREATE OR REPLACE FUNCTION public.pulse_rate_hit(
  p_bucket text, p_limit int, p_window_seconds int
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_now timestamptz := now(); v_count int;
BEGIN
  INSERT INTO public.pulse_rate_limits (bucket, count, window_start)
    VALUES (p_bucket, 1, v_now)
  ON CONFLICT (bucket) DO UPDATE SET
    count = CASE WHEN public.pulse_rate_limits.window_start < v_now - make_interval(secs => p_window_seconds)
                 THEN 1 ELSE public.pulse_rate_limits.count + 1 END,
    window_start = CASE WHEN public.pulse_rate_limits.window_start < v_now - make_interval(secs => p_window_seconds)
                 THEN v_now ELSE public.pulse_rate_limits.window_start END
  RETURNING count INTO v_count;
  RETURN v_count <= p_limit;  -- true = allowed, false = over the limit
END; $$;

REVOKE ALL ON FUNCTION public.pulse_rate_hit(text,int,int) FROM public;
GRANT EXECUTE ON FUNCTION public.pulse_rate_hit(text,int,int) TO service_role;

-- (#4) Optional per-device push key. When set on a gym, the ZKTeco endpoint
-- requires it (query param), so a leaked/guessed serial alone is not enough.
ALTER TABLE public.pulse_gyms
  ADD COLUMN IF NOT EXISTS device_push_key text;
COMMENT ON COLUMN public.pulse_gyms.device_push_key IS
  'Optional shared secret the biometric device must send (?key=) alongside its serial. When set, the serial alone is not accepted.';

-- (#3) A member's biometric identity must be unique within a gym, enforced at the
-- DB so no code path (create mass-assignment OR update) can link one device user
-- id to two members. Backstops the app-level guard in linkDeviceUser.
CREATE UNIQUE INDEX IF NOT EXISTS pulse_members_gym_device_uid_uq
  ON public.pulse_members (gym_id, device_user_id) WHERE device_user_id IS NOT NULL;
