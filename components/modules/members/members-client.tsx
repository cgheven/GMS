"use client";
import { useState, useMemo } from "react";
import {
  Plus, Users, Dumbbell, Search, Edit2, Trash2,
  UserCheck, Clock, Phone, CalendarX,
  Snowflake, AlertCircle,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
import type { Member, MembershipPlan, MemberStatus, MemberGender, Staff } from "@/types";

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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteMember, setDeleteMember] = useState<Member | null>(null);

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
  }

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(m: Member) {
    setEditing(m);
    setForm({
      full_name: m.full_name,
      phone: m.phone ?? "",
      email: m.email ?? "",
      cnic: m.cnic ?? "",
      gender: m.gender ?? "male",
      date_of_birth: m.date_of_birth ?? "",
      address: m.address ?? "",
      member_number: m.member_number ?? "",
      plan_id: m.plan_id ?? "",
      assigned_trainer_id: m.assigned_trainer_id ?? "",
      join_date: m.join_date,
      plan_start_date: m.plan_start_date ?? "",
      plan_expiry_date: m.plan_expiry_date ?? "",
      monthly_fee: m.monthly_fee.toString(),
      outstanding_balance: m.outstanding_balance.toString(),
      emergency_contact: m.emergency_contact ?? "",
      emergency_phone: m.emergency_phone ?? "",
      medical_notes: m.medical_notes ?? "",
      notes: m.notes ?? "",
      status: m.status,
      is_waiting: m.is_waiting,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!gymId || !form.full_name) return;
    setSaving(true);
    const supabase = createClient();

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
      monthly_fee: parseFloat(form.monthly_fee) || 0,
      outstanding_balance: parseFloat(form.outstanding_balance) || 0,
      emergency_contact: form.emergency_contact || null,
      emergency_phone: form.emergency_phone || null,
      medical_notes: form.medical_notes || null,
      notes: form.notes || null,
      status: form.is_waiting ? "active" : form.status,
      is_waiting: form.is_waiting,
    };

    const { error } = editing
      ? await supabase.from("pulse_members").update(payload).eq("id", editing.id)
      : await supabase.from("pulse_members").insert(payload);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    toast({
      title: editing
        ? "Member updated"
        : form.is_waiting
        ? "Added to waiting list"
        : "Member added",
    });
    setDialogOpen(false);
    await reload();
    setSaving(false);
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
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter(
      (m) =>
        m.full_name.toLowerCase().includes(q) ||
        (m.phone ?? "").includes(q) ||
        (m.cnic ?? "").toLowerCase().includes(q) ||
        (m.member_number ?? "").toLowerCase().includes(q)
    );
  }

  const planMap = useMemo(() => Object.fromEntries(plans.map((p) => [p.id, p])), [plans]);

  // Auto-fill monthly fee when plan is selected
  function handlePlanChange(planId: string) {
    const plan = planMap[planId];
    setForm((f) => ({
      ...f,
      plan_id: planId,
      monthly_fee: plan ? plan.price.toString() : f.monthly_fee,
    }));
  }

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
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Member</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Plan</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Trainer</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Phone</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">{showExpired ? "Expired" : "Joined"}</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fee</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
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
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ backgroundColor: `${planColor}22`, color: planColor }}
                      >
                        {m.full_name[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{m.full_name}</p>
                        {m.member_number && (
                          <p className="text-xs text-muted-foreground font-mono">{m.member_number}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  {/* Plan */}
                  <td className="px-4 py-3">
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
                  <td className="px-4 py-3 text-right">
                    <p className="font-semibold text-foreground">{formatCurrency(m.monthly_fee)}</p>
                    {m.outstanding_balance > 0 && (
                      <p className="text-xs text-rose-400">Due: {formatCurrency(m.outstanding_balance)}</p>
                    )}
                  </td>
                  {/* Status */}
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={m.status} />
                  </td>
                  {/* Actions */}
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Active Members", value: stats.active, icon: UserCheck, color: "text-emerald-400", bg: "bg-emerald-500/10 border border-emerald-500/20" },
          { label: "Waiting List",   value: stats.waiting, icon: Clock,     color: "text-primary",    bg: "bg-primary/10 border border-primary/20" },
          { label: "Expired / Cancelled", value: stats.expired, icon: CalendarX, color: "text-rose-400", bg: "bg-rose-500/10 border border-rose-500/20" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="rounded-2xl border border-sidebar-border bg-card p-5">
            <div className="flex items-center gap-3">
              <div className={`flex items-center justify-center w-9 h-9 rounded-xl ${bg} shrink-0`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold text-foreground leading-none mt-0.5">{value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, phone, CNIC, member ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="active">
            <UserCheck className="w-3.5 h-3.5" /> Active ({active.length})
          </TabsTrigger>
          <TabsTrigger value="waiting">
            <Clock className="w-3.5 h-3.5" /> Waiting ({waiting.length})
          </TabsTrigger>
          <TabsTrigger value="expired">
            <CalendarX className="w-3.5 h-3.5" /> Expired / Cancelled ({expired.length})
          </TabsTrigger>
        </TabsList>

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
      </Tabs>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteMember}
        title={`Delete ${deleteMember?.full_name ?? "member"}?`}
        description="This member and all associated records will be permanently deleted."
        onConfirm={() => { handleDelete(deleteMember!); setDeleteMember(null); }}
        onCancel={() => setDeleteMember(null)}
      />

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Member" : "Add Member"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-5 py-2">
            {/* Active vs Waiting toggle (new member only) */}
            {!editing && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, is_waiting: false, status: "active" })}
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
                  onClick={() => setForm({ ...form, is_waiting: true, plan_id: "" })}
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

            {/* Personal Info */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Personal Info</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Full Name *</Label>
                  <Input
                    placeholder="Ahmed Khan"
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input
                    placeholder="+92 300 0000000"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    placeholder="member@email.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>CNIC <span className="text-muted-foreground text-xs">(XXXXX-XXXXXXX-X)</span></Label>
                  <Input
                    placeholder="00000-0000000-0"
                    value={form.cnic}
                    onChange={(e) => setForm({ ...form, cnic: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Gender</Label>
                  <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v as MemberGender })}>
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
                  <Input
                    type="date"
                    value={form.date_of_birth}
                    onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
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
                  <Input
                    placeholder="Street, area, city"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Membership */}
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
                              <span
                                className="inline-block w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: p.color }}
                              />
                              {p.name} · {DURATION_LABELS[p.duration_type] ?? p.duration_type} · {formatCurrency(p.price)}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Assigned Trainer</Label>
                    <Select
                      value={form.assigned_trainer_id || "none"}
                      onValueChange={(v) => setForm({ ...form, assigned_trainer_id: v === "none" ? "" : v })}
                    >
                      <SelectTrigger><SelectValue placeholder="No trainer" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No trainer</SelectItem>
                        {staff.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Join Date *</Label>
                    <Input
                      type="date"
                      value={form.join_date}
                      onChange={(e) => setForm({ ...form, join_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Plan Start Date</Label>
                    <Input
                      type="date"
                      value={form.plan_start_date}
                      onChange={(e) => setForm({ ...form, plan_start_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Plan Expiry Date</Label>
                    <Input
                      type="date"
                      value={form.plan_expiry_date}
                      onChange={(e) => setForm({ ...form, plan_expiry_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select
                      value={form.status}
                      onValueChange={(v) => setForm({ ...form, status: v as MemberStatus })}
                    >
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
                    <Label>Monthly Fee (PKR)</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={form.monthly_fee}
                      onChange={(e) => setForm({ ...form, monthly_fee: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Outstanding Balance (PKR)</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={form.outstanding_balance}
                      onChange={(e) => setForm({ ...form, outstanding_balance: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Emergency & Medical */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Emergency &amp; Health</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Emergency Contact</Label>
                  <Input
                    placeholder="Contact name"
                    value={form.emergency_contact}
                    onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Emergency Phone</Label>
                  <Input
                    placeholder="+92 300 0000000"
                    value={form.emergency_phone}
                    onChange={(e) => setForm({ ...form, emergency_phone: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Medical Notes</Label>
                  <Input
                    placeholder="Any medical conditions, allergies, injuries…"
                    value={form.medical_notes}
                    onChange={(e) => setForm({ ...form, medical_notes: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Notes</Label>
                  <Input
                    placeholder="Additional notes"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.full_name}
            >
              {saving ? "Saving…" : editing ? "Update Member" : form.is_waiting ? "Add to Waiting List" : "Add Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
