-- RBAC RLS Tightening: gym_id scoping on DELETE (members) + INSERT (payments)
--
-- Closes two HIGH-severity gaps surfaced by the E3 RBAC audit:
--   HIGH 3: pulse_members DELETE was only blocked for demo users (block_demo_deletes)
--           — staff acting via the supabase client could DELETE rows in any gym.
--   HIGH 4: pulse_payments INSERT was only blocked for demo users (block_demo_writes)
--           — staff acting via the supabase client could INSERT rows for any gym.
--
-- Existing policies that we DO NOT touch (these still grant access):
--   - pulse_members_admin / pulse_payments_admin (ALL via pulse_is_admin())
--   - pulse_members_gym_owner / pulse_payments_gym_owner (ALL via owner check)
--   - trainers_select_members / trainers_select_payments
--   - trainers_insert_payments / trainers_update_payments (gym_id-scoped via
--     pulse_trainer_gym_id() — keeps trainer-client direct writes working)
--   - block_demo_* (kept; layered with new policies)
--
-- The new policies are restrictive only insofar as they ADD a gym-scoped check
-- alongside the demo block. RLS multiple-policy semantics: for INSERT/UPDATE
-- multiple permissive policies are OR'd; for DELETE all USING clauses must
-- pass via OR across policies. Adding these policies tightens the surface
-- while keeping owner/admin/trainer paths intact.
--
-- Behavior preserved:
--   - Owner: passes via pulse_members_gym_owner / pulse_payments_gym_owner (ALL).
--   - Admin: passes via pulse_*_admin (ALL).
--   - Trainer: payment INSERT passes via trainers_insert_payments (gym_id-scoped).
--             Trainers don't delete members — DELETE policy doesn't affect them.
--   - Staff (non-trainer): server-side mutations now route through server
--     actions using the admin client (which bypasses RLS), so they aren't
--     blocked by these client-side RLS rules. The new RLS rules act as a
--     defense-in-depth layer against direct supabase-client calls.
--
-- Applied to:
--   - Tokyo (bywainqjiuyqykqdmqut) on 2026-05-10 via Supabase MCP (MCP was
--     misconfigured — pointed at Tokyo. Legacy. Tokyo no longer in use.)
--   - Singapore (lefkwupvcdatrgmnefua) on 2026-05-11 via Docker psql (correct
--     production target. See docs/PERFORMANCE_PLAN.md "Migration policy".)
-- PRODUCTION = Singapore. Tokyo = legacy, will be paused ~2026-05-25.

-- ─── HIGH 3: Tighten DELETE policy on pulse_members ──────────────────────────
DROP POLICY IF EXISTS pulse_members_owner_delete ON pulse_members;
CREATE POLICY pulse_members_owner_delete ON pulse_members FOR DELETE TO authenticated
USING (
  -- Owner of the gym this member belongs to
  EXISTS (SELECT 1 FROM pulse_gyms g WHERE g.id = pulse_members.gym_id AND g.owner_id = auth.uid())
  -- OR admin
  OR pulse_is_admin()
);

-- ─── HIGH 4: Tighten INSERT policy on pulse_payments ─────────────────────────
DROP POLICY IF EXISTS pulse_payments_staff_insert ON pulse_payments;
CREATE POLICY pulse_payments_staff_insert ON pulse_payments FOR INSERT TO authenticated
WITH CHECK (
  -- Owner of the gym this payment belongs to
  EXISTS (SELECT 1 FROM pulse_gyms g WHERE g.id = pulse_payments.gym_id AND g.owner_id = auth.uid())
  -- OR admin
  OR pulse_is_admin()
  -- (Trainer path is covered by separate trainers_insert_payments policy)
);
