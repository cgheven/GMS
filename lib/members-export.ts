// Member-list export engine — used by the Members page Export dialog.
// Pure client-side: builds an Excel-friendly CSV or a paginated PDF table from
// the member arrays already loaded in the browser. No server round-trip.
import { formatDate, memberPlanLabel } from "@/lib/utils";
import type { jsPDF } from "jspdf";
import type { Member } from "@/types";

export type ListKey = "active" | "frozen" | "on_hold" | "defaulters" | "expired" | "all";

export const LIST_LABELS: Record<ListKey, string> = {
  active: "Active Members",
  frozen: "Frozen Members",
  on_hold: "On-Hold Members",
  defaulters: "Defaulters",
  expired: "Expired / Cancelled",
  all: "All Members",
};

const SHIFT_LABEL: Record<string, string> = { morning: "Morning", evening: "Evening", night: "Night" };

export interface ExportColumn {
  id: string;
  label: string;
  numeric?: boolean; // money/number → right-aligned in PDF, raw number in CSV
  text?: boolean; // force CSV text (preserve leading zeros on phone/CNIC/member#)
  get: (m: Member) => string | number | null;
}

function daysOverdue(m: Member): number | string {
  if (!m.defaulter_since) return "";
  return Math.max(0, Math.floor((Date.now() - new Date(m.defaulter_since).getTime()) / 86400000));
}

export const EXPORT_COLUMNS: ExportColumn[] = [
  { id: "member_number", label: "Member #", text: true, get: (m) => m.member_number ?? "" },
  { id: "name", label: "Name", get: (m) => m.full_name },
  { id: "phone", label: "Phone", text: true, get: (m) => m.phone ?? "" },
  { id: "email", label: "Email", get: (m) => m.email ?? "" },
  { id: "cnic", label: "CNIC", text: true, get: (m) => m.cnic ?? "" },
  { id: "gender", label: "Gender", get: (m) => (m.gender ? m.gender[0].toUpperCase() + m.gender.slice(1) : "") },
  { id: "plan", label: "Plan(s)", get: (m) => memberPlanLabel(m, "") },
  { id: "monthly_fee", label: "Monthly Fee", numeric: true, get: (m) => Number(m.monthly_fee) || 0 },
  { id: "outstanding", label: "Outstanding", numeric: true, get: (m) => Number(m.outstanding_balance) || 0 },
  { id: "status", label: "Status", get: (m) => m.status[0].toUpperCase() + m.status.slice(1) },
  { id: "shift", label: "Shift", get: (m) => (m.shift ? SHIFT_LABEL[m.shift] ?? m.shift : "") },
  { id: "trainer", label: "Trainer", get: (m) => m.trainer?.full_name ?? "" },
  { id: "join_date", label: "Join Date", get: (m) => (m.join_date ? formatDate(m.join_date) : "") },
  { id: "start_date", label: "Start Date", get: (m) => (m.plan_start_date ? formatDate(m.plan_start_date) : "") },
  { id: "expiry", label: "Expiry", get: (m) => (m.plan_expiry_date ? formatDate(m.plan_expiry_date) : "") },
  { id: "defaulter_since", label: "Defaulter Since", get: (m) => (m.defaulter_since ? formatDate(m.defaulter_since) : "") },
  { id: "days_overdue", label: "Days Overdue", numeric: true, get: daysOverdue },
];

export const DEFAULT_COLUMN_IDS = ["member_number", "name", "phone", "plan", "monthly_fee", "outstanding", "status", "join_date"];
export const DEFAULTER_EXTRA_IDS = ["defaulter_since", "days_overdue"];

export interface ExportMeta {
  gymName: string;
  listLabel: string;
  dateStr: string;
}

function selectedCols(columnIds: string[]): ExportColumn[] {
  // Preserve registry order regardless of click order.
  return EXPORT_COLUMNS.filter((c) => columnIds.includes(c.id));
}

