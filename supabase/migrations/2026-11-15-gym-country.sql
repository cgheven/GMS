-- Multi-country foundation: give every gym an ISO 3166-1 alpha-2 country code.
-- Drives currency formatting (lib/money.ts) and phone handling (lib/phone.ts)
-- via the registry in lib/country-config.ts.
--
-- Default 'PK' so every existing gym is a verified no-op — the app renders
-- exactly as before (PKR / "Rs." / Pakistani dial code) until an owner changes it.

ALTER TABLE pulse_gyms
  ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT 'PK';

COMMENT ON COLUMN pulse_gyms.country IS
  'ISO 3166-1 alpha-2 country code (uppercase). Resolves currency + dial code via lib/country-config. Defaults to PK.';
