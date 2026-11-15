/**
 * International phone handling, backed by libphonenumber-js. One place for
 * validation, E.164 normalization, pretty display, and wa.me links — all
 * resolved against the gym's country so a locally-typed number (e.g. a Pakistani
 * "03001234567") still validates and dials correctly.
 *
 * NO BREAKING CHANGE: existing numbers stored in local format parse fine when
 * given the gym's country as the default region, so nothing already in the
 * database becomes invalid.
 */

import {
  parsePhoneNumberFromString,
  isValidPhoneNumber,
  type CountryCode as LibCountryCode,
} from "libphonenumber-js";
import { getCountryConfig } from "@/lib/country-config";

function region(country?: string | null): LibCountryCode {
  return getCountryConfig(country).code as LibCountryCode;
}

function safeParse(value: string | null | undefined, country?: string | null) {
  if (!value || !value.trim()) return undefined;
  try {
    return parsePhoneNumberFromString(value.trim(), region(country));
  } catch {
    return undefined;
  }
}

/**
 * Strict validity check for the gym's country. A bare local number is validated
 * against that country; a +-prefixed international number validates on its own.
 */
export function isValidPhone(value: string | null | undefined, country?: string | null): boolean {
  if (!value || !value.trim()) return false;
  try {
    return isValidPhoneNumber(value.trim(), region(country));
  } catch {
    return false;
  }
}

/** Canonical E.164 ("+923001234567") for storage, or null if unparseable. */
export function toE164(value: string | null | undefined, country?: string | null): string | null {
  return safeParse(value, country)?.number ?? null;
}

/**
 * Store-ready phone: E.164 when the number parses, else the trimmed raw input
 * (so a half-typed or unusual value is never silently dropped). Pair with
 * isValidPhone at the form boundary to reject bad input before it reaches here.
 */
export function normalizePhone(value: string | null | undefined, country?: string | null): string | null {
  if (!value || !value.trim()) return null;
  return toE164(value, country) ?? value.trim();
}

/** Pretty international display ("+92 300 1234567"), falling back to raw input. */
export function formatPhoneDisplay(value: string | null | undefined, country?: string | null): string {
  const p = safeParse(value, country);
  return p ? p.formatInternational() : (value ?? "").trim();
}

/** Digits-only international number for a wa.me link ("923001234567"). */
export function phoneForWhatsApp(value: string | null | undefined, country?: string | null): string {
  const p = safeParse(value, country);
  if (p) return p.number.replace("+", "");
  return (value ?? "").replace(/\D/g, "");
}

/** An example placeholder for the country, e.g. "+92 300 1234567". */
export function phonePlaceholder(country?: string | null): string {
  const cfg = getCountryConfig(country);
  return `+${cfg.dialCode} …`;
}
