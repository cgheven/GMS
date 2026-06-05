// Shared invoice/receipt PDF builder. Runs in BOTH the browser (preview +
// download) and Node (server-side generation for the 7-day WhatsApp share
// link), so the shared file the member receives is byte-identical to the
// on-screen preview. Pure jsPDF text/vector — no DOM or canvas.
import { formatDate } from "@/lib/utils";
import type { jsPDF } from "jspdf";
import type { Gym, Payment, PaymentMethod } from "@/types";

export type InvoiceGym = Pick<Gym, "name" | "address" | "city" | "phone" | "ntn" | "report_settings">;

export interface InvoicePdfData {
  payment: Payment;
  memberName: string;
  planName?: string | null;
}

export const methodLabels: Record<PaymentMethod, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  jazzcash: "JazzCash",
  easypaisa: "Easypaisa",
  card: "Card",
  other: "Other",
};

export function formatPeriod(forPeriod: string | null | undefined): string {
  if (!forPeriod) return "";
  const parts = forPeriod.split("-");
  if (parts.length < 2) return "";
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) return "";
  try {
    return new Date(year, month - 1, 1).toLocaleString("default", { month: "long", year: "numeric" });
  } catch {
    return "";
  }
}

export function amountInWords(n: number): string {
  const rounded = Math.round(n);
  if (rounded === 0) return "Zero Rupees Only";
  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
  ];
  const tensArr = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  function words(num: number): string {
    if (num === 0) return "";
    if (num < 20) return ones[num];
    if (num < 100) return tensArr[Math.floor(num / 10)] + (num % 10 ? " " + ones[num % 10] : "");
    if (num < 1000) return ones[Math.floor(num / 100)] + " Hundred" + (num % 100 ? " " + words(num % 100) : "");
    if (num < 100000) return words(Math.floor(num / 1000)) + " Thousand" + (num % 1000 ? " " + words(num % 1000) : "");
    if (num < 10000000) return words(Math.floor(num / 100000)) + " Lakh" + (num % 100000 ? " " + words(num % 100000) : "");
    return words(Math.floor(num / 10000000)) + " Crore" + (num % 10000000 ? " " + words(num % 10000000) : "");
  }
  return words(rounded) + " Rupees Only";
}

export function pkr(n: number): string {
  return `PKR ${Number(n).toLocaleString("en-PK")}`;
}

// Itemized plan lines for the receipt. Uses the plan_breakdown snapshotted on
// the payment (multi-plan members → one line per plan). Falls back to a single
// "Membership Fee" line for old payments without a breakdown, or when the
// breakdown's prices don't reconcile with the charged amount (e.g. fee edited).
export function planLineItems(payment: Payment): { name: string; price: number }[] {
  const breakdown = (payment as Payment & { plan_breakdown?: { name: string; price: number }[] | null }).plan_breakdown;
  if (Array.isArray(breakdown) && breakdown.length > 0) {
    const sum = breakdown.reduce((s, p) => s + Number(p.price), 0);
    if (Math.round(sum) === Math.round(Number(payment.amount))) {
      return breakdown.map((p) => ({ name: p.name, price: Number(p.price) }));
    }
  }
  return [{ name: "Membership Fee", price: Number(payment.amount) }];
}

// Resolve the jsPDF constructor across environments: bundlers expose it as the
// default export, Node's ESM interop exposes it as a named `jsPDF` export.
async function newDoc(): Promise<jsPDF> {
  const mod = (await import("jspdf")) as unknown as {
    jsPDF?: new (o?: object) => jsPDF;
    default?: (new (o?: object) => jsPDF) & { jsPDF?: new (o?: object) => jsPDF };
  };
  const Ctor = mod.jsPDF ?? mod.default?.jsPDF ?? mod.default;
  if (!Ctor) throw new Error("jsPDF constructor not found");
  return new Ctor({ unit: "pt", format: "a4", orientation: "portrait" });
}

/**
 * Build the receipt PDF document. Caller decides the output:
 *   browser → doc.output("blob")
 *   server  → doc.output("arraybuffer")
 */
