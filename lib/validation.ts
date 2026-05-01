// Pakistan-specific validators for shared use across member/staff forms.

export type ValidationResult = { ok: true } | { ok: false; message: string };

// Pakistan CNIC: 13 digits. Accept formatted (XXXXX-XXXXXXX-X) or raw 13-digit.
export function validateCNIC(raw: string | null | undefined): ValidationResult {
  if (!raw || !raw.trim()) return { ok: true }; // optional
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 13) {
    return { ok: false, message: "CNIC must be 13 digits (XXXXX-XXXXXXX-X)" };
  }
  return { ok: true };
}

// Pakistan phone: accept 0-prefixed (03xx-xxxxxxx, 11 digits) or +92/92 prefixed.
export function validatePakPhone(raw: string | null | undefined): ValidationResult {
  if (!raw || !raw.trim()) return { ok: true }; // optional
  const stripped = raw.replace(/[^\d+]/g, "");
  let digits = stripped.startsWith("+") ? stripped.slice(1) : stripped;
  if (digits.startsWith("0") && digits.length === 11) return { ok: true };
  if (digits.startsWith("92") && digits.length === 12) return { ok: true };
  return { ok: false, message: "Phone must be 03xx-xxxxxxx or +92xxxxxxxxxx" };
}

// DOB: must be in past, age between 5 and 100 years.
export function validateDOB(raw: string | null | undefined): ValidationResult {
  if (!raw || !raw.trim()) return { ok: true }; // optional
  const d = new Date(raw);
  if (isNaN(d.getTime())) return { ok: false, message: "Invalid date" };
  const now = new Date();
  if (d > now) return { ok: false, message: "Date of birth cannot be in the future" };
  const ageYears = (now.getTime() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  if (ageYears > 100) return { ok: false, message: "Date of birth too far in the past" };
  if (ageYears < 5) return { ok: false, message: "Member must be at least 5 years old" };
  return { ok: true };
}

// Full name: at least 2 words (first + last), each ≥ 2 chars.
export function validateFullName(raw: string | null | undefined): ValidationResult {
  if (!raw || !raw.trim()) return { ok: false, message: "Full name is required" };
  const parts = raw.trim().split(/\s+/);
  if (parts.length < 2) return { ok: false, message: "Enter first and last name" };
  if (parts.some((p) => p.length < 2)) return { ok: false, message: "Each name part must be at least 2 letters" };
  return { ok: true };
}

// Money: non-negative finite number.
export function validateMoney(raw: string | number | null | undefined, label = "Amount"): ValidationResult {
  if (raw === "" || raw == null) return { ok: false, message: `${label} is required` };
  const n = typeof raw === "number" ? raw : parseFloat(raw);
  if (!Number.isFinite(n)) return { ok: false, message: `${label} must be a number` };
  if (n < 0) return { ok: false, message: `${label} cannot be negative` };
  return { ok: true };
}

// Run a list of validators; return first failure or ok.
export function runValidators(...checks: ValidationResult[]): ValidationResult {
  for (const c of checks) if (!c.ok) return c;
  return { ok: true };
}

// Auto-format helpers for nicer UX (apply onBlur/onChange).
export function formatCNIC(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 13);
  if (d.length <= 5)  return d;
  if (d.length <= 12) return `${d.slice(0, 5)}-${d.slice(5)}`;
  return `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12)}`;
}
