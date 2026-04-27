"use client";
import { useState, useMemo, useRef, useEffect, useTransition } from "react";
import {
  CreditCard, AlertTriangle, Plus, XCircle, Search, X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { revalidatePayments } from "@/app/actions/payments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { formatCurrency, formatDate, formatDateInput } from "@/lib/utils";
import type { Payment, PaymentMethod, PaymentStatus, Member, MembershipPlan } from "@/types";

type MemberRow = Pick<Member,
  "id" | "full_name" | "member_number" | "monthly_fee" | "plan_id" |
  "status" | "plan_expiry_date" | "outstanding_balance"
> & { plan?: { name: string } | null };

type PlanRow = Pick<MembershipPlan, "id" | "name" | "price" | "duration_type">;

interface Props {
  gymId: string | null;
  payments: Payment[];
  members: MemberRow[];
  plans: PlanRow[];
}

const methodLabels: Record<PaymentMethod, string> = {
  cash: "Cash", bank_transfer: "Bank Transfer", jazzcash: "JazzCash",
  easypaisa: "Easypaisa", card: "Card", other: "Other",
};

const statusStyles: Record<PaymentStatus, string> = {
  paid:     "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  pending:  "bg-primary/10 text-primary border-primary/20",
  overdue:  "bg-rose-500/10 text-rose-400 border-rose-500/20",
  refunded: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  waived:   "bg-white/5 text-muted-foreground border-white/10",
};

const statusLabels: Record<PaymentStatus, string> = {
  paid: "Paid", pending: "Pending", overdue: "Overdue", refunded: "Refunded", waived: "Waived",
};

function StatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusStyles[status]}`}>
      {statusLabels[status]}
    </span>
  );
}

function genReceipt(memberName: string, period: string) {
  const initials = memberName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  return `PLS-${(period ?? "").replace("-", "")}-${initials}-${Math.floor(Math.random() * 900 + 100)}`;
}

const CURRENT_MONTH = (() => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
})();

// ─── Member search combobox ───────────────────────────────────────────────────
function MemberSearch({ members, value, onChange }: {
  members: MemberRow[];
  value: string;
  onChange: (id: string, member: MemberRow | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = members.find((m) => m.id === value) ?? null;
  const filtered = useMemo(() => {
    if (!query.trim()) return members.slice(0, 8);
    const q = query.toLowerCase();
    return members.filter((m) => m.full_name.toLowerCase().includes(q)).slice(0, 8);
  }, [query, members]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      {selected ? (
        <div className="flex items-center justify-between h-10 px-3 rounded-lg border border-sidebar-border bg-card text-sm">
          <span className="font-medium truncate">{selected.full_name}</span>
          <button type="button" onClick={() => { onChange("", null); setQuery(""); }} className="text-muted-foreground hover:text-foreground ml-2 shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            className="w-full h-10 pl-8 pr-3 rounded-lg border border-sidebar-border bg-card text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/50"
            placeholder="Search member..." value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)} autoComplete="off"
          />
        </div>
      )}
      {open && !selected && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-lg border border-sidebar-border bg-card shadow-xl overflow-hidden">
          {filtered.length === 0
            ? <p className="px-3 py-3 text-sm text-muted-foreground">No members found</p>
            : filtered.map((m) => (
              <button key={m.id} type="button"
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors text-left"
                onMouseDown={(e) => { e.preventDefault(); onChange(m.id, m); setQuery(""); setOpen(false); }}>
                <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  {m.full_name[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{m.full_name}</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(m.monthly_fee)} · {m.plan?.name ?? "No plan"}</p>
                </div>
              </button>
            ))
          }
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function PaymentsClient({ gymId, payments: initialPayments, members }: Props) {
  const [payments, setPayments] = useState<Payment[]>(initialPayments);
  const [histSearch, setHistSearch] = useState("");
  const [histStatus, setHistStatus] = useState<PaymentStatus | "all">("all");
  const [addDialog, setAddDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();

  const [addForm, setAddForm] = useState({
    member_id: "", total_amount: "", discount: "0", late_fee: "0",
    method: "cash" as PaymentMethod, date: formatDateInput(new Date()),
    for_period: CURRENT_MONTH, receipt_number: "", notes: "",
  });

  function hardRefresh() {
    startRefresh(async () => { await revalidatePayments(); router.refresh(); });
  }

  const historyRows = useMemo(() => {
    let list = payments;
    if (histStatus !== "all") list = list.filter((p) => p.status === histStatus);
    if (histSearch.trim()) {
      const q = histSearch.toLowerCase();
      list = list.filter((p) =>
        (p.member?.full_name ?? "").toLowerCase().includes(q) ||
        (p.receipt_number ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [payments, histStatus, histSearch]);

  async function updateStatus(p: Payment, status: PaymentStatus) {
    setPayments((prev) => prev.map((pay) => pay.id === p.id ? { ...pay, status } : pay));
    const supabase = createClient();
    const { error } = await supabase.from("pulse_payments").update({ status }).eq("id", p.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setPayments((prev) => prev.map((pay) => pay.id === p.id ? p : pay));
    }
  }

  async function handleAddPayment() {
    if (!gymId || !addForm.member_id || !addForm.total_amount) {
      toast({ title: "Member and amount are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const member = members.find((m) => m.id === addForm.member_id);
    const receipt = genReceipt(member?.full_name ?? "M", addForm.for_period);
    const totalAmount = parseFloat(addForm.total_amount) || 0;
    const discount = parseFloat(addForm.discount) || 0;
    const lateFee = parseFloat(addForm.late_fee) || 0;
    const { data: newRow, error } = await supabase.from("pulse_payments")
      .insert({
        gym_id: gymId, member_id: addForm.member_id, plan_id: member?.plan_id ?? null,
        amount: totalAmount, discount, late_fee: lateFee,
        total_amount: Math.max(0, totalAmount - discount + lateFee),
        payment_method: addForm.method, payment_date: addForm.date || null,
        for_period: addForm.for_period || null,
        status: addForm.date ? "paid" : "pending",
        receipt_number: addForm.receipt_number || receipt,
        notes: addForm.notes || null,
      })
      .select("*, member:pulse_members(full_name,plan_id)").single();
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Entry added" }); setAddDialog(false); setPayments((prev) => [newRow as Payment, ...prev]); }
    setSaving(false);
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-normal tracking-tight">Transactions</h1>
          <p className="text-muted-foreground text-sm mt-1">Full payment history and records</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={hardRefresh} disabled={refreshing} variant="outline" size="sm" className="gap-2">
            {refreshing ? "Refreshing…" : "Refresh"}
          </Button>
          <Button onClick={() => setAddDialog(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Add Entry
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by name or receipt…" value={histSearch}
            onChange={(e) => setHistSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {([["all", "All"], ["paid", "Paid"], ["pending", "Pending"], ["overdue", "Overdue"], ["refunded", "Refunded"], ["waived", "Waived"]] as const).map(([val, label]) => (
            <button key={val} type="button" onClick={() => setHistStatus(val as PaymentStatus | "all")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                histStatus === val
                  ? val === "paid"     ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : val === "overdue"  ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                  : val === "pending"  ? "bg-primary/10 border-primary/30 text-primary"
                  : "bg-primary/15 border-primary/40 text-primary"
                  : "bg-white/[0.03] border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"
              }`}>{label}</button>
          ))}
        </div>
      </div>

      {/* Transactions table */}
      <div className="rounded-2xl border border-sidebar-border bg-card overflow-hidden">
        {historyRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
            <CreditCard className="w-10 h-10 opacity-20" />
            <p className="text-sm">No transactions found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-sidebar-border">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Member</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Period</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Method</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden xl:table-cell">Receipt</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Amount</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sidebar-border/50">
                {historyRows.map((p) => {
                  const name = p.member?.full_name ?? "—";
                  return (
                    <tr key={p.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                            {name[0]?.toUpperCase() ?? "?"}
                          </div>
                          <p className="font-medium text-foreground">{name}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-sm text-muted-foreground">{p.for_period ?? "—"}</span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-sm text-muted-foreground">
                          {p.payment_method ? methodLabels[p.payment_method] : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-sm text-muted-foreground">
                          {p.payment_date ? formatDate(p.payment_date) : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell">
                        <span className="text-xs text-muted-foreground font-mono">{p.receipt_number ?? "—"}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="font-semibold text-foreground">{formatCurrency(Number(p.total_amount))}</p>
                        {Number(p.discount) > 0 && <p className="text-xs text-emerald-400">-{formatCurrency(p.discount)} disc</p>}
                        {Number(p.late_fee) > 0 && <p className="text-xs text-rose-400">+{formatCurrency(p.late_fee)} late</p>}
                      </td>
                      <td className="px-4 py-3 text-center"><StatusBadge status={p.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {p.status !== "paid" && p.status !== "waived" && p.status !== "refunded" && (
                            <>
                              {p.status !== "overdue" && (
                                <button title="Mark Overdue" onClick={() => updateStatus(p, "overdue")}
                                  className="p-1.5 rounded text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-colors">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button title="Waive" onClick={() => updateStatus(p, "waived")}
                                className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors">
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          {p.status === "paid" && (
                            <button title="Mark Refunded" onClick={() => updateStatus(p, "refunded")}
                              className="p-1.5 rounded text-muted-foreground hover:text-sky-400 hover:bg-sky-500/10 transition-colors">
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Entry Dialog */}
      <Dialog open={addDialog} onOpenChange={(o) => !o && setAddDialog(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add Manual Entry</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Member *</Label>
              <MemberSearch members={members} value={addForm.member_id}
                onChange={(id, m) => setAddForm({ ...addForm, member_id: id, total_amount: m ? String(m.monthly_fee) : "" })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount (PKR) *</Label>
                <Input type="number" placeholder="0" value={addForm.total_amount} onChange={(e) => setAddForm({ ...addForm, total_amount: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>For Period</Label>
                <Input type="month" value={addForm.for_period} onChange={(e) => setAddForm({ ...addForm, for_period: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Discount (PKR)</Label>
                <Input type="number" placeholder="0" value={addForm.discount} onChange={(e) => setAddForm({ ...addForm, discount: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Late Fee (PKR)</Label>
                <Input type="number" placeholder="0" value={addForm.late_fee} onChange={(e) => setAddForm({ ...addForm, late_fee: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Method</Label>
              <Select value={addForm.method} onValueChange={(v) => setAddForm({ ...addForm, method: v as PaymentMethod })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(methodLabels) as [PaymentMethod, string][]).map(([k, label]) => (
                    <SelectItem key={k} value={k}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Payment Date</Label>
                <Input type="date" value={addForm.date} onChange={(e) => setAddForm({ ...addForm, date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Receipt No.</Label>
                <Input placeholder="Auto-generate" value={addForm.receipt_number} onChange={(e) => setAddForm({ ...addForm, receipt_number: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input placeholder="Optional" value={addForm.notes} onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialog(false)}>Cancel</Button>
            <Button onClick={handleAddPayment} disabled={saving}>
              {saving ? "Saving…" : "Add Entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
