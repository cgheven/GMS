-- Persist the country a prospect chose on the public signup form, so when the
-- Pulse team provisions their gym it starts in the right currency/dial code
-- instead of defaulting to PK. Nullable: the legacy PK onboarding wizard sends
-- no country, and those rows stay null (treated as PK downstream).

ALTER TABLE pulse_prospects
  ADD COLUMN IF NOT EXISTS country text;

COMMENT ON COLUMN pulse_prospects.country IS
  'ISO 3166-1 alpha-2 country from the public signup form; null for the legacy/PK onboarding wizard. Used to seed pulse_gyms.country on provisioning.';
