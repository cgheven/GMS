"use client";
import { useState, useEffect } from "react";
import {
  Plus, Dumbbell, Users, Search, Edit2, Trash2,
  Check, Star, Clock, Infinity, Copy,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import type { MembershipPlan, PlanDurationType } from "@/types";

const DURATION_LABELS: Record<PlanDurationType, string> = {
  daily:     "Daily",
  monthly:   "Monthly",
  quarterly: "Quarterly (3 mo)",
  biannual:  "Bi-annual (6 mo)",
  annual:    "Annual",
  dropin:    "Drop-in",
};

const DURATION_COLORS: Record<PlanDurationType, string> = {
  daily:     "text-yellow-400",
  monthly:   "text-emerald-400",
  quarterly: "text-blue-400",
  biannual:  "text-purple-400",
  annual:    "text-primary",
  dropin:    "text-orange-400",
};

const DEFAULT_COLORS = [
  "#0066FF", "#00D26A", "#FF4458", "#FFB800",
  "#00D4FF", "#9B59B6", "#FF6B35", "#2ECC71",
];

const emptyForm: {
  name: string;
  duration_type: PlanDurationType;
  duration_days: string;
  price: string;
  admission_fee: string;
  includes_pt: boolean;
  unlimited_classes: boolean;
  access_hours: string;
  description: string;
  is_active: boolean;
  color: string;
} = {
  name: "",
  duration_type: "monthly",
  duration_days: "",
  price: "",
  admission_fee: "",
  includes_pt: false,
  unlimited_classes: false,
  access_hours: "",
  description: "",
  is_active: true,
  color: "#F5A623",
};

interface PlanWithCount extends MembershipPlan {
  member_count?: number;
}

interface Props {
  gymId: string | null;
  plans: MembershipPlan[];
}

export function PlansClient({ gymId, plans: initialPlans }: Props) {
  const [plans, setPlans] = useState<PlanWithCount[]>(initialPlans);
  const [filtered, setFiltered] = useState<PlanWithCount[]>(initialPlans);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MembershipPlan | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Load member counts per plan
  useEffect(() => {
    if (!gymId) return;
    const supabase = createClient();
    supabase
      .from("pulse_members")
      .select("plan_id")
      .eq("gym_id", gymId)
      .eq("status", "active")
      .then(({ data }) => {
        if (!data) return;
        const counts: Record<string, number> = {};
        data.forEach((m) => { if (m.plan_id) counts[m.plan_id] = (counts[m.plan_id] ?? 0) + 1; });
        setPlans((prev) => prev.map((p) => ({ ...p, member_count: counts[p.id] ?? 0 })));
      });
  }, [gymId]);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      plans.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.duration_type.includes(q) ||
          (p.description ?? "").toLowerCase().includes(q)
      )
    );
  }, [search, plans]);

  async function reload() {
    if (!gymId) return;
    const supabase = createClient();
    const [{ data: plansData }, { data: membersData }] = await Promise.all([
      supabase.from("pulse_membership_plans").select("*").eq("gym_id", gymId).order("price"),
      supabase.from("pulse_members").select("plan_id").eq("gym_id", gymId).eq("status", "active"),
    ]);
    const counts: Record<string, number> = {};
    (membersData ?? []).forEach((m) => { if (m.plan_id) counts[m.plan_id] = (counts[m.plan_id] ?? 0) + 1; });
    const enriched: PlanWithCount[] = (plansData as MembershipPlan[] ?? []).map((p) => ({
      ...p,
      member_count: counts[p.id] ?? 0,
    }));
    setPlans(enriched);
  }

  function openAdd() { setEditing(null); setForm(emptyForm); setDialogOpen(true); }
  function openEdit(plan: MembershipPlan) {
    setEditing(plan);
    setForm({
      name: plan.name,
      duration_type: plan.duration_type,
      duration_days: plan.duration_days?.toString() ?? "",
      price: plan.price.toString(),
      admission_fee: plan.admission_fee > 0 ? plan.admission_fee.toString() : "",
      includes_pt: plan.includes_pt,
      unlimited_classes: plan.unlimited_classes,
      access_hours: plan.access_hours ?? "",
      description: plan.description ?? "",
      is_active: plan.is_active,
      color: plan.color,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!gymId) {
      toast({ title: "No gym found", description: "Reload the page and try again.", variant: "destructive" });
      return;
    }
    if (!form.name || !form.price) {
      toast({ title: "Missing fields", description: "Plan name and price are required.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const payload = {
      gym_id: gymId,
      name: form.name,
      duration_type: form.duration_type,
      duration_days: form.duration_days ? parseInt(form.duration_days) : null,
      price: parseFloat(form.price) || 0,
      admission_fee: parseFloat(form.admission_fee) || 0,
      includes_pt: form.includes_pt,
      unlimited_classes: form.unlimited_classes,
      access_hours: form.access_hours || null,
      description: form.description || null,
      is_active: form.is_active,
      color: form.color,
    };
    const { error } = editing
      ? await supabase.from("pulse_membership_plans").update(payload).eq("id", editing.id)
      : await supabase.from("pulse_membership_plans").insert(payload);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: editing ? "Plan updated" : "Plan added" });
      setDialogOpen(false);
      await reload();
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("pulse_membership_plans").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Plan deleted" });
      await reload();
    }
  }

  const stats = {
    total: plans.length,
    active: plans.filter((p) => p.is_active).length,
    totalMembers: plans.reduce((s, p) => s + (p.member_count ?? 0), 0),
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-normal tracking-tight">Membership Plans</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage gym membership plans and pricing</p>
        </div>
        <Button onClick={openAdd} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold w-full sm:w-auto">
          <Plus className="w-4 h-4" /> Add Plan
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {[
          { label: "Total",   sub: "Plans",     value: stats.total,        icon: Dumbbell, color: "text-primary",     bg: "bg-primary/10 border border-primary/20" },
          { label: "Active",  sub: "Plans",     value: stats.active,       icon: Check,    color: "text-emerald-400", bg: "bg-emerald-500/10 border border-emerald-500/20" },
          { label: "Members", sub: "Enrolled",  value: stats.totalMembers, icon: Users,    color: "text-blue-400",    bg: "bg-blue-500/10 border border-blue-500/20" },
        ].map(({ label, sub, value, icon: Icon, color, bg }) => (
          <div key={label} className="rounded-2xl border border-sidebar-border bg-card p-3 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <div className={`flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl ${bg} shrink-0`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] sm:text-xs text-muted-foreground leading-tight">
                  {label}
                  <span className="hidden sm:inline"> {sub}</span>
                  <span className="sm:hidden block opacity-70">{sub}</span>
                </p>
                <p className="text-xl sm:text-2xl font-bold text-foreground leading-none mt-1 sm:mt-0.5">{value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search plans…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Plan Cards */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Dumbbell className="w-10 h-10 mb-3 opacity-30" />
            <p className="font-medium">{search ? "No plans match" : "No plans yet"}</p>
            <p className="text-sm mt-1">Add your first membership plan to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((plan) => (
            <Card
              key={plan.id}
              className="hover:shadow-md transition-shadow card-hover overflow-hidden"
              style={{ borderTopColor: plan.color, borderTopWidth: 3 }}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="inline-block w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: plan.color }}
                    />
                    <CardTitle className="text-base truncate">{plan.name}</CardTitle>
                  </div>
                  <Badge variant={plan.is_active ? "success" : "secondary"} className="text-xs shrink-0">
                    {plan.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div className={`flex items-center gap-1 text-xs mt-1 ${DURATION_COLORS[plan.duration_type]}`}>
                  <Clock className="w-3 h-3" />
                  {DURATION_LABELS[plan.duration_type]}
                  {plan.duration_days && <span className="text-muted-foreground">({plan.duration_days}d)</span>}
                </div>
                {/* Plan ID — short prefix + copy button */}
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(plan.id);
                    toast({ title: "Plan ID copied", description: plan.id });
                  }}
                  title="Click to copy full Plan ID"
                  className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors group/id self-start"
                >
                  <span className="opacity-60">ID:</span>
                  <span>{plan.id.slice(0, 8)}…{plan.id.slice(-4)}</span>
                  <Copy className="w-2.5 h-2.5 opacity-50 group-hover/id:opacity-100" />
                </button>
              </CardHeader>

              <CardContent className="space-y-3">
                {/* Price */}
                <div className="space-y-1">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-foreground">{formatCurrency(plan.price)}</span>
                    <span className="text-xs text-muted-foreground">
                      /{plan.duration_type === "monthly" ? "mo" : plan.duration_type === "annual" ? "yr" : "plan"}
                    </span>
                  </div>
                  {plan.admission_fee > 0 && (
                    <p className="text-xs text-muted-foreground">
                      + {formatCurrency(plan.admission_fee)} admission fee
                    </p>
                  )}
                </div>

                {/* Features */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Star className="w-3 h-3" /> Personal Training
                    </span>
                    {plan.includes_pt ? (
                      <span className="text-emerald-400 flex items-center gap-0.5 text-xs font-medium">
                        <Check className="w-3 h-3" /> Included
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">Not included</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Infinity className="w-3 h-3" /> Unlimited Classes
                    </span>
                    {plan.unlimited_classes ? (
                      <span className="text-emerald-400 flex items-center gap-0.5 text-xs font-medium">
                        <Check className="w-3 h-3" /> Yes
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">No</span>
                    )}
                  </div>
                  {plan.access_hours && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Access Hours</span>
                      <span className="text-xs font-medium text-foreground">{plan.access_hours}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Users className="w-3 h-3" /> Active Members
                    </span>
                    <span className="text-xs font-bold text-foreground">{plan.member_count ?? 0}</span>
                  </div>
                </div>

                {plan.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 border-t border-border pt-2">
                    {plan.description}
                  </p>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1"
                    onClick={() => openEdit(plan)}
                  >
                    <Edit2 className="w-3 h-3" /> Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteId(plan.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteId}
        title="Delete plan?"
        description="This membership plan will be permanently deleted. Members assigned to this plan will lose their plan association."
        onConfirm={() => { handleDelete(deleteId!); setDeleteId(null); }}
        onCancel={() => setDeleteId(null)}
      />

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Plan" : "Add Membership Plan"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Name */}
            <div className="space-y-1.5">
              <Label>Plan Name *</Label>
              <Input
                placeholder="e.g. Monthly Standard"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            {/* Duration & Price */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Duration Type *</Label>
                <Select
                  value={form.duration_type}
                  onValueChange={(v) => setForm({ ...form, duration_type: v as PlanDurationType })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(DURATION_LABELS) as [PlanDurationType, string][]).map(([val, label]) => (
                      <SelectItem key={val} value={val}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Duration Days <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input
                  type="number"
                  placeholder="30"
                  value={form.duration_days}
                  onChange={(e) => setForm({ ...form, duration_days: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Monthly Fee (PKR) *</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Admission Fee (PKR)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={form.admission_fee}
                  onChange={(e) => setForm({ ...form, admission_fee: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Access Hours</Label>
                <Input
                  placeholder="6 AM – 10 PM"
                  value={form.access_hours}
                  onChange={(e) => setForm({ ...form, access_hours: e.target.value })}
                />
              </div>
            </div>

            {/* Features toggles */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setForm({ ...form, includes_pt: !form.includes_pt })}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors flex items-center justify-center gap-2 ${
                  form.includes_pt
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "border-sidebar-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <Star className="w-3.5 h-3.5" />
                {form.includes_pt ? "PT Included" : "No PT"}
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, unlimited_classes: !form.unlimited_classes })}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors flex items-center justify-center gap-2 ${
                  form.unlimited_classes
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "border-sidebar-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <Infinity className="w-3.5 h-3.5" />
                {form.unlimited_classes ? "Unlimited Classes" : "Limited Classes"}
              </button>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input
                placeholder="Short description of the plan…"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            {/* Color picker */}
            <div className="space-y-1.5">
              <Label>Plan Color</Label>
              <div className="flex items-center gap-3">
                <div className="flex gap-2 flex-wrap">
                  {DEFAULT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm({ ...form, color: c })}
                      className="w-6 h-6 rounded-full border-2 transition-all"
                      style={{
                        backgroundColor: c,
                        borderColor: form.color === c ? "white" : "transparent",
                        transform: form.color === c ? "scale(1.2)" : "scale(1)",
                      }}
                      title={c}
                    />
                  ))}
                </div>
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
                  title="Custom color"
                />
              </div>
            </div>

            {/* Active toggle */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, is_active: true })}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  form.is_active
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "border-sidebar-border text-muted-foreground hover:text-foreground"
                }`}
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, is_active: false })}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  !form.is_active
                    ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                    : "border-sidebar-border text-muted-foreground hover:text-foreground"
                }`}
              >
                Inactive
              </button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.name || !form.price}
            >
              {saving ? "Saving…" : editing ? "Update Plan" : "Add Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
