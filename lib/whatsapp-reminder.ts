import type { PaymentMethodAccount } from "@/types";
import { getCountryConfig } from "@/lib/country-config";
import { currencySymbol } from "@/lib/money";
import { phoneForWhatsApp } from "@/lib/phone";

export const DEFAULT_REMINDER_TEMPLATE = `Assalam o Alaikum {name},

Friendly reminder — your gym fee of {currency} {amount} for {month} is still pending.

{accounts}

Please pay at your earliest convenience.

— {gym}`;

/** Format payment methods into a readable block for the message. */
export function formatAccounts(methods: PaymentMethodAccount[]): string {
  if (!methods || methods.length === 0) return "";
  const lines = ["Payment methods:"];
  for (const m of methods) {
    const parts: string[] = [];
    if (m.account_number) parts.push(m.account_number);
    if (m.iban && m.iban !== m.account_number) parts.push(`IBAN: ${m.iban}`);
    if (m.account_title) parts.push(`Title: ${m.account_title}`);
    lines.push(`• ${m.label}${parts.length ? " — " + parts.join(" · ") : ""}`);
  }
  return lines.join("\n");
}

interface BuildArgs {
  template?: string | null;
  memberName: string;
  amount: number;
  month: string;
  gymName: string;
  accounts: PaymentMethodAccount[];
  // Gym country (ISO). Drives the {amount} grouping and the {currency} symbol.
  // Absent → PK, so existing callers/templates are unchanged.
  country?: string | null;
}

export function buildReminderMessage(args: BuildArgs): string {
  const tpl = args.template?.trim() || DEFAULT_REMINDER_TEMPLATE;
  const firstName = args.memberName.split(" ")[0];
  // {amount} stays a bare grouped number — existing gym templates write the
  // currency word themselves ("Rs {amount}"). {currency} is the symbol, for the
  // default template and any gym that opts into it.
  const amountStr = new Intl.NumberFormat(getCountryConfig(args.country).numberLocale).format(Math.round(args.amount));
  const accountsBlock = formatAccounts(args.accounts);
  return tpl
    .replace(/\{name\}/g,     firstName)
    .replace(/\{amount\}/g,   amountStr)
    .replace(/\{currency\}/g, currencySymbol(args.country))
    .replace(/\{month\}/g,    args.month)
    .replace(/\{gym\}/g,      args.gymName)
    .replace(/\{accounts\}/g, accountsBlock);
}

/**
 * Normalize a phone number for wa.me — must be international format, digits only.
 * Pakistan-aware: "0300-1234567" → "923001234567", "+92 300 1234567" → "923001234567".
 */
export function normalizeWhatsAppPhone(
  phone: string | null | undefined,
  country?: string | null,
): string | null {
  if (!phone) return null;
  // phoneForWhatsApp resolves the dial code via the gym country (libphonenumber),
  // so a local number in any country becomes correct international digits. It
  // falls open to PK, so a PK local "0300…" still maps to "92…" as before.
  const digits = phoneForWhatsApp(phone, country);
  if (!digits || digits.length < 8 || digits.length > 15) return null;
  return digits;
}

export function whatsappUrl(
  phone: string | null | undefined,
  message: string,
  country?: string | null,
): string | null {
  const normalized = normalizeWhatsAppPhone(phone, country);
  if (!normalized) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}
