-- SECURITY (#9): the trainer RLS helper functions resolved the staff row by
-- user_id with no status filter, so a deactivated/terminated trainer still
-- passed every trainer RLS policy (direct client-side reads/writes to their
-- former members' rows and payments) until the auth user was deleted. Add the
-- active-status filter, mirroring getStaffSession / getTrainerContext.

CREATE OR REPLACE FUNCTION public.pulse_trainer_gym_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT gym_id FROM pulse_staff WHERE user_id = auth.uid() AND status = 'active' LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.pulse_trainer_staff_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT id FROM pulse_staff WHERE user_id = auth.uid() AND status = 'active' LIMIT 1;
$$;
