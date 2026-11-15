/**
 * Country configuration registry — the single place that turns a gym's ISO
 * country code into everything Pulse needs to behave correctly for that country:
 * currency, display name, and international dial code.
 *
 * This is the keystone of the multi-country design. Money formatting and phone
 * handling resolve the gym's `country` through here instead of hardcoding
 * Pakistan. Onboarding a new country = adding a row to COUNTRY_CURRENCY below,
 * not a code change scattered across the app.
 *
 * Deliberately minimal data: we store ONLY country→currency. Everything else is
 * derived from the platform so the table can't drift out of date:
 *   - Country NAME        → Intl.DisplayNames
 *   - Dial CODE           → libphonenumber-js (getCountryCallingCode)
 *   - Currency SYMBOL     → Intl.NumberFormat (narrowSymbol)
 *   - Decimals / grouping → Intl.NumberFormat per locale
 *
 * Pakistan is the default and a VERIFIED no-op: every existing (country-less)
 * gym resolves to PK → PKR → "Rs." exactly as the app has always rendered.
 *
 * Static, non-secret config — safe to import from server and client alike.
 */

import { getCountryCallingCode, type CountryCode as LibCountryCode } from "libphonenumber-js";

export type CountryCode = string; // ISO 3166-1 alpha-2, uppercase (e.g. "PK", "AE")

export const DEFAULT_COUNTRY: CountryCode = "PK";

// ── ISO 3166-1 alpha-2 → ISO 4217 currency ────────────────────────────────────
// Broad coverage of the markets a gym SaaS realistically serves. Extend freely;
// any code absent here falls open to PK via getCountryConfig.
export const COUNTRY_CURRENCY: Record<string, string> = {
  PK: "PKR", IN: "INR", BD: "BDT", LK: "LKR", NP: "NPR", AF: "AFN", BT: "BTN", MV: "MVR",
  AE: "AED", SA: "SAR", QA: "QAR", KW: "KWD", BH: "BHD", OM: "OMR", JO: "JOD", LB: "LBP",
  IQ: "IQD", IR: "IRR", IL: "ILS", TR: "TRY", EG: "EGP", MA: "MAD", DZ: "DZD", TN: "TND",
  LY: "LYD", SD: "SDG", YE: "YER", SY: "SYP",
  US: "USD", CA: "CAD", MX: "MXN", BR: "BRL", AR: "ARS", CL: "CLP", CO: "COP", PE: "PEN",
  VE: "VES", UY: "UYU", PY: "PYG", BO: "BOB", EC: "USD", GT: "GTQ", CR: "CRC", PA: "PAB",
  DO: "DOP", JM: "JMD", TT: "TTD",
  GB: "GBP", IE: "EUR", FR: "EUR", DE: "EUR", ES: "EUR", IT: "EUR", PT: "EUR", NL: "EUR",
  BE: "EUR", AT: "EUR", GR: "EUR", FI: "EUR", LU: "EUR", CY: "EUR", MT: "EUR", SK: "EUR",
  SI: "EUR", EE: "EUR", LV: "EUR", LT: "EUR",
  CH: "CHF", SE: "SEK", NO: "NOK", DK: "DKK", IS: "ISK", PL: "PLN", CZ: "CZK", HU: "HUF",
  RO: "RON", BG: "BGN", HR: "EUR", RS: "RSD", UA: "UAH", RU: "RUB", BY: "BYN", KZ: "KZT",
  UZ: "UZS", AZ: "AZN", GE: "GEL", AM: "AMD",
  CN: "CNY", JP: "JPY", KR: "KRW", HK: "HKD", TW: "TWD", SG: "SGD", MY: "MYR", ID: "IDR",
  TH: "THB", VN: "VND", PH: "PHP", MM: "MMK", KH: "KHR", LA: "LAK", BN: "BND", MN: "MNT",
  MO: "MOP",
  AU: "AUD", NZ: "NZD", FJ: "FJD", PG: "PGK",
  ZA: "ZAR", NG: "NGN", KE: "KES", GH: "GHS", TZ: "TZS", UG: "UGX", ET: "ETB", RW: "RWF",
  ZM: "ZMW", ZW: "ZWL", AO: "AOA", MZ: "MZN", BW: "BWP", NA: "NAD", MU: "MUR", SN: "XOF",
  CI: "XOF", CM: "XAF", CD: "CDF", MG: "MGA", MW: "MWK",
};

/** Codes the country picker offers, sorted by display name (built lazily). */
export const SUPPORTED_COUNTRY_CODES: CountryCode[] = Object.keys(COUNTRY_CURRENCY);

export interface CountryConfig {
  /** ISO 3166-1 alpha-2, uppercase. */
  code: CountryCode;
  /** English display name, e.g. "Pakistan". */
  name: string;
  /** ISO 4217 currency code, e.g. "PKR". */
  currency: string;
  /** International dialing code WITHOUT the "+", e.g. "92". */
  dialCode: string;
  /** BCP-47 locale used for number grouping, e.g. "en-PK" (Indian/PK lakh grouping). */
  numberLocale: string;
}

function safeDisplayName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

function safeDialCode(code: string): string {
  try {
    return getCountryCallingCode(code as LibCountryCode);
  } catch {
    return "92"; // PK fallback
  }
}

/**
 * Resolve a country code to its full config. FAILS OPEN to Pakistan for any
 * null / empty / unknown code — so every country-less gym and every bad value
 * renders exactly as the legacy PK-only app did. Never throws.
 */
export function getCountryConfig(code: string | null | undefined): CountryConfig {
  const raw = (code ?? "").trim().toUpperCase();
  const resolved = raw && COUNTRY_CURRENCY[raw] ? raw : DEFAULT_COUNTRY;
  return {
    code: resolved,
    name: safeDisplayName(resolved),
    currency: COUNTRY_CURRENCY[resolved] ?? "PKR",
    dialCode: safeDialCode(resolved),
    numberLocale: `en-${resolved}`,
  };
}

export function isSupportedCountry(code: string | null | undefined): boolean {
  const raw = (code ?? "").trim().toUpperCase();
  return !!raw && !!COUNTRY_CURRENCY[raw];
}

/** Country options for a picker, sorted by name. Built once on first use. */
let _countryOptions: { code: CountryCode; name: string; dialCode: string }[] | null = null;
export function countryOptions(): { code: CountryCode; name: string; dialCode: string }[] {
  if (_countryOptions) return _countryOptions;
  _countryOptions = SUPPORTED_COUNTRY_CODES.map((code) => {
    const cfg = getCountryConfig(code);
    return { code: cfg.code, name: cfg.name, dialCode: cfg.dialCode };
  }).sort((a, b) => a.name.localeCompare(b.name));
  return _countryOptions;
}
