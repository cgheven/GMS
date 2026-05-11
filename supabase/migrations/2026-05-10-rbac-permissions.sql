-- RBAC Foundation: add granular permissions array to pulse_staff
--
-- Adds a `permissions TEXT[]` column to pulse_staff so we can grant
-- granular abilities (e.g. members.add, payments.refund) on top of
-- the existing role enum + can_add_members flag.
--
-- Behavior-preserving:
--   - Default '{}' (empty array) means existing staff retain their
--     current behavior, since checks fall back to the existing role
--     and can_add_members logic when permissions is empty.
--   - Owners are unaffected: they bypass permission checks entirely
--     via the existing requireOwner() / getAuthContext() flow.
--   - Trainers are unaffected: getTrainerContext() and the
--     can_add_members boolean continue to gate trainer-specific flows.
--
-- Applied to:
--   - Tokyo (bywainqjiuyqykqdmqut) on 2026-05-10 via Supabase MCP (MCP was
--     misconfigured — pointed at Tokyo. Legacy. Tokyo no longer in use.)
--   - Singapore (lefkwupvcdatrgmnefua) on 2026-05-11 via Docker psql (correct
--     production target. See docs/PERFORMANCE_PLAN.md "Migration policy".)
-- PRODUCTION = Singapore. Tokyo = legacy, will be paused ~2026-05-25.
--
-- Migration is additive only (CREATE COLUMN with IF NOT EXISTS, no DROP,
-- no ALTER of existing columns) so it is safe on production data.

ALTER TABLE pulse_staff
  ADD COLUMN IF NOT EXISTS permissions TEXT[] NOT NULL DEFAULT '{}'::TEXT[];
