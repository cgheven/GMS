"use client";
import { useState, useMemo, useCallback } from "react";
import {
  CreditCard, CheckCircle2, Clock, AlertTriangle, Wallet,
  TrendingUp, Edit2, Banknote, RefreshCw, Plus, XCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { formatCurrency, formatDate, formatDateInput } from "@/lib/utils";
import type { Payment, PaymentMethod, PaymentStatus, Member, MembershipPlan } from "@/types";

type MemberRow = Pick<Member, "id" | "full_name" | "monthly_fee" | "plan_id" | "status" | "plan_expiry_date" | "outstanding_balance">;
type PlanRow = Pick<MembershipPlan, "id" | "name" | "price" | "duration_type">;

interface Props {
  gymId: string | null;
  payments: Payment[];
  members: MemberRow[];
  plans: PlanRow[];
}

const methodLabels: Record<PaymentMethod, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  jazzcash: "JazzCash",
  easypaisa: "Easypaisa",
  card: "Card",
  other: "Other",
};

const statusConfig: Record<PaymentStatus, { label: string; color: string }> = {
  paid:     { label: "Paid",     color: "text-emerald-400" },
  pending:  { label: "Pending",  color: "text-primary" },
  overdue:  { label: "Overdue",  color: "text-rose-400" },
  refunded: { label: "Refunded", color: "text-sky-400" },
  waived:   { label: "Waived",   color: "text-muted-foreground" },
};

function genReceipt(memberName: string, period: string) {
  const initials = memberName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  const rand = Math.floor(Math.random() * 900 + 100);
  return `PLS-${(period ?? "").replace("-", "")}-${initials}-${rand}`;
}

