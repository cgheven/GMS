/**
 * Country-aware money formatting. The single entry point the whole app uses to
 * turn a number into a currency string for a given gym country.
 *
 * NO BREAKING CHANGE guarantee: a null/absent/PK country renders EXACTLY what
 * lib/utils formatCurrency has always produced — "Rs. 5,000" (symbol "Rs.",
 * a space, en-PK grouping, zero decimals). Verified against the legacy output.
 *
 * Every other country derives its symbol, decimals and digit grouping from the
 * platform (Intl), so there is no hand-maintained symbol table to drift.
 */

import { getCountryConfig } from "@/lib/country-config";

// Legacy symbol overrides — where Intl's narrowSymbol differs from what the app
// has always shown. PK is the critical one: Intl renders PKR as "₨", but Pulse
// has always shown "Rs." — overriding keeps it a no-op.
const SYMBOL_OVERRIDE: Record<string, string> = {
  PKR: "Rs.",
};

const _symbolCache = new Map<string, string>();

function currencySymbolFor(currency: string, locale: string): string {
  if (SYMBOL_OVERRIDE[currency]) return SYMBOL_OVERRIDE[currency];
  const cached = _symbolCache.get(currency);
  if (cached) return cached;
  let symbol = currency;
  try {
    const parts = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: 0,
    }).formatToParts(0);
    symbol = parts.find((p) => p.type === "currency")?.value || currency;
  } catch {
    symbol = currency;
  }
  _symbolCache.set(currency, symbol);
  return symbol;
}

// Minor units straight from the platform's CLDR data: PKR/JPY → 0, USD/INR → 2,
// KWD/BHD/OMR/TND → 3. Correct for every ISO currency, so no hand-maintained set.
const _decimalsCache = new Map<string, number>();
function decimalsFor(currency: string): number {
  const cached = _decimalsCache.get(currency);
  if (cached !== undefined) return cached;
  let d = 2;
  try {
    d = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    d = 2;
  }
  _decimalsCache.set(currency, d);
  return d;
}

// A space sits between symbol and number only when the symbol ends in a letter
// or dot ("Rs.", "AED", "CHF"). Pure signs ("$", "£", "₹", "৳") hug the number.
function needsSpace(symbol: string): boolean {
  return /[A-Za-z.]$/.test(symbol);
}

export interface MoneyConfig {
  currency: string;
  symbol: string;
  decimals: number;
  numberLocale: string;
  space: boolean;
}

export function moneyConfig(country: string | null | undefined): MoneyConfig {
  const cfg = getCountryConfig(country);
  const symbol = currencySymbolFor(cfg.currency, cfg.numberLocale);
  return {
    currency: cfg.currency,
    symbol,
    decimals: decimalsFor(cfg.currency),
    numberLocale: cfg.numberLocale,
    space: needsSpace(symbol),
  };
}

/**
 * Format an amount in the gym country's currency.
 * `formatMoney(5000, "PK")` → "Rs. 5,000"; `formatMoney(50, "US")` → "$50.00".
 */
export function formatMoney(amount: number, country?: string | null): string {
  const m = moneyConfig(country);
  const n = new Intl.NumberFormat(m.numberLocale, {
    minimumFractionDigits: m.decimals,
    maximumFractionDigits: m.decimals,
  }).format(Number.isFinite(amount) ? amount : 0);
  return `${m.symbol}${m.space ? " " : ""}${n}`;
}

/**
 * Compact money for dense KPI tiles. South-Asian currencies (PK/IN grouping)
 * keep the familiar Lakh/Cr idiom; everywhere else uses Intl compact (K/M/B).
 */
export function formatMoneyCompact(amount: number, country?: string | null): string {
  const m = moneyConfig(country);
  const prefix = `${m.symbol}${m.space ? " " : ""}`;
  // Lakh/Crore idiom only for the markets that actually use it.
  if (m.currency === "PKR" || m.currency === "INR" || m.currency === "BDT" || m.currency === "NPR" || m.currency === "LKR") {
    if (amount >= 10_000_000) return `${prefix}${(amount / 10_000_000).toFixed(1)} Cr`;
    if (amount >= 100_000) return `${prefix}${(amount / 100_000).toFixed(1)} Lakh`;
    return formatMoney(amount, country);
  }
  try {
    const n = new Intl.NumberFormat(m.numberLocale, {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(Number.isFinite(amount) ? amount : 0);
    return `${prefix}${n}`;
  } catch {
    return formatMoney(amount, country);
  }
}

/** The bare currency symbol for a country, for input adornments etc. */
export function currencySymbol(country?: string | null): string {
  return moneyConfig(country).symbol;
}