export async function buildInvoiceDoc(
  data: InvoicePdfData,
  gym: InvoiceGym | null,
  formattedPeriod: string,
): Promise<jsPDF> {
  const doc = await newDoc();

  const ML = 48;
  const MR = 547;

  const DARK: [number, number, number] = [15, 17, 38];
  const GRAY: [number, number, number] = [120, 125, 148];
  const LGRAY: [number, number, number] = [210, 213, 228];

  const { payment, memberName, planName } = data;
  const gymName = gym?.name ?? "Gym";
  const taxRate = gym?.report_settings?.taxRate ?? 0;
  const taxInc = gym?.report_settings?.taxInclusive ?? false;
  const taxLabel = gym?.report_settings?.taxLabel ?? "Tax";
  const showTax = taxRate > 0 && !taxInc;
  const methodLabel = payment.payment_method ? methodLabels[payment.payment_method] : "—";
  const receiptNo = payment.receipt_number ?? payment.id.slice(0, 8);
  const dateStr = payment.payment_date
    ? formatDate(payment.payment_date)
    : formatDate(new Date().toISOString());
  const notes = payment.notes ?? "Thank you for training with us.";

  let y = 0;

  function divider() {
    doc.setDrawColor(...LGRAY);
    doc.setLineWidth(0.5);
    doc.line(ML, y, MR, y);
    y += 14;
  }

  function sectionLabel(text: string, x = ML) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text(text, x, y);
    y += 15;
  }

  function sectionValue(text: string, size = 12, x = ML, color: [number, number, number] = DARK) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(text, x, y);
  }

  // ── HEADER ────────────────────────────────────────────────────────────────
  y = 44;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(190, 193, 210);
  doc.text("Generated by Pulse GMS", MR, 22, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...DARK);
  doc.text(gymName, ML, y);
  y += 15;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...GRAY);
  const addrParts = [gym?.address, gym?.city].filter(Boolean) as string[];
  if (addrParts.length > 0) { doc.text(addrParts.join(", "), ML, y); y += 13; }
  if (gym?.phone) { doc.text(gym.phone, ML, y); y += 13; }
  if (gym?.ntn) { doc.text(`NTN: ${gym.ntn}`, ML, y); y += 13; }

  y += 8;
  divider();

  // ── RECEIPT ID / DATE (two columns) ──────────────────────────────────────
  const MID = ML + (MR - ML) / 2 + 10;

  sectionLabel("RECEIPT ID");
  const labelY = y;
  sectionValue(receiptNo, 12);
  y = labelY - 15;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...GRAY);
  doc.text("DATE", MID, y);
  y += 15;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...DARK);
  doc.text(dateStr, MID, y);

  y += 16;
  divider();

  // ── MEMBER ────────────────────────────────────────────────────────────────
  sectionLabel("MEMBER");
  sectionValue(memberName, 13);
  y += 16;
  divider();

  // ── PLAN DETAILS ──────────────────────────────────────────────────────────
  sectionLabel("PLAN DETAILS");
  if (planName) {
    sectionValue(planName, 13);
    y += 15;
  }
  if (formattedPeriod) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...GRAY);
    doc.text(`Period: ${formattedPeriod}`, ML, y);
    y += 13;
  }
  y += 4;
  divider();

  // ── DESCRIPTION / AMOUNT ──────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  doc.text("Description", ML, y);
  doc.text("Amount", MR, y, { align: "right" });
  y += 14;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  for (const item of planLineItems(payment)) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...DARK);
    doc.text(item.name, ML, y);
    doc.text(pkr(item.price), MR, y, { align: "right" });
    y += 14;
  }

  if (Number(payment.discount) > 0) {
    doc.setTextColor(...DARK);
    doc.text("Discount", ML, y);
    doc.setTextColor(22, 163, 74);
    doc.text(`-${pkr(payment.discount)}`, MR, y, { align: "right" });
    y += 14;
  }
  if (Number(payment.late_fee) > 0) {
    doc.setTextColor(...DARK);
    doc.text("Late Fee", ML, y);
    doc.setTextColor(200, 45, 45);
    doc.text(`+${pkr(payment.late_fee)}`, MR, y, { align: "right" });
    y += 14;
  }
  if (showTax) {
    const taxAmt = Math.round((payment.total_amount * taxRate) / 100);
    doc.setTextColor(...DARK);
    doc.text(`${taxLabel} (${taxRate}%)`, ML, y);
    doc.setTextColor(...DARK);
    doc.text(pkr(taxAmt), MR, y, { align: "right" });
    y += 14;
  }

  y += 4;
  divider();

  // ── TOTAL PAID ────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...DARK);
  doc.text("TOTAL PAID", ML, y + 4);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...DARK);
  doc.text(pkr(Number(payment.total_amount)), MR, y + 4, { align: "right" });

  y += 22;
  divider();

  // ── AMOUNT IN WORDS ───────────────────────────────────────────────────────
  sectionLabel("AMOUNT IN WORDS");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...DARK);
  doc.text(amountInWords(Number(payment.total_amount)), ML, y);
  y += 16;
  divider();

  // ── PAYMENT METHOD / STATUS (two columns) ────────────────────────────────
  sectionLabel("PAYMENT METHOD");
  const pmY = y;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...DARK);
  doc.text(methodLabel, ML, y);
  y = pmY - 15;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...GRAY);
  doc.text("STATUS", MID, y);
  y += 15;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...DARK);
  const statusText = payment.status.charAt(0).toUpperCase() + payment.status.slice(1);
  doc.text(statusText, MID, y);

  y += 16;
  divider();

  // ── THANK YOU ─────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "italic");
  doc.setFontSize(10);
  doc.setTextColor(160, 165, 185);
  doc.text(notes, (ML + MR) / 2, y, { align: "center" });

  return doc;
}
