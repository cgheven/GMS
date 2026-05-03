"use client";
import { useMemo, useState } from "react";
import { Shield, Users, Dumbbell, TrendingUp, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ComplianceMember {
  id: string;
  full_name: string;
  cnic: string | null;
  phone: string | null;
  date_of_birth: string | null;
  join_date: string;
  plan_name: string | null;
  monthly_fee: number;
  category: "self" | "pt";
}

interface Props {
  gymName: string;
  members: ComplianceMember[];
  pctSelf: number;
  pctPt: number;
  totalSelf: number;
  totalPt: number;
  shownRevenue: number;
}

function formatDDMMYYYY(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function formatPKR(amount: number): string {
  return `PKR ${amount.toLocaleString("en-PK")}`;
}

function formatReportDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function downloadCSV(members: ComplianceMember[], gymName: string, reportDate: string) {
  const headers = ["#", "Full Name", "CNIC", "Phone", "Date of Birth", "Join Date", "Plan", "Monthly Fee (PKR)", "Type"];
  const rows = members.map((m, i) => [
    i + 1,
    m.full_name,
    m.cnic ?? "",
    m.phone ?? "",
    formatDDMMYYYY(m.date_of_birth),
    formatDDMMYYYY(m.join_date),
    m.plan_name ?? "",
    m.monthly_fee,
    m.category === "self" ? "Self Training" : "Personal Training",
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${gymName.replace(/\s+/g, "_")}_compliance_${reportDate}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

async function downloadPDF(
  members: ComplianceMember[],
  gymName: string,
  reportDate: string,
  selfCount: number,
  ptCount: number,
  revenue: number,
  pctSelf: number,
  pctPt: number,
) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Compliance Report", 14, 20);

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(gymName, 14, 28);

  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(`Generated: ${reportDate}`, 14, 35);
  doc.text(
    `Self Training: ${selfCount} (${pctSelf}% shown)   |   Personal Training: ${ptCount} (${pctPt}% shown)   |   Total Revenue: PKR ${revenue.toLocaleString("en-PK")}`,
    14,
    41,
  );

  doc.setTextColor(0, 0, 0);

  autoTable(doc, {
    startY: 48,
    head: [["#", "Full Name", "CNIC", "Phone", "Date of Birth", "Join Date", "Plan", "Fee (PKR)", "Type"]],
    body: members.map((m, i) => [
      i + 1,
      m.full_name,
      m.cnic ?? "—",
      m.phone ?? "—",
      formatDDMMYYYY(m.date_of_birth),
      formatDDMMYYYY(m.join_date),
      m.plan_name ?? "—",
      m.monthly_fee.toLocaleString("en-PK"),
      m.category === "self" ? "Self" : "PT",
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [28, 25, 23], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: { 0: { halign: "center", cellWidth: 10 }, 7: { halign: "right" }, 8: { halign: "center", cellWidth: 18 } },
  });

  doc.save(`${gymName.replace(/\s+/g, "_")}_compliance_${reportDate}.pdf`);
}

export function CompliancePortalClient({ gymName, members, pctSelf, pctPt, totalSelf, totalPt, shownRevenue }: Props) {
  const [exportingPDF, setExportingPDF] = useState(false);

  const selfMembers = useMemo(() => members.filter((m) => m.category === "self"), [members]);
  const ptMembers = useMemo(() => members.filter((m) => m.category === "pt"), [members]);
  const reportDate = useMemo(() => formatReportDate(new Date()), []);
  const fileDate = useMemo(() => new Date().toISOString().slice(0, 10), []);

  async function handlePDF() {
    setExportingPDF(true);
    await downloadPDF(members, gymName, fileDate, selfMembers.length, ptMembers.length, shownRevenue, pctSelf, pctPt);
    setExportingPDF(false);
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-serif font-normal tracking-tight">Compliance Report</h1>
            <p className="text-muted-foreground text-sm mt-0.5">{gymName}</p>
          </div>
        </div>
        <div className="flex flex-col sm:items-end gap-2 shrink-0">
          <div className="text-sm text-muted-foreground sm:text-right">
            <p className="font-medium text-foreground">{reportDate}</p>
            <p className="text-xs mt-0.5 opacity-70">Generated automatically</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => downloadCSV(members, gymName, fileDate)}
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={handlePDF}
              disabled={exportingPDF}
            >
              <FileText className="w-3.5 h-3.5" />
              {exportingPDF ? "Generating…" : "PDF"}
            </Button>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Self Training */}
        <div className="rounded-2xl border border-sidebar-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Self Training
            </span>
          </div>
          <p className="text-3xl font-bold text-foreground">{selfMembers.length}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {pctSelf}% of {totalSelf} total members
          </p>
        </div>

        {/* Personal Training */}
        <div className="rounded-2xl border border-sidebar-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Dumbbell className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Personal Training
            </span>
          </div>
          <p className="text-3xl font-bold text-foreground">{ptMembers.length}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {pctPt}% of {totalPt} total members
          </p>
        </div>

        {/* Monthly Revenue */}
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold text-emerald-400/80 uppercase tracking-wider">
              Monthly Revenue (PKR)
            </span>
          </div>
          <p className="text-3xl font-bold text-emerald-400">
            {shownRevenue.toLocaleString("en-PK")}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            from {members.length} visible member{members.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Member table */}
      <div className="rounded-2xl border border-sidebar-border bg-card overflow-hidden">
        {members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
            <Shield className="w-10 h-10 opacity-20" />
            <p className="text-sm">No members in this report</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-sidebar-border">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-10">#</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Full Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">CNIC</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Phone</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Date of Birth</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Join Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Plan</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Monthly Fee</th>
                </tr>
              </thead>
              <tbody>
                {selfMembers.map((m, idx) => (
                  <tr key={m.id} className={`border-b border-sidebar-border/50 ${idx % 2 === 0 ? "bg-transparent" : "bg-white/[0.015]"}`}>
                    <td className="px-4 py-3 text-muted-foreground text-xs tabular-nums">{idx + 1}</td>
                    <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">{m.full_name}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{m.cnic ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{m.phone ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{formatDDMMYYYY(m.date_of_birth)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDDMMYYYY(m.join_date)}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{m.plan_name ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-medium text-foreground whitespace-nowrap">{formatPKR(m.monthly_fee)}</td>
                  </tr>
                ))}

                {selfMembers.length > 0 && ptMembers.length > 0 && (
                  <tr className="border-b border-sidebar-border/50">
                    <td colSpan={8} className="px-4 py-2 bg-white/[0.025]">
                      <div className="flex items-center gap-2">
                        <Dumbbell className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                          Personal Training Members
                        </span>
                      </div>
                    </td>
                  </tr>
                )}

                {ptMembers.map((m, idx) => {
                  const globalIdx = selfMembers.length + idx;
                  return (
                    <tr key={m.id} className={`border-b border-sidebar-border/50 ${globalIdx % 2 === 0 ? "bg-transparent" : "bg-white/[0.015]"}`}>
                      <td className="px-4 py-3 text-muted-foreground text-xs tabular-nums">{globalIdx + 1}</td>
                      <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">{m.full_name}</td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{m.cnic ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{m.phone ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{formatDDMMYYYY(m.date_of_birth)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDDMMYYYY(m.join_date)}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{m.plan_name ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-medium text-foreground whitespace-nowrap">{formatPKR(m.monthly_fee)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer note */}
      <p className="text-xs text-muted-foreground/60 text-center pb-2">
        This report is generated for compliance purposes. Member count is limited as per regulatory requirements.
      </p>
    </div>
  );
}
