-- HikVision (DS-K1T etc.) attendance. The terminal POSTs each scan to
-- /api/attendance/hik/<secret> via its "HTTP Listening" push. The secret in the
-- URL is the device's only credential (the push carries no auth field), so it is
-- a 32-hex random per gym. Matched scans become pulse_check_ins; unmatched ones
-- become pulse_unlinked_punches (same model as the ZKTeco device), so the
-- check-ins page's paid/unpaid view works for HikVision too.

ALTER TABLE public.pulse_gyms
  ADD COLUMN IF NOT EXISTS hik_push_secret   text,
  ADD COLUMN IF NOT EXISTS hik_last_event_at timestamptz;

-- The secret resolves to exactly one gym, so it must be unique.
CREATE UNIQUE INDEX IF NOT EXISTS pulse_gyms_hik_push_secret_uq
  ON public.pulse_gyms (hik_push_secret) WHERE hik_push_secret IS NOT NULL;

COMMENT ON COLUMN public.pulse_gyms.hik_push_secret IS
  '32-hex secret in the HikVision device push URL (/api/attendance/hik/<secret>). The device''s sole credential.';
