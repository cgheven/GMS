"use client";
import { useState, useMemo, useRef, useEffect, useTransition } from "react";
import {
  CreditCard, CheckCircle2, Clock, AlertTriangle, Wallet,
  TrendingUp, RefreshCw, Plus, XCircle, Search, X,
  ChevronLeft, ChevronRight, Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { revalidatePayments } from "@/app/actions/payments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  jazzcash: "JazzCash",
  easypaisa: "Easypaisa",
  card: "Card",
  other: "Other",
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
  const rand = Math.floor(Math.random() * 900 + 100);
  return `PLS-${(period ?? "").replace("-", "")}-${initials}-${rand}`;
}

function monthLabel(key: string) {
  const [y, m] = key.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function offsetMonth(key: string, delta: number) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const NOW = new Date();
const CURRENT_MONTH = `${NOW.getFullYear()}-${String(NOW.getMonth() + 1).padStart(2, "0")}`;

// ─── Member search combobox (used in Add Payment dialog) ─────────────────────
function MemberSearch({
  members, value, onChange,
}: {
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
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      {selected ? (
        <div className="flex items-center justify-between h-10 px-3 rounded-lg border border-sidebar-border bg-card text-sm">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
              {selected.full_name[0].toUpperCase()}
            </div>
            <span className="font-medium truncate">{selected.full_name}</span>
          </div>
          <button type="button" onClick={() => { onChange("", null); setQuery(""); }} className="text-muted-foreground hover:text-foreground ml-2 shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            className="w-full h-10 pl-8 pr-3 rounded-lg border border-sidebar-border bg-card text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/50"
            placeholder="Search by name..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            autoComplete="off"
          />
        </div>
      )}
      {open && !selected && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-lg border border-sidebar-border bg-card shadow-xl overflow-hidden">
          {filtered.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">No members found</p>
          ) : filtered.map((m) => (
            <button
              key={m.id}
              type="button"
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors text-left"
              onMouseDown={(e) => { e.preventDefault(); onChange(m.id, m); setQuery(""); setOpen(false); }}
            >
              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                {m.full_name[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{m.full_name}</p>
                <p className="text-xs text-muted-foreground">{formatCurrency(m.monthly_fee)} · {m.plan?.name ?? "No plan"}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function PaymentsClient({ gymId, payments: initialPayments, members, plans }: Props) {
  const [payments, setPayments] = useState<Payment[]>(initialPayments);
  const [selectedMonth, setSelectedMonth] = useState(CURRENT_MONTH);
  const [search, setSearch] = useState("");
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();

  // Pay dialog — used for both "mark existing payment paid" and "create + pay"
  const [payDialog, setPayDialog] = useState<{ member: MemberRow; payment: Payment | null } | null>(null);
  const [payForm, setPayForm] = useState({
    amount: "",
    discount: "0",
    late_fee: "0",
    method: "cash" as PaymentMethod,
    date: formatDateInput(new Date()),
    receipt_number: "",
    notes: "",
  });

  // History tab filters
  const [histSearch, setHistSearch] = useState("");
  const [histStatus, setHistStatus] = useState<PaymentStatus | "all">("all");

  // Add payment dialog (manual / historical entry)
  const [addDialog, setAddDialog] = useState(false);
  const [addForm, setAddForm] = useState({
    member_id: "",
    total_amount: "",
    discount: "0",
    late_fee: "0",
    method: "cash" as PaymentMethod,
    date: formatDateInput(new Date()),
    for_period: CURRENT_MONTH,
    receipt_number: "",
    notes: "",
  });

  const [saving, setSaving] = useState(false);

  function hardRefresh() {
    startRefresh(async () => {
      await revalidatePayments();
      router.refresh();
    });
  }

  // ── Per-month stats ─────────────────────────────────────────────────────────
  const monthPayments = useMemo(
    () => payments.filter((p) => p.for_period === selectedMonth),
    [payments, selectedMonth]
  );

  const paidMemberIds = useMemo(
    () => new Set(monthPayments.filter((p) => p.status === "paid").map((p) => p.member_id)),
    [monthPayments]
  );

  const stats = useMemo(() => {
    const paid = members.filter((m) => paidMemberIds.has(m.id)).length;
    const collected = monthPayments.filter((p) => p.status === "paid").reduce((s, p) => s + Number(p.total_amount), 0);
    const unpaid = members.length - paid;
    return { paid, unpaid, collected, total: members.length };
  }, [members, paidMemberIds, monthPayments]);

  // ── Members list for current month ─────────────────────────────────────────
  const memberRows = useMemo(() => {
    const q = search.toLowerCase();
    return members
      .filter((m) => !q || m.full_name.toLowerCase().includes(q))
      .map((m) => {
        const payment = monthPayments.find((p) => p.member_id === m.id) ?? null;
        return { member: m, payment };
      })
      .sort((a, b) => {
        // Unpaid / overdue first, paid last
        const rank = (r: typeof a) => {
          if (!r.payment || r.payment.status === "overdue") return 0;
          if (r.payment.status === "pending") return 1;
          return 2;
        };
        return rank(a) - rank(b);
      });
  }, [members, monthPayments, search]);

  // ── History list ────────────────────────────────────────────────────────────
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

  // ── Open pay dialog ─────────────────────────────────────────────────────────
  function openPay(member: MemberRow, payment: Payment | null) {
    setPayDialog({ member, payment });
    setPayForm({
      amount: String(payment ? Number(payment.total_amount) : member.monthly_fee),
      discount: payment ? String(payment.discount ?? 0) : "0",
      late_fee: payment ? String(payment.late_fee ?? 0) : "0",
      method: payment?.payment_method ?? "cash",
      date: formatDateInput(new Date()),
      receipt_number: payment?.receipt_number || genReceipt(member.full_name, selectedMonth),
      notes: payment?.notes ?? "",
    });
  }

  // ── Confirm payment ─────────────────────────────────────────────────────────
  async function handlePay() {
    if (!payDialog || !gymId) return;
    setSaving(true);
    const { member, payment } = payDialog;
    const amount = parseFloat(payForm.amount) || member.monthly_fee;
    const discount = parseFloat(payForm.discount) || 0;
    const lateFee = parseFloat(payForm.late_fee) || 0;
    const total = Math.max(0, amount - discount + lateFee);

    const supabase = createClient();

    if (payment) {
      // Update existing record
      const update = {
        status: "paid" as PaymentStatus,
        payment_method: payForm.method,
        payment_date: payForm.date,
        late_fee: lateFee,
        discount,
        total_amount: total,
        receipt_number: payForm.receipt_number,
        notes: payForm.notes || null,
      };
      setPayDialog(null);
      setPayments((prev) => prev.map((p) => p.id === payment.id ? { ...p, ...update } : p));
      const { error } = await supabase.from("pulse_payments").update(update).eq("id", payment.id);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        setPayments((prev) => prev.map((p) => p.id === payment.id ? payment : p));
      } else {
        toast({ title: "Payment recorded" });
      }
    } else {
      // Create new payment record
      setPayDialog(null);
      const { data: newRow, error } = await supabase
        .from("pulse_payments")
        .insert({
          gym_id: gymId,
          member_id: member.id,
          plan_id: member.plan_id ?? null,
          amount,
          discount,
          late_fee: lateFee,
          total_amount: total,
          payment_method: payForm.method,
          payment_date: payForm.date,
          for_period: selectedMonth,
          status: "paid",
          receipt_number: payForm.receipt_number,
          notes: payForm.notes || null,
        })
        .select("*, member:pulse_members(full_name,plan_id)")
        .single();
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Payment recorded" });
        setPayments((prev) => [newRow as Payment, ...prev]);
      }
    }
    setSaving(false);
  }

  // ── Status change (history tab) ─────────────────────────────────────────────
  async function updateStatus(p: Payment, status: PaymentStatus) {
    setPayments((prev) => prev.map((pay) => pay.id === p.id ? { ...pay, status } : pay));
    const supabase = createClient();
    const { error } = await supabase.from("pulse_payments").update({ status }).eq("id", p.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setPayments((prev) => prev.map((pay) => pay.id === p.id ? p : pay));
    }
  }

  // ── Add payment (manual) ────────────────────────────────────────────────────
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
    const { data: newRow, error } = await supabase
      .from("pulse_payments")
      .insert({
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
      })
      .select("*, member:pulse_members(full_name,plan_id)")
      .single();
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Payment added" });
      setAddDialog(false);
      setPayments((prev) => [newRow as Payment, ...prev]);
    }
    setSaving(false);
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
          <Button onClick={hardRefresh} disabled={refreshing} variant="ghost" size="icon" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={() => setAddDialog(true)} variant="outline" className="gap-2">
            <Plus className="w-4 h-4" /> Add Entry
          </Button>
        </div>
      </div>

      <Tabs defaultValue="members">
        <TabsList className="mb-4">
          <TabsTrigger value="members" className="gap-2"><Users className="w-3.5 h-3.5" /> Members</TabsTrigger>
          <TabsTrigger value="history" className="gap-2"><CreditCard className="w-3.5 h-3.5" /> History</TabsTrigger>
        </TabsList>

        {/* ── Members Tab ────────────────────────────────────────────────────── */}
        <TabsContent value="members" className="space-y-4 mt-0">
          {/* Month navigator */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedMonth((m) => offsetMonth(m, -1))}
              className="p-1.5 rounded-lg border border-sidebar-border text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold text-foreground min-w-[140px] text-center">
              {monthLabel(selectedMonth)}
            </span>
            <button
              onClick={() => setSelectedMonth((m) => offsetMonth(m, 1))}
              disabled={selectedMonth >= CURRENT_MONTH}
              className="p-1.5 rounded-lg border border-sidebar-border text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total Members", value: stats.total,     icon: Users,         color: "text-foreground",  bg: "bg-white/5 border border-white/10" },
              { label: "Paid",          value: stats.paid,      icon: CheckCircle2,  color: "text-emerald-400", bg: "bg-emerald-500/10 border border-emerald-500/20" },
              { label: "Unpaid",        value: stats.unpaid,    icon: Clock,         color: "text-primary",     bg: "bg-primary/10 border border-primary/20" },
              { label: "Collected",     value: formatCurrency(stats.collected), icon: Wallet, color: "text-emerald-400", bg: "bg-emerald-500/10 border border-emerald-500/20" },
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

          {/* Search */}
          <Input
            placeholder="Search member..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:max-w-xs"
          />

          {/* Member payment table */}
          <div className="rounded-2xl border border-sidebar-border bg-card overflow-hidden">
            {members.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
                <Users className="w-10 h-10 opacity-20" />
                <p className="text-sm">No active members</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-sidebar-border">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Member</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Plan</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fee</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Paid On</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sidebar-border/50">
                    {memberRows.map(({ member, payment }) => {
                      const isPaid = payment?.status === "paid";
                      return (
                        <tr key={member.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                                {member.full_name[0]?.toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium text-foreground">{member.full_name}</p>
                                {member.member_number && (
                                  <p className="text-xs text-muted-foreground">#{member.member_number}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <span className="text-sm text-muted-foreground">{member.plan?.name ?? "—"}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-medium text-foreground">{formatCurrency(member.monthly_fee)}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {payment ? (
                              <StatusBadge status={payment.status} />
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-white/5 text-muted-foreground border-white/10">
                                Unpaid
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            <span className="text-sm text-muted-foreground">
                              {payment?.payment_date ? formatDate(payment.payment_date) : "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {isPaid ? (
                              <span className="flex items-center justify-end gap-1 text-xs text-emerald-400 font-medium">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Paid
                              </span>
                            ) : (
                              <Button
                                size="sm"
                                className="h-7 text-xs gap-1 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20"
                                variant="ghost"
                                onClick={() => openPay(member, payment)}
                              >
                                <CheckCircle2 className="w-3 h-3" /> Pay
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── History Tab ────────────────────────────────────────────────────── */}
        <TabsContent value="history" className="space-y-4 mt-0">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="Search by name or receipt..."
              value={histSearch}
              onChange={(e) => setHistSearch(e.target.value)}
              className="sm:max-w-xs"
            />
            <Select value={histStatus} onValueChange={(v) => setHistStatus(v as PaymentStatus | "all")}>
              <SelectTrigger className="sm:max-w-[160px]"><SelectValue placeholder="All statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {(Object.keys(statusLabels) as PaymentStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-2xl border border-sidebar-border bg-card overflow-hidden">
            {historyRows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
                <CreditCard className="w-10 h-10 opacity-20" />
                <p className="text-sm">No payment records found</p>
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
                            {Number(p.discount) > 0 && (
                              <p className="text-xs text-emerald-400">-{formatCurrency(p.discount)} disc</p>
                            )}
                            {Number(p.late_fee) > 0 && (
                              <p className="text-xs text-rose-400">+{formatCurrency(p.late_fee)} late</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <StatusBadge status={p.status} />
                          </td>
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
        </TabsContent>
      </Tabs>

      {/* ── Pay Dialog ──────────────────────────────────────────────────────── */}
      <Dialog open={!!payDialog} onOpenChange={(o) => !o && setPayDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          {payDialog && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-white/5 px-3 py-2.5 space-y-0.5">
                <p className="text-sm font-semibold text-foreground">{payDialog.member.full_name}</p>
                <p className="text-xs text-muted-foreground">
                  {payDialog.member.plan?.name ?? "No plan"} · {monthLabel(selectedMonth)}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Amount (PKR)</Label>
                  <Input type="number" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Discount (PKR)</Label>
                  <Input type="number" placeholder="0" value={payForm.discount} onChange={(e) => setPayForm({ ...payForm, discount: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Late Fee (PKR)</Label>
                  <Input type="number" placeholder="0" value={payForm.late_fee} onChange={(e) => setPayForm({ ...payForm, late_fee: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Date</Label>
                  <Input type="date" value={payForm.date} onChange={(e) => setPayForm({ ...payForm, date: e.target.value })} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Method</Label>
                <Select value={payForm.method} onValueChange={(v) => setPayForm({ ...payForm, method: v as PaymentMethod })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(methodLabels) as [PaymentMethod, string][]).map(([k, label]) => (
                      <SelectItem key={k} value={k}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Receipt No.</Label>
                <Input value={payForm.receipt_number} onChange={(e) => setPayForm({ ...payForm, receipt_number: e.target.value })} />
              </div>

              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Input placeholder="Optional" value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialog(null)}>Cancel</Button>
            <Button onClick={handlePay} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {saving ? "Saving…" : "Confirm Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Entry Dialog (manual/historical) ────────────────────────────── */}
      <Dialog open={addDialog} onOpenChange={(o) => !o && setAddDialog(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Manual Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Member *</Label>
              <MemberSearch
                members={members}
                value={addForm.member_id}
                onChange={(id, m) => setAddForm({ ...addForm, member_id: id, total_amount: m ? String(m.monthly_fee) : "" })}
              />
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
            <Button onClick={handleAddPayment} disabled={saving} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              {saving ? "Saving…" : "Add Entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
