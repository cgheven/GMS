"use client";
import { useState, useMemo } from "react";
import {
  Plus, Search, Edit2, Trash2, UserCog, Wallet,
  CheckCircle2, Clock, Users, TrendingDown, Star,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { formatCurrency, formatDate, formatDateInput } from "@/lib/utils";
import type { Staff, StaffRole, StaffStatus, SalaryPayment, PaymentMethod } from "@/types";

const ROLES: { value: StaffRole; label: string; icon: string }[] = [
  { value: "trainer",   label: "Trainer",    icon: "💪" },
  { value: "manager",   label: "Manager",    icon: "👔" },
  { value: "frontdesk", label: "Front Desk", icon: "🖥️" },
  { value: "cleaner",   label: "Cleaner",    icon: "🧹" },
  { value: "guard",     label: "Guard",      icon: "🛡️" },
  { value: "cook",      label: "Cook",       icon: "👨‍🍳" },
  { value: "other",     label: "Other",      icon: "👤" },
];

const QUICK_STAFF: { label: string; role: StaffRole }[] = [
  { label: "Personal Trainer",   role: "trainer"   },
  { label: "Head Trainer",       role: "trainer"   },
  { label: "Fitness Coach",      role: "trainer"   },
  { label: "Yoga Instructor",    role: "trainer"   },
  { label: "Gym Manager",        role: "manager"   },
  { label: "Branch Manager",     role: "manager"   },
  { label: "Receptionist",       role: "frontdesk" },
  { label: "Front Desk Staff",   role: "frontdesk" },
  { label: "Cleaner",            role: "cleaner"   },
  { label: "Housekeeping",       role: "cleaner"   },
  { label: "Security Guard",     role: "guard"     },
  { label: "Night Guard",        role: "guard"     },
  { label: "Cafeteria Cook",     role: "cook"      },
  { label: "Nutritionist",       role: "other"     },
  { label: "Physiotherapist",    role: "other"     },
];

const ROLE_CHIP: Record<StaffRole, string> = {
  trainer:   "bg-primary/10   border-primary/25   text-primary   hover:bg-primary/20",
  manager:   "bg-purple-500/10 border-purple-500/25 text-purple-400 hover:bg-purple-500/20",
  frontdesk: "bg-cyan-500/10  border-cyan-500/25  text-cyan-400  hover:bg-cyan-500/20",
  cleaner:   "bg-emerald-500/10 border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/20",
  guard:     "bg-blue-500/10  border-blue-500/25  text-blue-400  hover:bg-blue-500/20",
  cook:      "bg-orange-500/10 border-orange-500/25 text-orange-400 hover:bg-orange-500/20",
  other:     "bg-white/5       border-white/10      text-muted-foreground hover:bg-white/10",
};

const roleConfig: Record<StaffRole, { label: string; icon: string; color: string }> = {
  trainer:   { label: "Trainer",    icon: "💪", color: "text-primary" },
  manager:   { label: "Manager",    icon: "👔", color: "text-purple-400" },
  frontdesk: { label: "Front Desk", icon: "🖥️", color: "text-cyan-400" },
  cleaner:   { label: "Cleaner",    icon: "🧹", color: "text-emerald-400" },
  guard:     { label: "Guard",      icon: "🛡️", color: "text-blue-400" },
  cook:      { label: "Cook",       icon: "👨‍🍳", color: "text-orange-400" },
  other:     { label: "Other",      icon: "👤", color: "text-muted-foreground" },
};

const methodLabels: Record<PaymentMethod, string> = {
  cash: "Cash", bank_transfer: "Bank Transfer",
  jazzcash: "JazzCash", easypaisa: "Easypaisa",
  card: "Card", other: "Other",
};

const emptyForm = {
  full_name: "", role: "other" as StaffRole, specialization: "", phone: "", cnic: "",
  join_date: formatDateInput(new Date()), monthly_salary: "", pt_rate: "0",
  commission_percentage: "0", status: "active" as StaffStatus, notes: "",
};

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function genReceipt(name: string, month: string) {
  const initials = name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  return `SAL-${month.replace("-", "")}-${initials}-${Math.floor(Math.random() * 900 + 100)}`;
}

interface Props {
  gymId: string | null;
  staff: Staff[];
  salaryPayments: SalaryPayment[];
}

export function StaffClient({ gymId, staff: initialStaff, salaryPayments: initialPayments }: Props) {
  // ── Staff state ───────────────────────────────────────────
  const [staff, setStaff] = useState(initialStaff);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // ── Salary state ──────────────────────────────────────────
  const [salaryPayments, setSalaryPayments] = useState(initialPayments);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth());
  const [generating, setGenerating] = useState(false);
  const [payDialog, setPayDialog] = useState<SalaryPayment | null>(null);
  const [payForm, setPayForm] = useState({ method: "cash" as PaymentMethod, date: formatDateInput(new Date()), notes: "", receipt: "" });
  const [paying, setPaying] = useState(false);

  // ── Data helpers ──────────────────────────────────────────
  async function reloadStaff() {
    if (!gymId) return;
    const supabase = createClient();
    const { data } = await supabase.from("pulse_staff").select("*").eq("gym_id", gymId).order("full_name");
    setStaff((data as Staff[]) ?? []);
  }

  async function reloadSalaries(month: string) {
    if (!gymId) return;
    const supabase = createClient();
    const { data } = await supabase.from("pulse_salary_payments")
      .select("*, staff:pulse_staff(full_name, role)")
      .eq("gym_id", gymId).eq("for_month", month)
      .order("created_at", { ascending: false });
    setSalaryPayments((prev) => {
      const others = prev.filter((p) => p.for_month !== month);
      return [...others, ...((data as SalaryPayment[]) ?? [])];
    });
  }

  // ── Staff CRUD ────────────────────────────────────────────
  function openAdd() { setEditing(null); setForm(emptyForm); setDialogOpen(true); }
  function quickStaff(item: { label: string; role: StaffRole }) {
    setEditing(null);
    setForm({ ...emptyForm, full_name: item.label, role: item.role });
    setDialogOpen(true);
  }
  function openEdit(s: Staff) {
    setEditing(s);
    setForm({
      full_name: s.full_name,
      role: s.role,
      specialization: s.specialization ?? "",
      phone: s.phone ?? "",
      cnic: s.cnic ?? "",
      join_date: s.join_date,
      monthly_salary: s.monthly_salary.toString(),
      pt_rate: s.pt_rate.toString(),
      commission_percentage: s.commission_percentage.toString(),
      status: s.status,
      notes: s.notes ?? "",
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!gymId || !form.full_name || !form.monthly_salary) return;
    setSaving(true);
    const supabase = createClient();
    const payload = {
      gym_id: gymId,
      full_name: form.full_name,
      role: form.role,
      specialization: form.specialization || null,
      phone: form.phone || null,
      cnic: form.cnic || null,
      join_date: form.join_date,
      monthly_salary: parseFloat(form.monthly_salary) || 0,
      pt_rate: parseFloat(form.pt_rate) || 0,
      commission_percentage: parseFloat(form.commission_percentage) || 0,
      status: form.status,
      notes: form.notes || null,
    };
    const { error } = editing
      ? await supabase.from("pulse_staff").update(payload).eq("id", editing.id)
      : await supabase.from("pulse_staff").insert(payload);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: editing ? "Updated" : "Staff added" }); setDialogOpen(false); reloadStaff(); }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("pulse_staff").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Deleted" }); reloadStaff(); }
  }

  // ── Salary actions ────────────────────────────────────────
  async function generateSalaries() {
    const active = staff.filter((s) => s.status === "active");
    if (!active.length || !gymId) { toast({ title: "No active staff" }); return; }
    setGenerating(true);
    const supabase = createClient();
    const rows = active.map((s) => ({
      gym_id: gymId,
      staff_id: s.id,
      for_month: selectedMonth,
      base_salary: s.monthly_salary,
      commission_amount: 0,
      pt_earnings: 0,
      total_amount: s.monthly_salary,
      status: "pending",
    }));
    const { error } = await supabase.from("pulse_salary_payments").upsert(rows, { onConflict: "staff_id,for_month", ignoreDuplicates: true });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: `Generated ${rows.length} salary records` }); await reloadSalaries(selectedMonth); }
    setGenerating(false);
  }

  function openPay(p: SalaryPayment) {
    setPayDialog(p);
    setPayForm({ method: "cash", date: formatDateInput(new Date()), notes: "", receipt: genReceipt(p.staff?.full_name ?? "", p.for_month) });
  }

  async function handlePay() {
    if (!payDialog) return;
    setPaying(true);
    const supabase = createClient();
    const { error } = await supabase.from("pulse_salary_payments").update({
      status: "paid",
      payment_method: payForm.method,
      payment_date: payForm.date,
      notes: payForm.notes || null,
      receipt_number: payForm.receipt,
    }).eq("id", payDialog.id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Salary paid" }); setPayDialog(null); await reloadSalaries(selectedMonth); }
    setPaying(false);
  }

  // ── Derived ───────────────────────────────────────────────
  const filteredStaff = useMemo(() => {
    const q = search.toLowerCase();
    return staff.filter((s) => s.full_name.toLowerCase().includes(q) || s.role.includes(q));
  }, [search, staff]);

  const monthPayments = useMemo(() => salaryPayments.filter((p) => p.for_month === selectedMonth), [salaryPayments, selectedMonth]);

  const stats = useMemo(() => {
    const active = staff.filter((s) => s.status === "active");
    const payroll = active.reduce((s, e) => s + Number(e.monthly_salary), 0);
    const paid = monthPayments.filter((p) => p.status === "paid").reduce((s, p) => s + Number(p.total_amount), 0);
    const pending = monthPayments.filter((p) => p.status === "pending").reduce((s, p) => s + Number(p.total_amount), 0);
    return { total: staff.length, active: active.length, payroll, paid, pending };
  }, [staff, monthPayments]);

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-normal tracking-tight">Staff & Trainers</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage gym staff and salary payments</p>
        </div>
        <Button onClick={openAdd} className="gap-2 w-full sm:w-auto">
          <Plus className="w-4 h-4" /> Add Staff
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Staff",     value: stats.total,                  icon: Users,        color: "text-blue-400",   bg: "bg-blue-500/10 border border-blue-500/20" },
          { label: "Monthly Payroll", value: formatCurrency(stats.payroll), icon: TrendingDown, color: "text-primary",    bg: "bg-primary/10 border border-primary/20" },
          { label: "Paid This Month", value: formatCurrency(stats.paid),    icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10 border border-emerald-500/20" },
          { label: "Pending",         value: formatCurrency(stats.pending), icon: Clock,        color: "text-rose-400",   bg: "bg-rose-500/10 border border-rose-500/20" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg ${bg}`}><Icon className={`w-4 h-4 ${color}`} /></div>
              <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-bold">{value}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="staff" className="space-y-6">
        <TabsList>
          <TabsTrigger value="staff"><Users className="w-3.5 h-3.5 mr-1.5" />Staff</TabsTrigger>
          <TabsTrigger value="salaries"><Wallet className="w-3.5 h-3.5 mr-1.5" />Salaries</TabsTrigger>
        </TabsList>

        {/* ── Staff tab ──────────────────────────────── */}
        <TabsContent value="staff" className="space-y-4">
          {/* Quick Add */}
          <div className="rounded-2xl border border-sidebar-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Plus className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quick Add</p>
              <span className="text-xs text-muted-foreground/50">— tap to pre-fill the form</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {QUICK_STAFF.map((item) => (
                <button
                  key={item.label}
                  onClick={() => quickStaff(item)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${ROLE_CHIP[item.role]}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search staff..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>

          {filteredStaff.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <UserCog className="w-10 h-10 mb-3 opacity-30" />
                <p className="font-medium">{search ? "No staff match" : "No staff yet"}</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0 divide-y divide-sidebar-border">
                {filteredStaff.map((member) => {
                  const rc = roleConfig[member.role];
                  const isTrainer = member.role === "trainer";
                  return (
                    <div key={member.id} className="flex items-center gap-4 px-4 py-3 hover:bg-white/[0.02] transition-colors">
                      {/* Avatar */}
                      <div className="flex items-center justify-center w-9 h-9 rounded-full bg-white/5 border border-sidebar-border text-sm font-semibold shrink-0">
                        {rc.icon}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium">{member.full_name}</p>
                          {isTrainer ? (
                            <Badge className="text-xs bg-primary/10 border border-primary/25 text-primary hover:bg-primary/20 gap-1">
                              <Star className="w-2.5 h-2.5" /> Trainer
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className={`text-xs capitalize ${rc.color}`}>{rc.label}</Badge>
                          )}
                          {member.status === "inactive" && <Badge variant="destructive" className="text-xs">Inactive</Badge>}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                          {member.specialization && <span className="text-xs text-primary/80">{member.specialization}</span>}
                          {member.phone && <span className="text-xs text-muted-foreground">{member.phone}</span>}
                          {member.cnic && <span className="text-xs text-muted-foreground">{member.cnic}</span>}
                          <span className="text-xs text-muted-foreground">Joined: {formatDate(member.join_date)}</span>
                        </div>
                      </div>
                      {/* Salary */}
                      <div className="text-right shrink-0 hidden sm:block">
                        <p className="text-sm font-semibold">{formatCurrency(member.monthly_salary)}</p>
                        <p className="text-xs text-muted-foreground">/month</p>
                        {isTrainer && member.pt_rate > 0 && (
                          <p className="text-xs text-primary/70">{formatCurrency(member.pt_rate)}/PT</p>
                        )}
                      </div>
                      {/* Actions */}
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(member)}><Edit2 className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(member.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Salaries tab ───────────────────────────────── */}
        <TabsContent value="salaries" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <Input type="month" value={selectedMonth} onChange={(e) => { setSelectedMonth(e.target.value); reloadSalaries(e.target.value); }} className="w-auto" />
            <Button onClick={generateSalaries} disabled={generating} variant="outline" className="gap-2">
              <Plus className="w-4 h-4" />
              {generating ? "Generating…" : "Generate for All Active"}
            </Button>
            {monthPayments.length > 0 && (
              <span className="text-xs text-muted-foreground ml-auto">
                {monthPayments.filter((p) => p.status === "paid").length}/{monthPayments.length} paid
              </span>
            )}
          </div>

          {monthPayments.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Wallet className="w-10 h-10 mb-3 opacity-30" />
                <p className="font-medium">No salary records for this month</p>
                <p className="text-sm mt-1">Click "Generate for All Active" to create them</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0 divide-y divide-sidebar-border">
                {monthPayments.map((p) => {
                  const role = (p.staff?.role ?? "other") as StaffRole;
                  const rc = roleConfig[role];
                  const isPaid = p.status === "paid";
                  return (
                    <div key={p.id} className="flex items-center gap-4 px-4 py-3 hover:bg-white/[0.02] transition-colors">
                      <span className="text-lg shrink-0">{rc.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium">{p.staff?.full_name ?? "—"}</p>
                          <Badge variant="secondary" className={`text-xs ${rc.color}`}>{rc.label}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
                          {Number(p.commission_amount) > 0 && <span>Commission: {formatCurrency(p.commission_amount)}</span>}
                          {Number(p.pt_earnings) > 0 && <span>PT: {formatCurrency(p.pt_earnings)}</span>}
                        </div>
                        {isPaid && p.payment_date && (
                          <p className="text-xs text-muted-foreground mt-0.5">Paid {formatDate(p.payment_date)} · {p.receipt_number}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold">{formatCurrency(p.total_amount)}</p>
                        <p className={`text-xs font-medium ${isPaid ? "text-emerald-400" : "text-primary"}`}>
                          {isPaid ? "Paid" : "Pending"}
                        </p>
                      </div>
                      {!isPaid && (
                        <Button
                          size="sm"
                          className="h-8 text-xs gap-1 shrink-0 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                          variant="ghost"
                          onClick={() => openPay(p)}
                        >
                          <CheckCircle2 className="w-3 h-3" /> Pay
                        </Button>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete staff member?"
        description="This staff member and all their salary records will be permanently deleted."
        onConfirm={() => { handleDelete(deleteId!); setDeleteId(null); }}
        onCancel={() => setDeleteId(null)}
      />

      {/* ── Add / Edit Staff Dialog ───────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit Staff" : "Add Staff / Trainer"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label>Full Name *</Label>
                <Input placeholder="Ahmed Khan" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as StaffRole })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.icon} {r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as StaffStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.role === "trainer" && (
              <div className="space-y-1.5">
                <Label>Specialization</Label>
                <Input placeholder="e.g. Strength & Conditioning, Yoga, Cardio…" value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Phone</Label><Input placeholder="+92 300 0000000" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>CNIC</Label><Input placeholder="00000-0000000-0" value={form.cnic} onChange={(e) => setForm({ ...form, cnic: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Base Salary (PKR) *</Label><Input type="number" placeholder="0" value={form.monthly_salary} onChange={(e) => setForm({ ...form, monthly_salary: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Join Date</Label><Input type="date" value={form.join_date} onChange={(e) => setForm({ ...form, join_date: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>PT Rate (PKR/session)</Label>
                <Input type="number" placeholder="0" value={form.pt_rate} onChange={(e) => setForm({ ...form, pt_rate: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Commission %</Label>
                <Input type="number" placeholder="0" value={form.commission_percentage} onChange={(e) => setForm({ ...form, commission_percentage: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5"><Label>Notes</Label><Textarea placeholder="Optional…" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.full_name || !form.monthly_salary}>
              {saving ? "Saving…" : editing ? "Update" : "Add Staff"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Mark Paid Dialog ─────────────────────────────── */}
      <Dialog open={!!payDialog} onOpenChange={(o) => !o && setPayDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Pay Salary — {payDialog?.staff?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {/* Salary breakdown */}
            <div className="rounded-lg bg-muted/30 border border-sidebar-border px-4 py-3 space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Base Salary</span>
                <span>{formatCurrency(payDialog?.base_salary ?? 0)}</span>
              </div>
              {Number(payDialog?.commission_amount) > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Commission</span>
                  <span>{formatCurrency(payDialog?.commission_amount ?? 0)}</span>
                </div>
              )}
              {Number(payDialog?.pt_earnings) > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>PT Earnings</span>
                  <span>{formatCurrency(payDialog?.pt_earnings ?? 0)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-foreground border-t border-sidebar-border pt-1.5">
                <span>Total</span>
                <span className="text-emerald-400">{formatCurrency(payDialog?.total_amount ?? 0)}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Payment Method</Label>
              <Select value={payForm.method} onValueChange={(v) => setPayForm({ ...payForm, method: v as PaymentMethod })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(methodLabels).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Payment Date</Label><Input type="date" value={payForm.date} onChange={(e) => setPayForm({ ...payForm, date: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Receipt No.</Label><Input value={payForm.receipt} onChange={(e) => setPayForm({ ...payForm, receipt: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><Label>Notes</Label><Input placeholder="Optional…" value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialog(null)}>Cancel</Button>
            <Button onClick={handlePay} disabled={paying} className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20">
              {paying ? "Saving…" : "Confirm Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