// ── CSV ─────────────────────────────────────────────────────────────────────
export function buildMembersCsv(rows: Member[], columnIds: string[], meta: ExportMeta): string {
  const cols = selectedCols(columnIds);

  const esc = (v: string | number | null | undefined): string => {
    if (v == null || v === "") return "";
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const asText = (v: string): string => (v ? `="${v.replace(/"/g, '""')}"` : "");
  const money = (n: number): number => (Number.isInteger(n) ? n : Number(n.toFixed(2)));
  const cell = (c: ExportColumn, m: Member): string => {
    const v = c.get(m);
    if (v == null || v === "") return "";
    if (c.text) return asText(String(v));
    if (c.numeric) return String(money(Number(v)));
    return esc(String(v));
  };

  const lines: string[] = [];
  lines.push(esc(meta.gymName));
  lines.push(esc(`${meta.listLabel} — exported ${meta.dateStr}`));
  lines.push("");
  lines.push(["#", ...cols.map((c) => c.label)].map(esc).join(","));
  rows.forEach((m, i) => {
    lines.push([String(i + 1), ...cols.map((c) => cell(c, m))].join(","));
  });
  lines.push("");
  lines.push(esc(`Total: ${rows.length}`));

  // UTF-8 BOM so Excel/Sheets open with correct encoding.
  return "﻿" + lines.join("\r\n");
}

// ── PDF (paginated table via jspdf-autotable) ────────────────────────────────
export async function buildMembersPdf(rows: Member[], columnIds: string[], meta: ExportMeta): Promise<jsPDF> {
  const cols = selectedCols(columnIds);

  const mod = (await import("jspdf")) as unknown as {
    jsPDF?: new (o?: object) => jsPDF;
    default?: (new (o?: object) => jsPDF) & { jsPDF?: new (o?: object) => jsPDF };
  };
  const Ctor = mod.jsPDF ?? mod.default?.jsPDF ?? mod.default;
  if (!Ctor) throw new Error("jsPDF constructor not found");
  const autoTable = (await import("jspdf-autotable")).default;

  const landscape = cols.length > 6;
  const doc = new Ctor({ orientation: landscape ? "landscape" : "portrait", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(15, 17, 38);
  doc.text(meta.gymName, 40, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(120, 125, 148);
  doc.text(`${meta.listLabel}  ·  ${rows.length} members  ·  ${meta.dateStr}`, 40, 58);

  // Right-align the index column + any numeric columns.
  const columnStyles: Record<number, { halign?: "right" | "left" | "center"; cellWidth?: number }> = {
    0: { halign: "right", cellWidth: 26 },
  };
  cols.forEach((c, idx) => {
    if (c.numeric) columnStyles[idx + 1] = { halign: "right" };
  });

  autoTable(doc, {
    startY: 72,
    head: [["#", ...cols.map((c) => c.label)]],
    body: rows.map((m, i) => [
      String(i + 1),
      ...cols.map((c) => {
        const v = c.get(m);
        if (v == null || v === "") return "";
        return c.numeric ? Number(v).toLocaleString("en-PK") : String(v);
      }),
    ]),
    styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak", textColor: [30, 30, 40] },
    headStyles: { fillColor: [15, 17, 38], textColor: 255, fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: [246, 247, 251] },
    columnStyles,
    margin: { left: 40, right: 40 },
    didDrawPage: () => {
      doc.setFontSize(8);
      doc.setTextColor(175, 180, 195);
      doc.text("Generated by Pulse GMS", pageW - 40, pageH - 20, { align: "right" });
    },
  });

  return doc;
}

// Filename helper: "fitness-emporium-defaulters-2026-06-05.csv"
export function exportFileName(gymName: string, listLabel: string, dateStr: string, ext: "csv" | "pdf"): string {
  const slug = (s: string) => s.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
  return `${slug(gymName) || "gym"}-${slug(listLabel)}-${dateStr}.${ext}`;
}
