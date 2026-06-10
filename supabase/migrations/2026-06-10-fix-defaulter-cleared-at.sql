-- Fix four production issues with the last_cleared_at defaulter system:
--
-- 1. Drop stale 10-param clear_defaulter_with_payment overload that still sets
--    defaulter_exempt=TRUE and accepts client-computed balance (TOCTOU risk).
--
-- 2. Rewrite check_defaulters with:
--    - SECURITY DEFINER + search_path (lost during prior DROP/CREATE cycle)
--    - Off-by-one fix: v_check_from now points to the month AFTER clearing, so
--      the clearing month itself is never counted as a miss in the no-payment path
--    - Timezone fix: use AT TIME ZONE 'Asia/Karachi' so midnight clears in PKT
--      (which land in the prior UTC month) still forgive the correct local month
--
-- 3. Fix check_and_clear_defaulter to stamp last_cleared_at when it auto-clears
--    a defaulter via the normal payment flow — without this, next check_defaulters
--    call re-scans from join_date and can immediately re-flag the member.
--
-- 4. Remediate 5 members stranded by the old defaulter_exempt=TRUE mechanism:
--    clear the flag and stamp now() so they fall under the new system.

-- ── 1. Drop old 10-param overload ───────────────────────────────────────────
DROP FUNCTION IF EXISTS public.clear_defaulter_with_payment(
  uuid, uuid, numeric, text, date, text, text, uuid, jsonb, numeric
);

-- ── 2. Rewrite check_defaulters ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_defaulters(
  p_gym_id   uuid,
  p_threshold integer DEFAULT 2
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_member      RECORD;
  v_consecutive int;
  v_month_start date;
  v_month_str   text;
  v_has_payment bool;
  v_check_from  date;
BEGIN
  FOR v_member IN
    SELECT m.id, m.join_date, m.last_cleared_at
    FROM pulse_members m
    LEFT JOIN pulse_membership_plans p ON p.id = m.plan_id
    WHERE m.gym_id = p_gym_id
      AND m.status = 'active'
      AND (m.plan_id IS NULL OR p.duration_type IN ('monthly', 'daily', 'dropin'))
      AND m.monthly_fee > 0
      AND m.join_date <= (date_trunc('month', CURRENT_DATE) - (p_threshold || ' months')::interval)::date
      AND m.defaulter_exempt = FALSE
  LOOP
    v_consecutive := 0;

    -- Lower bound for the consecutive-miss scan. Points to the first day of the
    -- month AFTER the clearing month so the clearing month itself is never
    -- treated as a miss (even in the no-payment-inserted clear path).
    -- AT TIME ZONE 'Asia/Karachi' prevents a UTC midnight on the 1st of a month
    -- from date_trunc'ing into the prior month.
    v_check_from := CASE
      WHEN v_member.last_cleared_at IS NOT NULL
        THEN (date_trunc('month', v_member.last_cleared_at AT TIME ZONE 'Asia/Karachi')
              + interval '1 month')::date
      ELSE v_member.join_date
    END;

    FOR i IN 1..p_threshold LOOP
      v_month_start := (date_trunc('month', CURRENT_DATE) - (i || ' months')::interval)::date;
      v_month_str   := to_char(v_month_start, 'YYYY-MM');

      EXIT WHEN v_month_start < v_check_from;

      SELECT EXISTS (
        SELECT 1 FROM pulse_payments
        WHERE member_id = v_member.id
          AND for_period = v_month_str
          AND status     = 'paid'
      ) INTO v_has_payment;

      IF NOT v_has_payment THEN
        v_consecutive := v_consecutive + 1;
      ELSE
        EXIT;
      END IF;
    END LOOP;

    IF v_consecutive >= p_threshold THEN
      UPDATE pulse_members
      SET status          = 'defaulter',
          defaulter_since = CURRENT_DATE,
          updated_at      = now()
      WHERE id = v_member.id AND status = 'active';
    END IF;
  END LOOP;
END;
$$;

-- ── 3. Fix check_and_clear_defaulter ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_and_clear_defaulter(p_member_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_gym_id      uuid;
  v_join_date   date;
  v_threshold   int;
  v_unpaid      int := 0;
  v_month_start date;
  v_month_str   text;
  v_has_payment bool;
  v_cleared     bool := false;
BEGIN
  SELECT m.gym_id, m.join_date,
    COALESCE((g.compliance_settings->>'defaulter_threshold_months')::int, 2)
  INTO v_gym_id, v_join_date, v_threshold
  FROM pulse_members m
  JOIN pulse_gyms g ON g.id = m.gym_id
  WHERE m.id = p_member_id AND m.status = 'defaulter';

  IF NOT FOUND THEN RETURN false; END IF;

  FOR i IN 1..v_threshold LOOP
    v_month_start := (date_trunc('month', CURRENT_DATE) - (i || ' months')::interval)::date;
    CONTINUE WHEN v_join_date > (v_month_start + interval '1 month - 1 day')::date;
    v_month_str := to_char(v_month_start, 'YYYY-MM');

    SELECT EXISTS (
      SELECT 1 FROM pulse_payments
      WHERE member_id = p_member_id
        AND for_period = v_month_str
        AND status     = 'paid'
    ) INTO v_has_payment;

    IF NOT v_has_payment THEN
      v_unpaid := v_unpaid + 1;
    END IF;
  END LOOP;

  IF v_unpaid = 0 THEN
    UPDATE pulse_members
    SET status          = 'active',
        defaulter_since = null,
        last_cleared_at = now(),
        updated_at      = now()
    WHERE id = p_member_id AND status = 'defaulter';
    v_cleared := true;
  END IF;

  RETURN v_cleared;
END;
$$;

-- ── 4. Remediate stranded defaulter_exempt members ──────────────────────────
-- Members cleared before last_cleared_at existed have defaulter_exempt=TRUE and
-- last_cleared_at=NULL — they are permanently invisible to check_defaulters.
-- Transition them to the new scheme: clear the flag and stamp now().
UPDATE public.pulse_members
SET defaulter_exempt = FALSE,
    last_cleared_at  = now()
WHERE defaulter_exempt = TRUE
  AND last_cleared_at IS NULL;
