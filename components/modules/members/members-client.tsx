"use client";
import { useState, useMemo, useEffect } from "react";
import {
  Plus, Users, Search, Edit2, Trash2,
  UserCheck, Clock, CalendarX,
  Snowflake, AlertCircle, CheckCircle,
  ChevronLeft, ChevronRight, CheckCircle2, Wallet, CreditCard,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { createClient } from "@/lib/supabase/client";
import { revalidateMembers, revalidateDashboard } from "@/app/actions/revalidate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { formatCurrency, formatDate, formatDateInput, cn } from "@/lib/utils";
import { validateFullName, validateCNIC, validatePakPhone, validateDOB, validateMoney, runValidators, type ValidationResult } from "@/lib/validation";
import type { Member, MembershipPlan, MemberStatus, MemberGender, Staff, Payment, PaymentMethod, PaymentStatus } from "@/types";

// ── Payment helpers ────────────────────────────────────────────────────────────
const methodLabels: Record<PaymentMethod, string> = {
  cash: "Cash", bank_transfer: "Bank Transfer", jazzcash: "JazzCash",
  easypaisa: "Easypaisa", card: "Card", other: "Other",
};

function monthLabel(key: string) {
  const [y, m] = key.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function offsetMonth(key: string, delta: number) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function genReceipt(memberName: string, period: string) {
  const initials = memberName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  return `PLS-${(period ?? "").replace("-", "")}-${initials}-${Math.floor(Math.random() * 900 + 100)}`;
}

const CURRENT_MONTH = (() => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
})();

interface Props {
  gymId: string | null;
  active: Member[];
  waiting: Member[];
  expired: Member[];
  plans: MembershipPlan[];
  staff: Pick<Staff, "id" | "full_name" | "role">[];
}

const emptyForm = {
  full_name: "",
  phone: "",
  email: "",
  cnic: "",
  gender: "male" as MemberGender,
  date_of_birth: "",
  address: "",
  member_number: "",
  plan_id: "",
  assigned_trainer_id: "",
  join_date: formatDateInput(new Date()),
  plan_start_date: formatDateInput(new Date()),
  plan_expiry_date: "",
  admission_fee: "",
  admission_fee_paid: false,
  monthly_fee: "",
  outstanding_balance: "0",
  emergency_contact: "",
  emergency_phone: "",
  medical_notes: "",
  notes: "",
  status: "active" as MemberStatus,
  is_waiting: false,
};

const STATUS_CONFIG: Record<MemberStatus, { label: string; className: string; icon: React.ElementType }> = {
  active:    { label: "Active",     className: "status-active",   icon: UserCheck },
  frozen:    { label: "Frozen",     className: "status-frozen",   icon: Snowflake },
  expired:   { label: "Expired",    className: "status-expired",  icon: CalendarX },
  cancelled: { label: "Cancelled",  className: "status-expired",  icon: AlertCircle },
};

const DURATION_LABELS: Record<string, string> = {
  daily:     "Daily",
  monthly:   "Monthly",
  quarterly: "Quarterly (3 mo)",
  biannual:  "Bi-annual (6 mo)",
  annual:    "Annual",
  dropin:    "Drop-in",
};

export function MembersClient({
  gymId,
  active: initialActive,
  waiting: initialWaiting,
  expired: initialExpired,
  plans: initialPlans,
  staff: initialStaff,
}: Props) {
  const [active, setActive] = useState(initialActive);
  const [waiting, setWaiting] = useState(initialWaiting);
  const [expired, setExpired] = useState(initialExpired);
  const [plans] = useState(initialPlans);
  const [staff] = useState(initialStaff);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("active");
  const [trainerFilter, setTrainerFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [deleteMember, setDeleteMember] = useState<Member | null>(null);

  // ── Collect tab state (lazy-loaded) ─────────────────────────────────────────
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentsLoaded, setPaymentsLoaded] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(CURRENT_MONTH);
  const [collectSearch, setCollectSearch] = useState("");
  const [payDialog, setPayDialog] = useState<{ member: Member; payment: Payment | null } | null>(null);
  const [payForm, setPayForm] = useState({ amount: "", discount: "0", late_fee: "0", method: "cash" as PaymentMethod, date: formatDateInput(new Date()), receipt_number: "", notes: "" });
  const [paySaving, setPaySaving] = useState(false);

  async function loadPayments() {
    if (paymentsLoaded || !gymId) return;
    const supabase = createClient();
    const { data } = await supabase.from("pulse_payments")
      .select("*, member:pulse_members(full_name,plan_id)")
      .eq("gym_id", gymId).order("created_at", { ascending: false }).limit(500);
    setPayments((data as Payment[]) ?? []);
    setPaymentsLoaded(true);
  }

  const monthPayments = useMemo(() => payments.filter((p) => p.for_period === selectedMonth), [payments, selectedMonth]);
  const paidMemberIds = useMemo(() => new Set(monthPayments.filter((p) => p.status === "paid").map((p) => p.member_id)), [monthPayments]);

  const collectStats = useMemo(() => {
    const paid = active.filter((m) => paidMemberIds.has(m.id)).length;
    const collected = monthPayments.filter((p) => p.status === "paid").reduce((s, p) => s + Number(p.total_amount), 0);
    return { paid, unpaid: active.length - paid, collected, total: active.length };
  }, [active, paidMemberIds, monthPayments]);

  const memberRows = useMemo(() => {
    const q = collectSearch.toLowerCase();
    return active
      .filter((m) => !q || m.full_name.toLowerCase().includes(q))
      .map((m) => ({ member: m, payment: monthPayments.find((p) => p.member_id === m.id) ?? null }))
      .sort((a, b) => {
        const rank = (r: typeof a) => (!r.payment || r.payment.status === "overdue" ? 0 : r.payment.status === "pending" ? 1 : 2);
        return rank(a) - rank(b);
      });
  }, [active, monthPayments, collectSearch]);

  function openPay(member: Member, payment: Payment | null) {
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

  async function handlePay() {
    if (!payDialog || !gymId) return;
    setPaySaving(true);
    const { member, payment } = payDialog;
    const amount = parseFloat(payForm.amount) || member.monthly_fee;
    const discount = parseFloat(payForm.discount) || 0;
    const lateFee = parseFloat(payForm.late_fee) || 0;
    const total = Math.max(0, amount - discount + lateFee);
    const supabase = createClient();

    if (payment) {
      const update = { status: "paid" as PaymentStatus, payment_method: payForm.method, payment_date: payForm.date, late_fee: lateFee, discount, total_amount: total, receipt_number: payForm.receipt_number, notes: payForm.notes || null };
      setPayDialog(null);
      setPayments((prev) => prev.map((p) => p.id === payment.id ? { ...p, ...update } : p));
      const { error } = await supabase.from("pulse_payments").update(update).eq("id", payment.id);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); setPayments((prev) => prev.map((p) => p.id === payment.id ? payment : p)); }
      else toast({ title: "Payment recorded" });
    } else {
      setPayDialog(null);
      const { data: newRow, error } = await supabase.from("pulse_payments")
        .insert({ gym_id: gymId, member_id: member.id, plan_id: member.plan_id ?? null, amount, discount, late_fee: lateFee, total_amount: total, payment_method: payForm.method, payment_date: payForm.date, for_period: selectedMonth, status: "paid", receipt_number: payForm.receipt_number, notes: payForm.notes || null })
        .select("*, member:pulse_members(full_name,plan_id)").single();
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else { toast({ title: "Payment recorded" }); setPayments((prev) => [newRow as Payment, ...prev]); }
    }
    setPaySaving(false);
  }

  async function reload() {
    if (!gymId) return;
    const supabase = createClient();
    const { data: members } = await supabase
      .from("pulse_members")
      .select("*, plan:pulse_membership_plans(name,duration_type,price,color), trainer:pulse_staff(full_name)")
      .eq("gym_id", gymId)
      .order("created_at", { ascending: false });
    const all = (members ?? []) as Member[];
    setActive(all.filter((m) => m.status === "active" && !m.is_waiting));
    setWaiting(all.filter((m) => m.is_waiting));
    setExpired(all.filter((m) => m.status === "expired" || m.status === "cancelled"));
    // Invalidate server-side cache so next nav back to /members shows fresh data
    // (and dashboard counters reflect the change).
    void revalidateMembers();
    void revalidateDashboard();
  }

  function openAdd() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(m: Member) {
    setEditing(m);
    setDialogOpen(true);
  }

  async function handleDelete(m: Member) {
    const supabase = createClient();
    const { error } = await supabase.from("pulse_members").delete().eq("id", m.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Member deleted" });
    await reload();
  }

  function filterList(list: Member[]) {
    let filtered = list;
    if (trainerFilter === "self") {
      filtered = filtered.filter((m) => !m.assigned_trainer_id);
    } else if (trainerFilter !== "all") {
      filtered = filtered.filter((m) => m.assigned_trainer_id === trainerFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.full_name.toLowerCase().includes(q) ||
          (m.phone ?? "").includes(q) ||
          (m.cnic ?? "").toLowerCase().includes(q) ||
          (m.member_number ?? "").toLowerCase().includes(q)
      );
    }
    return filtered;
  }

  const planMap = useMemo(() => Object.fromEntries(plans.map((p) => [p.id, p])), [plans]);

  // Counts per trainer chip (across active + waiting + expired pools).
  const trainerCounts = useMemo(() => {
    const all = [...active, ...waiting, ...expired];
    const counts: Record<string, number> = { all: all.length, self: 0 };
    for (const t of staff) counts[t.id] = 0;
    for (const m of all) {
      if (!m.assigned_trainer_id) counts.self += 1;
      else if (counts[m.assigned_trainer_id] !== undefined) counts[m.assigned_trainer_id] += 1;
    }
    return counts;
  }, [active, waiting, expired, staff]);

  // Auto-fill monthly fee when plan is selected
  const stats = {
    active: active.length,
    waiting: waiting.length,
    expired: expired.length,
  };

  function StatusBadge({ status }: { status: MemberStatus }) {
    const cfg = STATUS_CONFIG[status];
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.className}`}>
        <cfg.icon className="w-3 h-3" />
        {cfg.label}
      </span>
    );
  }

  function MemberTable({ list, showExpired = false }: { list: Member[]; showExpired?: boolean }) {
    if (list.length === 0) return null;
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-sidebar-border">
              <th className="text-left px-3 sm:px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Member</th>
              <th className="text-left px-3 sm:px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Plan</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Trainer</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Phone</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">{showExpired ? "Expired" : "Joined"}</th>
              <th className="text-right px-3 sm:px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fee</th>
              <th className="text-center px-3 sm:px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Status</th>
              <th className="text-right px-3 sm:px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sidebar-border/50">
            {list.map((m) => {
              const plan = m.plan_id ? planMap[m.plan_id] : null;
              const planData = (m as Member & { plan?: { name: string; color: string } | null }).plan;
              const planName = planData?.name ?? plan?.name;
              const planColor = planData?.color ?? plan?.color ?? "#6B7A99";
              const trainerData = (m as Member & { trainer?: { full_name: string } | null }).trainer;
              return (
                <tr key={m.id} className="hover:bg-white/[0.02] transition-colors group">
                  {/* Member */}
                  <td className="px-3 sm:px-4 py-3">
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ backgroundColor: `${planColor}22`, color: planColor }}
                      >
                        {m.full_name[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{m.full_name}</p>
                        {m.member_number && (
                          <p className="text-xs text-muted-foreground font-mono">{m.member_number}</p>
                        )}
                        {/* On mobile only: show plan inline as it's hidden as a column */}
                        {planName && (
                          <p className="sm:hidden text-[11px] mt-0.5" style={{ color: planColor }}>● {planName}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  {/* Plan */}
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {planName ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md"
                        style={{ backgroundColor: `${planColor}20`, color: planColor }}>
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: planColor }} />
                        {planName}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  {/* Trainer */}
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-sm text-muted-foreground">
                      {trainerData?.full_name ?? "—"}
                    </span>
                  </td>
                  {/* Phone */}
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-sm text-muted-foreground">{m.phone ?? "—"}</span>
                  </td>
                  {/* Date */}
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-sm text-muted-foreground">
                      {showExpired
                        ? (m.plan_expiry_date ? formatDate(m.plan_expiry_date) : "—")
                        : (m.join_date ? formatDate(m.join_date) : "—")}
                    </span>
                  </td>
                  {/* Fee */}
                  <td className="px-3 sm:px-4 py-3 text-right">
                    <p className="font-semibold text-foreground whitespace-nowrap">{formatCurrency(m.monthly_fee)}<span className="text-muted-foreground">/mo</span></p>
                    {m.admission_fee > 0 && (
                      <p className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">+{formatCurrency(m.admission_fee)} <span className="hidden sm:inline">admission</span><span className="sm:hidden">adm</span></p>
                    )}
                    {m.outstanding_balance > 0 && (
                      <p className="text-[10px] sm:text-xs text-rose-400 whitespace-nowrap">Due: {formatCurrency(m.outstanding_balance)}</p>
                    )}
                  </td>
                  {/* Status */}
                  <td className="px-4 py-3 text-center hidden sm:table-cell">
                    <StatusBadge status={m.status} />
                  </td>
                  {/* Actions — always visible on mobile (no hover on touch) */}
                  <td className="px-3 sm:px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-0.5 sm:gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(m)}>
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteMember(m)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-normal tracking-tight">Members</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage gym members and memberships</p>
        </div>
        <Button
          onClick={openAdd}
          className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold w-full sm:w-auto"
        >
          <Plus className="w-4 h-4" /> Add Member
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {[
          { label: "Active",   sub: "Members",     value: stats.active,  icon: UserCheck, color: "text-emerald-400", bg: "bg-emerald-500/10 border border-emerald-500/20" },
          { label: "Waiting",  sub: "List",        value: stats.waiting, icon: Clock,     color: "text-primary",     bg: "bg-primary/10 border border-primary/20" },
          { label: "Expired",  sub: "Cancelled",   value: stats.expired, icon: CalendarX, color: "text-rose-400",    bg: "bg-rose-500/10 border border-rose-500/20" },
        ].map(({ label, sub, value, icon: Icon, color, bg }) => (
          <div key={label} className="rounded-2xl border border-sidebar-border bg-card p-3 sm:p-5">
            {/* Mobile: stacked / Desktop: row */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <div className={`flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl ${bg} shrink-0`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] sm:text-xs text-muted-foreground leading-tight">
                  {label} <span className="hidden sm:inline">{sub}</span>
                  <span className="sm:hidden block opacity-70">{sub}</span>
                </p>
                <p className="text-xl sm:text-2xl font-bold text-foreground leading-none mt-1 sm:mt-0.5">{value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Search + trainer filter chips */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative max-w-sm w-full sm:w-auto sm:flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, phone, CNIC, member ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button type="button" onClick={() => setTrainerFilter("all")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors inline-flex items-center gap-1.5 ${
              trainerFilter === "all"
                ? "bg-primary/15 border-primary/30 text-primary"
                : "bg-white/[0.03] border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"
            }`}>
            All <span className="text-[10px] opacity-70">{trainerCounts.all}</span>
          </button>
          {staff.map((t) => (
            <button key={t.id} type="button"
              onClick={() => setTrainerFilter(trainerFilter === t.id ? "all" : t.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors inline-flex items-center gap-1.5 ${
                trainerFilter === t.id
                  ? "bg-primary/15 border-primary/30 text-primary"
                  : "bg-white/[0.03] border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"
              }`}>
              {t.full_name} <span className="text-[10px] opacity-70">{trainerCounts[t.id] ?? 0}</span>
            </button>
          ))}
          <button type="button"
            onClick={() => setTrainerFilter(trainerFilter === "self" ? "all" : "self")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors inline-flex items-center gap-1.5 ${
              trainerFilter === "self"
                ? "bg-primary/15 border-primary/30 text-primary"
                : "bg-white/[0.03] border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"
            }`}>
            SELF <span className="text-[10px] opacity-70">{trainerCounts.self}</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => { setTab(v); if (v === "collect") loadPayments(); }}>
        <div className="overflow-x-auto -mx-1 px-1 scrollbar-hide">
          <TabsList className="w-max">
            <TabsTrigger value="active" className="whitespace-nowrap">
              <UserCheck className="w-3.5 h-3.5" /> Active ({active.length})
            </TabsTrigger>
            <TabsTrigger value="waiting" className="whitespace-nowrap">
              <Clock className="w-3.5 h-3.5" /> Waiting ({waiting.length})
            </TabsTrigger>
            <TabsTrigger value="expired" className="whitespace-nowrap">
              <CalendarX className="w-3.5 h-3.5" /> Expired ({expired.length})
            </TabsTrigger>
            <TabsTrigger value="collect" className="whitespace-nowrap">
              <CreditCard className="w-3.5 h-3.5" /> Collect Fees
            </TabsTrigger>
          </TabsList>
        </div>

        {[
          { value: "active",  list: filterList(active),  empty: "No active members yet",            showExpired: false, emptyIcon: Users },
          { value: "waiting", list: filterList(waiting), empty: "Waiting list is empty",             showExpired: false, emptyIcon: Clock },
          { value: "expired", list: filterList(expired), empty: "No expired or cancelled members",  showExpired: true,  emptyIcon: CalendarX },
        ].map(({ value, list, empty, showExpired, emptyIcon: Icon }) => (
          <TabsContent key={value} value={value}>
            <div className="rounded-2xl border border-sidebar-border bg-card overflow-hidden">
              {list.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
                  <Icon className="w-10 h-10 opacity-20" />
                  <p className="text-sm">{search ? "No members match your search" : empty}</p>
                </div>
              ) : (
                <MemberTable list={list} showExpired={showExpired} />
              )}
            </div>
          </TabsContent>
        ))}

        {/* ── Collect Fees Tab ──────────────────────────────────────────────── */}
        <TabsContent value="collect" className="space-y-4 mt-0">
          {/* Month navigator */}
          <div className="flex items-center gap-3">
            <button onClick={() => setSelectedMonth((m) => offsetMonth(m, -1))}
              className="p-1.5 rounded-lg border border-sidebar-border text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold text-foreground min-w-[140px] text-center">
              {monthLabel(selectedMonth)}
            </span>
            <button onClick={() => setSelectedMonth((m) => offsetMonth(m, 1))}
              disabled={selectedMonth >= CURRENT_MONTH}
              className="p-1.5 rounded-lg border border-sidebar-border text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors disabled:opacity-30 disabled:pointer-events-none">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total Members", value: collectStats.total,                    icon: Users,        color: "text-foreground",  bg: "bg-white/5 border border-white/10" },
              { label: "Paid",          value: collectStats.paid,                     icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10 border border-emerald-500/20" },
              { label: "Unpaid",        value: collectStats.unpaid,                   icon: Clock,        color: "text-primary",     bg: "bg-primary/10 border border-primary/20" },
              { label: "Collected",     value: formatCurrency(collectStats.collected), icon: Wallet,      color: "text-emerald-400", bg: "bg-emerald-500/10 border border-emerald-500/20" },
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

          <Input placeholder="Search member…" value={collectSearch}
            onChange={(e) => setCollectSearch(e.target.value)} className="sm:max-w-xs" />

          {/* Member payment table */}
          <div className="rounded-2xl border border-sidebar-border bg-card overflow-hidden">
            {active.length === 0 ? (
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
                                {member.member_number && <p className="text-xs text-muted-foreground">#{member.member_number}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <span className="text-sm text-muted-foreground">
                              {(member as Member & { plan?: { name: string } | null }).plan?.name ?? "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-medium text-foreground">{formatCurrency(member.monthly_fee)}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {payment ? (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                                payment.status === "paid" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                : payment.status === "overdue" ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                                : "bg-primary/10 text-primary border-primary/20"
                              }`}>{payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}</span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-white/5 text-muted-foreground border-white/10">Unpaid</span>
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
                              <Button size="sm" variant="ghost"
                                className="h-7 text-xs gap-1 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20"
                                onClick={() => openPay(member, payment)}>
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
      </Tabs>

      {/* ── Pay Dialog ──────────────────────────────────────────────────────────── */}
      <Dialog open={!!payDialog} onOpenChange={(o) => !o && setPayDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          {payDialog && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-white/5 px-3 py-2.5 space-y-0.5">
                <p className="text-sm font-semibold text-foreground">{payDialog.member.full_name}</p>
                <p className="text-xs text-muted-foreground">
                  {(payDialog.member as Member & { plan?: { name: string } | null }).plan?.name ?? "No plan"} · {monthLabel(selectedMonth)}
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
            <Button onClick={handlePay} disabled={paySaving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {paySaving ? "Saving…" : "Confirm Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteMember}
        title={`Delete ${deleteMember?.full_name ?? "member"}?`}
        description="This member and all associated records will be permanently deleted."
        onConfirm={() => { handleDelete(deleteMember!); setDeleteMember(null); }}
        onCancel={() => setDeleteMember(null)}
      />

      {/* Add / Edit Dialog — isolated component so typing doesn't re-render the table */}
      <MemberFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        plans={plans}
        staff={staff}
        gymId={gymId}
        onSaved={reload}
      />
    </div>
  );
}

// ─── Validated input ────────────────────────────────────────────────────────
// Drop-in <Input> with field-level validation feedback.
// - Stays silent until the user blurs (touched) — no yelling while mid-typing.
// - After blur: live re-validates on each keystroke so errors clear as the user fixes them.
// - Shows red border + inline error message + checkmark when valid (after touch).

interface ValidatedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  value: string;
  onChange: (v: string) => void;
  validator?: (v: string) => ValidationResult;
  required?: boolean;
}

function ValidatedInput({ value, onChange, validator, required, className, ...rest }: ValidatedInputProps) {
  const [touched, setTouched] = useState(false);
  const result = validator ? validator(value) : null;
  const isInvalid = touched && result !== null && !result.ok;
  const errorMessage = isInvalid && result && !result.ok ? result.message : null;
  const isValid = touched && result?.ok && value.trim().length > 0;

  return (
    <>
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setTouched(true)}
          aria-invalid={isInvalid}
          required={required}
          className={cn(
            isInvalid && "border-rose-500/60 focus-visible:ring-rose-500/30 pr-9",
            isValid && "border-emerald-500/40 pr-9",
            className,
          )}
          {...rest}
        />
        {isInvalid && (
          <AlertCircle className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-rose-400 pointer-events-none" />
        )}
        {isValid && (
          <CheckCircle className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400 pointer-events-none" />
        )}
      </div>
      {errorMessage && (
        <p className="text-xs text-rose-400 flex items-center gap-1 mt-1 animate-in fade-in slide-in-from-top-1 duration-150">
          <AlertCircle className="w-3 h-3 shrink-0" /> {errorMessage}
        </p>
      )}
    </>
  );
}

// ─── Isolated form dialog ────────────────────────────────────────────────────
// Owns its own state so typing doesn't re-render the parent's tables.

interface MemberFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Member | null;
  plans: MembershipPlan[];
  staff: Pick<Staff, "id" | "full_name" | "role">[];
  gymId: string | null;
  onSaved: () => void | Promise<void>;
}

function MemberFormDialog({ open, onOpenChange, editing, plans, staff, gymId, onSaved }: MemberFormDialogProps) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const planMap = useMemo(() => Object.fromEntries(plans.map((p) => [p.id, p])), [plans]);

  // Reset form whenever the dialog opens (or editing target changes).
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        full_name: editing.full_name,
        phone: editing.phone ?? "",
        email: editing.email ?? "",
        cnic: editing.cnic ?? "",
        gender: editing.gender ?? "male",
        date_of_birth: editing.date_of_birth ?? "",
        address: editing.address ?? "",
        member_number: editing.member_number ?? "",
        plan_id: editing.plan_id ?? "",
        assigned_trainer_id: editing.assigned_trainer_id ?? "",
        join_date: editing.join_date,
        plan_start_date: editing.plan_start_date ?? "",
        plan_expiry_date: editing.plan_expiry_date ?? "",
        admission_fee: editing.admission_fee > 0 ? editing.admission_fee.toString() : "",
        admission_fee_paid: false,
        monthly_fee: editing.monthly_fee.toString(),
        outstanding_balance: editing.outstanding_balance.toString(),
        emergency_contact: editing.emergency_contact ?? "",
        emergency_phone: editing.emergency_phone ?? "",
        medical_notes: editing.medical_notes ?? "",
        notes: editing.notes ?? "",
        status: editing.status,
        is_waiting: editing.is_waiting,
      });
    } else {
      setForm(emptyForm);
    }
  }, [open, editing]);

  function handlePlanChange(planId: string) {
    const plan = planMap[planId];
    setForm((f) => ({
      ...f,
      plan_id: planId,
      monthly_fee: plan ? plan.price.toString() : f.monthly_fee,
      admission_fee: plan?.admission_fee > 0 ? plan.admission_fee.toString() : f.admission_fee,
    }));
  }

  async function handleSave() {
    if (!gymId) return;

    const check = runValidators(
      validateFullName(form.full_name),
      validateCNIC(form.cnic),
      validatePakPhone(form.phone),
      validatePakPhone(form.emergency_phone),
      validateDOB(form.date_of_birth),
      validateMoney(form.monthly_fee, "Monthly fee"),
    );
    if (!check.ok) {
      toast({ title: "Check the form", description: check.message, variant: "destructive" });
      return;
    }

    setSaving(true);
    const supabase = createClient();

    const admissionFee = parseFloat(form.admission_fee) || 0;
    const admissionPaid = !editing && admissionFee > 0 && form.admission_fee_paid;
    const admissionUnpaid = !editing && admissionFee > 0 && !form.admission_fee_paid;

    const payload = {
      gym_id: gymId,
      full_name: form.full_name,
      phone: form.phone || null,
      email: form.email || null,
      cnic: form.cnic || null,
      gender: form.gender || null,
      date_of_birth: form.date_of_birth || null,
      address: form.address || null,
      ...(editing ? { member_number: form.member_number || null } : {}),
      plan_id: form.plan_id || null,
      assigned_trainer_id: form.assigned_trainer_id || null,
      join_date: form.join_date || formatDateInput(new Date()),
      plan_start_date: form.plan_start_date || null,
      plan_expiry_date: form.plan_expiry_date || null,
      admission_fee: admissionFee,
      monthly_fee: parseFloat(form.monthly_fee) || 0,
      outstanding_balance: (parseFloat(form.outstanding_balance) || 0) + (admissionUnpaid ? admissionFee : 0),
      emergency_contact: form.emergency_contact || null,
      emergency_phone: form.emergency_phone || null,
      medical_notes: form.medical_notes || null,
      notes: form.notes || null,
      status: form.is_waiting ? "active" : form.status,
      is_waiting: form.is_waiting,
    };

    if (editing) {
      const { error } = await supabase.from("pulse_members").update(payload).eq("id", editing.id);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        setSaving(false);
        return;
      }
    } else {
      const { data: newMember, error } = await supabase
        .from("pulse_members")
        .insert(payload)
        .select("id")
        .single();
      if (error || !newMember) {
        toast({ title: "Error", description: error?.message ?? "Unknown error", variant: "destructive" });
        setSaving(false);
        return;
      }
      if (admissionPaid) {
        await supabase.from("pulse_payments").insert({
          gym_id: gymId,
          member_id: newMember.id,
          plan_id: form.plan_id || null,
          amount: admissionFee,
          discount: 0,
          late_fee: 0,
          total_amount: admissionFee,
          payment_method: "cash",
          payment_date: form.join_date || formatDateInput(new Date()),
          for_period: "admission",
          status: "paid",
          notes: "Admission fee",
        });
      }
    }

    toast({
      title: editing
        ? "Member updated"
        : form.is_waiting
        ? "Added to waiting list"
        : "Member added",
    });
    setSaving(false);
    onOpenChange(false);
    await onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Member" : "Add Member"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-5 py-2">
          {!editing && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, is_waiting: false, status: "active" }))}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  !form.is_waiting
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "border-sidebar-border text-muted-foreground hover:text-foreground"
                }`}
              >
                Active Member
              </button>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, is_waiting: true, plan_id: "" }))}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  form.is_waiting
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "border-sidebar-border text-muted-foreground hover:text-foreground"
                }`}
              >
                Waiting List
              </button>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Personal Info</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Full Name *</Label>
                <ValidatedInput
                  placeholder="Ahmed Khan"
                  value={form.full_name}
                  onChange={(v) => setForm((f) => ({ ...f, full_name: v }))}
                  validator={validateFullName}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Phone <span className="text-muted-foreground text-xs">(03xx-xxxxxxx)</span></Label>
                <ValidatedInput
                  placeholder="03001234567"
                  value={form.phone}
                  onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
                  validator={validatePakPhone}
                  inputMode="tel"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" placeholder="member@email.com" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>CNIC <span className="text-muted-foreground text-xs">(XXXXX-XXXXXXX-X)</span></Label>
                <ValidatedInput
                  placeholder="00000-0000000-0"
                  value={form.cnic}
                  onChange={(v) => setForm((f) => ({ ...f, cnic: v }))}
                  validator={validateCNIC}
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Gender</Label>
                <Select value={form.gender} onValueChange={(v) => setForm((f) => ({ ...f, gender: v as MemberGender }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Date of Birth</Label>
                <ValidatedInput
                  type="date"
                  value={form.date_of_birth}
                  onChange={(v) => setForm((f) => ({ ...f, date_of_birth: v }))}
                  validator={validateDOB}
                />
              </div>
              {editing && form.member_number && (
                <div className="space-y-1.5">
                  <Label>Member ID</Label>
                  <div className="h-10 px-3 flex items-center rounded-lg border border-sidebar-border bg-muted/30 font-mono text-sm text-muted-foreground">
                    {form.member_number}
                  </div>
                </div>
              )}
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Address</Label>
                <Input placeholder="Street, area, city" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
              </div>
            </div>
          </div>

          {!form.is_waiting && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Membership</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Membership Plan</Label>
                  <Select value={form.plan_id} onValueChange={handlePlanChange}>
                    <SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
                    <SelectContent>
                      {plans.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          <span className="flex items-center gap-2">
                            <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                            {p.name} · {DURATION_LABELS[p.duration_type] ?? p.duration_type} · {formatCurrency(p.price)}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Assigned Trainer</Label>
                  <Select value={form.assigned_trainer_id || "none"} onValueChange={(v) => setForm((f) => ({ ...f, assigned_trainer_id: v === "none" ? "" : v }))}>
                    <SelectTrigger><SelectValue placeholder="No trainer" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No trainer</SelectItem>
                      {staff.map((s) => (<SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Join Date *</Label>
                  <Input type="date" value={form.join_date} onChange={(e) => setForm((f) => ({ ...f, join_date: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Plan Start Date</Label>
                  <Input type="date" value={form.plan_start_date} onChange={(e) => setForm((f) => ({ ...f, plan_start_date: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Plan Expiry Date</Label>
                  <Input type="date" value={form.plan_expiry_date} onChange={(e) => setForm((f) => ({ ...f, plan_expiry_date: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as MemberStatus }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="frozen">Frozen</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Monthly Fee (PKR) *</Label>
                  <ValidatedInput
                    type="number"
                    placeholder="0"
                    value={form.monthly_fee}
                    onChange={(v) => setForm((f) => ({ ...f, monthly_fee: v }))}
                    validator={(v) => validateMoney(v, "Monthly fee")}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Admission Fee (PKR)</Label>
                  <Input type="number" placeholder="0" value={form.admission_fee} onChange={(e) => setForm((f) => ({ ...f, admission_fee: e.target.value }))} />
                </div>
                {!editing && parseFloat(form.admission_fee) > 0 && (
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label>Admission Fee Status</Label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, admission_fee_paid: true }))}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                          form.admission_fee_paid
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                            : "border-sidebar-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Paid Now
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, admission_fee_paid: false }))}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                          !form.admission_fee_paid
                            ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                            : "border-sidebar-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Pending
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {form.admission_fee_paid
                        ? "A paid payment record will be created automatically."
                        : "Amount will be added to outstanding balance."}
                    </p>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label>Outstanding Balance (PKR)</Label>
                  <Input type="number" placeholder="0" value={form.outstanding_balance} onChange={(e) => setForm((f) => ({ ...f, outstanding_balance: e.target.value }))} />
                </div>
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Emergency &amp; Health</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Emergency Contact</Label>
                <Input placeholder="Contact name" value={form.emergency_contact} onChange={(e) => setForm((f) => ({ ...f, emergency_contact: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Emergency Phone</Label>
                <ValidatedInput
                  placeholder="03001234567"
                  value={form.emergency_phone}
                  onChange={(v) => setForm((f) => ({ ...f, emergency_phone: v }))}
                  validator={validatePakPhone}
                  inputMode="tel"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Medical Notes</Label>
                <Input placeholder="Any medical conditions, allergies, injuries…" value={form.medical_notes} onChange={(e) => setForm((f) => ({ ...f, medical_notes: e.target.value }))} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Notes</Label>
                <Input placeholder="Additional notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.full_name}>
            {saving ? "Saving…" : editing ? "Update Member" : form.is_waiting ? "Add to Waiting List" : "Add Member"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