const emptyAddForm = {
  member_id: "",
  total_amount: "",
  discount: "0",
  late_fee: "0",
  method: "cash" as PaymentMethod,
  date: formatDateInput(new Date()),
  for_period: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`,
  notes: "",
  receipt_number: "",
};

export function PaymentsClient({ gymId, payments: initialPayments, members, plans }: Props) {
  const [payments, setPayments] = useState<Payment[]>(initialPayments);
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | "all">("all");

  // Mark paid dialog
  const [markDialog, setMarkDialog] = useState<Payment | null>(null);
  const [markForm, setMarkForm] = useState({
    method: "cash" as PaymentMethod,
    date: formatDateInput(new Date()),
    late_fee: "0",
    notes: "",
    receipt_number: "",
  });

  // Add payment dialog
  const [addDialog, setAddDialog] = useState(false);
  const [addForm, setAddForm] = useState(emptyAddForm);

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const memberMap = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m])), [members]);
  const planMap = useMemo(() => Object.fromEntries(plans.map((p) => [p.id, p])), [plans]);

  async function reload() {
    if (!gymId) return;
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("pulse_payments")
      .select("*, member:pulse_members(full_name,plan_id)")
      .eq("gym_id", gymId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      toast({ title: "Failed to load payments", description: error.message, variant: "destructive" });
    } else {
      setPayments((data ?? []) as Payment[]);
    }
    setLoading(false);
  }

  function openMarkPaid(p: Payment) {
    const memberName = p.member?.full_name ?? "";
    setMarkDialog(p);
    setMarkForm({
      method: "cash",
      date: formatDateInput(new Date()),
      late_fee: p.late_fee?.toString() ?? "0",
      notes: "",
      receipt_number: genReceipt(memberName, p.for_period ?? ""),
    });
  }

  async function handleMarkPaid() {
    if (!markDialog) return;
    setSaving(true);
    const supabase = createClient();
    const lateFee = parseFloat(markForm.late_fee) || 0;
    const base = Number(markDialog.total_amount) - Number(markDialog.late_fee ?? 0);
    const newTotal = base + lateFee - Number(markDialog.discount ?? 0);
    const { error } = await supabase.from("pulse_payments").update({
      status: "paid",
      payment_method: markForm.method,
      payment_date: markForm.date,
      late_fee: lateFee,
      total_amount: Math.max(0, newTotal),
      notes: markForm.notes || null,
      receipt_number: markForm.receipt_number,
    }).eq("id", markDialog.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Payment recorded" });
      setMarkDialog(null);
      await reload();
    }
    setSaving(false);
  }

  async function updateStatus(p: Payment, status: PaymentStatus) {
    const supabase = createClient();
    const { error } = await supabase.from("pulse_payments").update({ status }).eq("id", p.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: `Marked as ${statusConfig[status].label}` });
    await reload();
  }

  function openAddDialog() {
    setAddForm({ ...emptyAddForm, date: formatDateInput(new Date()) });
    setAddDialog(true);
  }

  async function handleAddPayment() {
    if (!gymId || !addForm.member_id || !addForm.total_amount) {
      toast({ title: "Member and amount are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const member = memberMap[addForm.member_id];
    const receipt = genReceipt(member?.full_name ?? "M", addForm.for_period);
    const totalAmount = parseFloat(addForm.total_amount) || 0;
    const discount = parseFloat(addForm.discount) || 0;
    const lateFee = parseFloat(addForm.late_fee) || 0;
    const { error } = await supabase.from("pulse_payments").insert({
      gym_id: gymId,
      member_id: addForm.member_id,
      plan_id: member?.plan_id ?? null,
      amount: totalAmount,
      discount,
      late_fee: lateFee,
      total_amount: Math.max(0, totalAmount - discount + lateFee),
      payment_method: addForm.method,
      payment_date: addForm.date || null,
      for_period: addForm.for_period || null,
      status: addForm.date ? "paid" : "pending",
      receipt_number: addForm.receipt_number || receipt,
      notes: addForm.notes || null,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Payment added" });
      setAddDialog(false);
      await reload();
    }
    setSaving(false);
  }

  const filtered = useMemo(() => {
    let list = payments;
    if (statusFilter !== "all") list = list.filter((p) => p.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => (p.member?.full_name ?? "").toLowerCase().includes(q) || (p.receipt_number ?? "").toLowerCase().includes(q));
    }
    return list;
  }, [payments, statusFilter, search]);

  const stats = useMemo(() => {
    const collected = payments.filter((p) => p.status === "paid").reduce((s, p) => s + Number(p.total_amount), 0);
    const pending = payments.filter((p) => p.status === "pending" || p.status === "overdue").reduce((s, p) => s + Number(p.total_amount), 0);
    const due = payments.reduce((s, p) => s + Number(p.total_amount), 0);
    return { due, collected, pending, rate: due > 0 ? Math.round((collected / due) * 100) : 0 };
  }, [payments]);

  function PaymentRow({ p }: { p: Payment }) {
    const cfg = statusConfig[p.status];
    const planName = p.member?.plan_id ? (planMap[p.member.plan_id]?.name ?? null) : null;
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/[0.03] transition-colors border border-transparent hover:border-white/5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-foreground">{p.member?.full_name ?? "—"}</p>
            {planName && <span className="text-xs text-muted-foreground bg-white/5 px-1.5 py-0.5 rounded">{planName}</span>}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
            {p.for_period && <span className="text-xs text-muted-foreground">Period: {p.for_period}</span>}
            {p.payment_date && <span className="text-xs text-muted-foreground">Paid: {formatDate(p.payment_date)}</span>}
            {p.payment_method && <span className="text-xs text-muted-foreground">{methodLabels[p.payment_method]}</span>}
            {p.receipt_number && <span className="text-xs text-muted-foreground font-mono">{p.receipt_number}</span>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold text-foreground">{formatCurrency(Number(p.total_amount))}</p>
          {Number(p.discount) > 0 && <p className="text-xs text-emerald-400">-{formatCurrency(p.discount)} disc</p>}
          {Number(p.late_fee) > 0 && <p className="text-xs text-rose-400">+{formatCurrency(p.late_fee)} late</p>}
          <p className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {p.status !== "paid" && p.status !== "waived" && p.status !== "refunded" && (
            <>
              <Button
                variant="ghost" size="sm"
                className="h-7 text-xs gap-1 text-emerald-400 hover:bg-emerald-500/10 border border-emerald-500/20"
                onClick={() => openMarkPaid(p)}
              >
                <CheckCircle2 className="w-3 h-3" /> Pay
              </Button>
              {p.status !== "overdue" && (
                <Button
                  variant="ghost" size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-rose-400"
                  title="Mark Overdue"
                  onClick={() => updateStatus(p, "overdue")}
                >
                  <AlertTriangle className="w-3 h-3" />
                </Button>
              )}
            </>
          )}
          {p.status === "paid" && (
            <Button
              variant="ghost" size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-sky-400"
              title="Refund"
              onClick={() => updateStatus(p, "refunded")}
            >
              <XCircle className="w-3 h-3" />
            </Button>
          )}
          {(p.status === "pending" || p.status === "overdue") && (
            <Button
              variant="ghost" size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              title="Waive"
              onClick={() => updateStatus(p, "waived")}
            >
              <Edit2 className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-normal tracking-tight">Payments</h1>
          <p className="text-muted-foreground text-sm mt-1">Member payment collection &amp; tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => reload()} disabled={loading} variant="ghost" size="icon" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={openAddDialog} className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
            <Plus className="w-4 h-4" /> Add Payment
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Due",        value: formatCurrency(stats.due),       icon: CreditCard,  color: "text-foreground",   bg: "bg-white/5 border border-white/10" },
          { label: "Collected",        value: formatCurrency(stats.collected),  icon: Wallet,      color: "text-emerald-400",  bg: "bg-emerald-500/10 border border-emerald-500/20" },
          { label: "Pending",          value: formatCurrency(stats.pending),    icon: Clock,       color: "text-primary",      bg: "bg-primary/10 border border-primary/20" },
          { label: "Collection Rate",  value: `${stats.rate}%`,                icon: TrendingUp,  color: "text-primary",      bg: "bg-primary/10 border border-primary/20" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="rounded-2xl border border-sidebar-border bg-card p-5">
            <div className="flex items-center gap-3">
              <div className={`flex items-center justify-center w-9 h-9 rounded-xl ${bg} shrink-0`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-xl font-bold text-foreground leading-none mt-0.5">{value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Search by member name or receipt..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as PaymentStatus | "all")}>
          <SelectTrigger className="sm:max-w-[160px]"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {(Object.keys(statusConfig) as PaymentStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{statusConfig[s].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Payments List */}
      <div className="rounded-2xl border border-sidebar-border bg-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
            <CreditCard className="w-10 h-10 opacity-20" />
            <p className="text-sm">No payment records found</p>
            <p className="text-xs">Add a payment to get started</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {filtered.map((p) => <PaymentRow key={p.id} p={p} />)}
          </div>
        )}
      </div>

      {/* Mark Paid Dialog */}
      <Dialog open={!!markDialog} onOpenChange={(o) => !o && setMarkDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-white/5 px-3 py-2">
              <p className="text-xs text-muted-foreground">Member</p>
              <p className="text-sm font-medium">{markDialog?.member?.full_name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {markDialog?.for_period} · {formatCurrency(markDialog?.total_amount ?? 0)}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Payment Method</Label>
              <Select value={markForm.method} onValueChange={(v) => setMarkForm({ ...markForm, method: v as PaymentMethod })}>
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
                <Input type="date" value={markForm.date} onChange={(e) => setMarkForm({ ...markForm, date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Late Fee (PKR)</Label>
                <Input type="number" placeholder="0" value={markForm.late_fee} onChange={(e) => setMarkForm({ ...markForm, late_fee: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Receipt No.</Label>
              <Input value={markForm.receipt_number} onChange={(e) => setMarkForm({ ...markForm, receipt_number: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input placeholder="Optional" value={markForm.notes} onChange={(e) => setMarkForm({ ...markForm, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkDialog(null)}>Cancel</Button>
            <Button onClick={handleMarkPaid} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {saving ? "Saving…" : "Confirm Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Payment Dialog */}
      <Dialog open={addDialog} onOpenChange={(o) => !o && setAddDialog(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Member *</Label>
              <Select value={addForm.member_id} onValueChange={(v) => {
                const m = memberMap[v];
                setAddForm({ ...addForm, member_id: v, total_amount: m ? String(m.monthly_fee) : addForm.total_amount });
              }}>
                <SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount (PKR) *</Label>
                <Input type="number" placeholder="0" value={addForm.total_amount} onChange={(e) => setAddForm({ ...addForm, total_amount: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Discount (PKR)</Label>
                <Input type="number" placeholder="0" value={addForm.discount} onChange={(e) => setAddForm({ ...addForm, discount: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Late Fee (PKR)</Label>
                <Input type="number" placeholder="0" value={addForm.late_fee} onChange={(e) => setAddForm({ ...addForm, late_fee: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>For Period</Label>
                <Input type="month" value={addForm.for_period} onChange={(e) => setAddForm({ ...addForm, for_period: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Payment Method</Label>
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
            <Button onClick={handleAddPayment} disabled={saving} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              {saving ? "Saving…" : "Add Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
