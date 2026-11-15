-- SECURITY (#5): trainers_update_payments had a USING qual (which rows a trainer
-- may update) but NO WITH CHECK (what the updated row may become). A trainer
-- could therefore UPDATE one of their payment rows and move its gym_id/member_id
-- to another gym or a member that isn't theirs. Add a WITH CHECK that pins the
-- row to the trainer's gym and their own assigned members, mirroring the INSERT
-- policy. Trainers still record payments for their members from the portal; they
-- just can't retarget a row out of scope.

ALTER POLICY trainers_update_payments ON public.pulse_payments
  WITH CHECK (
    gym_id = pulse_trainer_gym_id()
    AND member_id IN (
      SELECT id FROM public.pulse_members
      WHERE assigned_trainer_id = pulse_trainer_staff_id()
    )
  );
