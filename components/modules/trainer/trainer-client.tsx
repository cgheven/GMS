"use client";
import { useState, useMemo } from "react";
import {
  CheckCircle2, Clock, Wallet, Users,
  ChevronLeft, ChevronRight, Search,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { formatCurrency, formatDate, formatDateInput } from "@/lib/utils";
import type { Payment, PaymentMethod, PaymentStatus, Member, MembershipPlan, Staff } from "@/types";

type MemberRow = Pick<Member,
  "id" | "full_name" | "member_number" | "monthly_fee" | "plan_id" |
  "status" | "plan_expiry_date" | "outstanding_balance"
> & { plan?: { name: string } | null };

type PlanRow = Pick<MembershipPlan, "id" | "name" | "price" | "duration_type">;

interface Props {
  staff: Staff & { gym?: { name: string } | null };
  gymId: string;
  members: MemberRow[];
  payments: Payment[];
  plans: PlanRow[];
}

const methodLabels: Record<PaymentMethod, string> = {
  cash: "Cash", bank_transfer: "Bank Transfer",
  jazzcash: "JazzCash", easypaisa: "Easypaisa",
  card: "Card", other: "Other",
};

const NOW = new Date();
const CURRENT_MONTH = `${NOW.getFullYear()}-${String(NOW.getMonth() + 1).padStart(2, "0")}`;

function monthLabel(key: string) {
  const [y, m] = key.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function offsetMonth(key: string, delta: number) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function genReceipt(name: string, period: string) {
  const initials = name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  return `PLS-${period.replace("-", "")}-${initials}-${Math.floor(Math.random() * 900 + 100)}`;
}

export function TrainerClient({ staff, gymId, members, payments: initialPayments, plans }: Props) {
  const [payments, setPayments] = useState<Payment[]>(initialPayments);
  const [selectedMonth, setSelectedMonth] = useState(CURRENT_MONTH);
  const [search, setSearch] = useState("");

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
  const [saving, setSaving] = useState(false);

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
    return { total: members.length, paid, unpaid: members.length - paid, collected };
  }, [members, paidMemberIds, monthPayments]);

  const memberRows = useMemo(() => {
    const q = search.toLowerCase();
    return members
      .filter((m) => !q || m.full_name.toLowerCase().includes(q))
      .map((m) => ({ member: m, payment: monthPayments.find((p) => p.member_id === m.id) ?? null }))
      .sort((a, b) => {
        const rank = (r: typeof a) => (r.payment?.status === "paid" ? 2 : r.payment?.status === "overdue" ? 0 : 1);
        return rank(a) - rank(b);
      });
  }, [members, monthPayments, search]);

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

  async function handlePay() {
    if (!payDialog) return;
    setSaving(true);
    const { member, payment } = payDialog;
    const amount = parseFloat(payForm.amount) || member.monthly_fee;
    const discount = parseFloat(payForm.discount) || 0;
    const lateFee = parseFloat(payForm.late_fee) || 0;
    const total = Math.max(0, amount - discount + lateFee);
    const supabase = createClient();

    if (payment) {
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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">My Members</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {members.length} member{members.length !== 1 ? "s" : ""} assigned to you
        </p>
      </div>

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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "My Members",  value: stats.total,                    icon: Users,        color: "text-foreground",  bg: "bg-white/5 border border-white/10" },
          { label: "Paid",        value: stats.paid,                     icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10 border border-emerald-500/20" },
          { label: "Unpaid",      value: stats.unpaid,                   icon: Clock,        color: "text-primary",     bg: "bg-primary/10 border border-primary/20" },
          { label: "Collected",   value: formatCurrency(stats.collected), icon: Wallet,       color: "text-emerald-400", bg: "bg-emerald-500/10 border border-emerald-500/20" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="rounded-2xl border border-sidebar-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className={`flex items-center justify-center w-8 h-8 rounded-xl ${bg} shrink-0`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-lg font-bold text-foreground leading-none mt-0.5">{value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search member..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Member table */}
      <div className="rounded-2xl border border-sidebar-border bg-card overflow-hidden">
        {members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2 text-muted-foreground">
            <Users className="w-10 h-10 opacity-20" />
            <p className="text-sm font-medium">No members assigned to you yet</p>
            <p className="text-xs">Ask the owner to assign members to your name</p>
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
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                            payment.status === "paid"     ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                            payment.status === "overdue"  ? "bg-rose-500/10 text-rose-400 border-rose-500/20" :
                                                            "bg-primary/10 text-primary border-primary/20"
                          }`}>
                            {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                          </span>
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

      {/* Pay dialog */}
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
                    {(Object.entries(methodLabels) as [PaymentMethod, string][]).map(([k, l]) => (
                      <SelectItem key={k} value={k}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Receipt No.</Label>
                <Input value={payForm.receipt_number} onChange={(e) => setPayForm({ ...payForm, receipt_number: e.target.value })} />
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
    </div>
  );
}
