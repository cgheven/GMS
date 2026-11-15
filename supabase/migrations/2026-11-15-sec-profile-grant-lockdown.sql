-- SECURITY (CRITICAL): prevent privilege self-escalation via pulse_profiles.
--
-- The `pulse_profiles_self` RLS policy is `cmd=ALL USING (auth.uid() = id)` with
-- no WITH CHECK, and Supabase's default table grants give `authenticated`/`anon`
-- column UPDATE on EVERY column — including `is_admin` and `admin_scope`. So any
-- logged-in user could run, from the browser:
--   supabase.from('pulse_profiles').update({ is_admin:true, admin_scope:'full' }).eq('id', myUid)
-- and become platform super-admin (full cross-tenant takeover). The same primitive
-- let a user set is_demo/demo_gym_id to read any gym's data via getAuthContext.
--
-- Fix: revoke client write access to the privilege/tenant/identity columns. These
-- are only ever written by the service-role admin client (which bypasses grants),
-- so admin/provisioning flows are unaffected. Legitimate self-service edits
-- (full_name, etc.) keep working — column-level REVOKE carves out only these.

-- Column-level REVOKE cannot carve out from a table-level grant, so we revoke
-- the table-wide write and grant back ONLY the one column clients legitimately
-- edit (full_name, from Settings). SELECT is left intact (login reads role/
-- is_admin; RLS gates rows to the user's own profile). The service-role admin
-- client bypasses grants, so all admin/provisioning upserts keep working.
REVOKE UPDATE, INSERT ON public.pulse_profiles FROM anon, authenticated;
GRANT UPDATE (full_name) ON public.pulse_profiles TO authenticated;
