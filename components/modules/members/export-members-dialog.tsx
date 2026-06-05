"use client";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Download, FileSpreadsheet, FileText, Check } from "lucide-react";
import type { Member } from "@/types";
import {
  EXPORT_COLUMNS,
  DEFAULT_COLUMN_IDS,
  DEFAULTER_EXTRA_IDS,
  LIST_LABELS,
  buildMembersCsv,
  buildMembersPdf,
  exportFileName,
  type ListKey,
} from "@/lib/members-export";

interface Props {
  open: boolean;
  onClose: () => void;
  lists: Record<Exclude<ListKey, "all">, Member[]>;
  defaultList: ListKey;
  gymName: string;
  applyFilters: (list: Member[]) => Member[];
  filtersActive: boolean;
}

const LIST_ORDER: ListKey[] = ["active", "frozen", "on_hold", "defaulters", "expired", "all"];

export function ExportMembersDialog({ open, onClose, lists, defaultList, gymName, applyFilters, filtersActive }: Props) {
  const [list, setList] = useState<ListKey>(defaultList);
  const [format, setFormat] = useState<"csv" | "pdf">("csv");
  const [selected, setSelected] = useState<Set<string>>(new Set(DEFAULT_COLUMN_IDS));
  const [onlyFiltered, setOnlyFiltered] = useState(true);
  const [busy, setBusy] = useState(false);

  // Reset to sensible defaults each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setList(defaultList);
    setFormat("csv");
    const cols = new Set(DEFAULT_COLUMN_IDS);
    if (defaultList === "defaulters") DEFAULTER_EXTRA_IDS.forEach((id) => cols.add(id));
    setSelected(cols);
    setOnlyFiltered(true);
  }, [open, defaultList]);

  function counts(key: ListKey): number {
    if (key === "all") return Object.values(lists).reduce((s, l) => s + l.length, 0);
    return lists[key as Exclude<ListKey, "all">].length;
  }

  function rowsFor(key: ListKey): Member[] {
    const base =
      key === "all"
        ? [...lists.active, ...lists.frozen, ...lists.on_hold, ...lists.defaulters, ...lists.expired]
        : lists[key as Exclude<ListKey, "all">];
    return filtersActive && onlyFiltered ? applyFilters(base) : base;
  }

  function toggleCol(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function download(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  async function handleExport() {
    const rows = rowsFor(list);
    if (rows.length === 0) {
      toast({ title: "Nothing to export", description: "This list is empty.", variant: "destructive" });
      return;
    }
    const columnIds = EXPORT_COLUMNS.filter((c) => selected.has(c.id)).map((c) => c.id);
    if (columnIds.length === 0) {
      toast({ title: "Pick at least one column", variant: "destructive" });
      return;
    }
    const dateStr = new Date().toISOString().slice(0, 10);
    const meta = { gymName, listLabel: LIST_LABELS[list], dateStr };

    setBusy(true);
    try {
      if (format === "csv") {
        const csv = buildMembersCsv(rows, columnIds, meta);
        download(new Blob([csv], { type: "text/csv;charset=utf-8" }), exportFileName(gymName, meta.listLabel, dateStr, "csv"));
        toast({ title: "CSV downloaded", description: `${rows.length} member(s) — opens in Excel/Sheets` });
      } else {
        const doc = await buildMembersPdf(rows, columnIds, meta);
        doc.save(exportFileName(gymName, meta.listLabel, dateStr, "pdf"));
        toast({ title: "PDF downloaded", description: `${rows.length} member(s)` });
      }
      onClose();
    } catch (e) {
      toast({ title: "Export failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  const exportCount = rowsFor(list).length;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Export members</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* List */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">List</p>
            <div className="flex flex-wrap gap-1.5">
              {LIST_ORDER.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setList(key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors inline-flex items-center gap-1.5 ${
                    list === key
                      ? "bg-primary/15 border-primary/30 text-primary"
                      : "bg-white/[0.03] border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"
                  }`}
                >
                  {LIST_LABELS[key]} <span className="text-[10px] opacity-70">{counts(key)}</span>
                </button>
              ))}
            </div>
            {filtersActive && (
              <label className="flex items-center gap-2 mt-3 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyFiltered}
                  onChange={(e) => setOnlyFiltered(e.target.checked)}
                  className="w-4 h-4 rounded accent-primary cursor-pointer"
                />
                Limit to current search / filters
              </label>
            )}
          </div>

          {/* Columns */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Columns</p>
              <div className="flex gap-2 text-[11px]">
                <button type="button" className="text-primary hover:underline" onClick={() => setSelected(new Set(EXPORT_COLUMNS.map((c) => c.id)))}>
                  All
                </button>
                <span className="text-muted-foreground/40">·</span>
                <button type="button" className="text-primary hover:underline" onClick={() => setSelected(new Set(DEFAULT_COLUMN_IDS))}>
                  Reset
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {EXPORT_COLUMNS.map((c) => {
                const on = selected.has(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCol(c.id)}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs text-left transition-colors ${
                      on
                        ? "bg-primary/10 border-primary/30 text-foreground"
                        : "bg-white/[0.02] border-sidebar-border text-muted-foreground hover:border-white/20"
                    }`}
                  >
                    <span className={`w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 border ${on ? "bg-primary border-primary" : "border-white/25"}`}>
                      {on && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                    </span>
                    <span className="truncate">{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Format */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Format</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFormat("csv")}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  format === "csv" ? "bg-primary/15 border-primary/30 text-primary" : "bg-white/[0.03] border-sidebar-border text-muted-foreground hover:border-white/20"
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" /> CSV (Excel)
              </button>
              <button
                type="button"
                onClick={() => setFormat("pdf")}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  format === "pdf" ? "bg-primary/15 border-primary/30 text-primary" : "bg-white/[0.03] border-sidebar-border text-muted-foreground hover:border-white/20"
                }`}
              >
                <FileText className="w-4 h-4" /> PDF
              </button>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button className="gap-2" onClick={handleExport} disabled={busy || exportCount === 0}>
            <Download className="w-4 h-4" />
            {busy ? "Exporting…" : `Export ${exportCount} ${format.toUpperCase()}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
