-- 2026-05-11: Fix phantom-gym bug for non-owner staff
--
-- Bug: pulse_create_gym_for_profile() previously created a "My Gym" for
-- ANY new pulse_profiles row whose role wasn't 'trainer' or 'referrer'.
-- That meant staff profiles created via createTrainerLogin (managers,
-- frontdesk, cleaners, guards, cooks, social_managers, etc.) ended up
-- owning a phantom gym. getAuthContext then found that owned gym and
-- the layout treated them as an owner, so the sidebar showed every
-- nav item bypassing the RBAC permission filter.
--
-- Fix: only auto-create a gym when the profile role is genuinely an
-- owner (role = 'owner' or role IS NULL — NULL covers Supabase auth
-- flows that haven't set the role yet, e.g. fresh signup).
CREATE OR REPLACE FUNCTION public.pulse_create_gym_for_profile()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Only owners (or rows where role isn't set yet — fresh signup default)
  -- get an auto-created starter gym. All other staff/non-owner roles
  -- must NOT own a gym, otherwise getAuthContext mis-classifies them
  -- as owners and the sidebar / page guards bypass RBAC.
  IF NEW.role IS NULL OR NEW.role = 'owner' THEN
    INSERT INTO pulse_gyms (owner_id, name)
    VALUES (NEW.id, 'My Gym')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

-- Retroactive cleanup — delete phantom gyms currently owned by non-owner
-- profiles. ON DELETE CASCADE on pulse_membership_plans handles the
-- auto-seeded starter plans. Safety guard: only delete gyms that have
-- zero members / payments / staff / check-ins so we never nuke real data.
DELETE FROM pulse_gyms g
WHERE EXISTS (
  SELECT 1 FROM pulse_profiles p
  WHERE p.id = g.owner_id
    AND p.role IS NOT NULL
    AND p.role <> 'owner'
)
AND NOT EXISTS (SELECT 1 FROM pulse_members      m WHERE m.gym_id = g.id)
AND NOT EXISTS (SELECT 1 FROM pulse_payments     pm WHERE pm.gym_id = g.id)
AND NOT EXISTS (SELECT 1 FROM pulse_staff        s WHERE s.gym_id = g.id)
AND NOT EXISTS (SELECT 1 FROM pulse_check_ins    c WHERE c.gym_id = g.id);
