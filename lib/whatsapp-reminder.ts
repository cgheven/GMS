import type { PaymentMethodAccount } from "@/types";

export const DEFAULT_REMINDER_TEMPLATE = `Assalam o Alaikum {name},

Friendly reminder — your gym fee of Rs {amount} for {month} is still pending.

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
}

export function buildReminderMessage(args: BuildArgs): string {
  const tpl = args.template?.trim() || DEFAULT_REMINDER_TEMPLATE;
  const firstName = args.memberName.split(" ")[0];
  const amountStr = new Intl.NumberFormat("en-PK").format(Math.round(args.amount));
  const accountsBlock = formatAccounts(args.accounts);
  return tpl
    .replace(/\{name\}/g,     firstName)
    .replace(/\{amount\}/g,   amountStr)
    .replace(/\{month\}/g,    args.month)
    .replace(/\{gym\}/g,      args.gymName)
    .replace(/\{accounts\}/g, accountsBlock);
}

/**
 * Normalize a phone number for wa.me — must be international format, digits only.
 * Pakistan-aware: "0300-1234567" → "923001234567", "+92 300 1234567" → "923001234567".
 */
export function normalizeWhatsAppPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  // Strip everything except digits and a leading +
  const stripped = trimmed.replace(/[^\d+]/g, "");
  if (!stripped) return null;

  // If user wrote with + prefix, drop it (wa.me accepts both, but bare digits is safest)
  let digits = stripped.startsWith("+") ? stripped.slice(1) : stripped;

  // Pakistan local format starts with 0 and is 11 digits — convert to 92...
  if (digits.startsWith("0") && digits.length === 11) {
    digits = "92" + digits.slice(1);
  }

  // Sanity: international numbers are 10–15 digits; Pakistan = 12 (92 + 10)
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

export function whatsappUrl(phone: string | null | undefined, message: string): string | null {
  const normalized = normalizeWhatsAppPhone(phone);
  if (!normalized) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}
