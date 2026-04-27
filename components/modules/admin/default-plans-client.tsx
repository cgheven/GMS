"use client";
import { useState } from "react";
import { Plus, Edit2, Trash2, Star, Infinity, Clock, GripVertical } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";

type DurationType = "daily" | "monthly" | "quarterly" | "biannual" | "annual" | "dropin";

const DURATION_LABELS: Record<DurationType, string> = {
  daily:     "Daily",
  monthly:   "Monthly",
  quarterly: "Quarterly (3 mo)",
  biannual:  "Bi-annual (6 mo)",
  annual:    "Annual",
  dropin:    "Drop-in",
};

const COLORS = [
  "#F5A623", "#00D26A", "#6B7A99", "#9B59B6",
  "#0066FF", "#FF4458", "#00D4FF", "#FF6B35",
];

interface DefaultPlan {
  id: string;
  name: string;
  duration_type: string;
  duration_days: number | null;
  price: number;
  includes_pt: boolean;
  unlimited_classes: boolean;
  access_hours: string | null;
  color: string;
  is_active: boolean;
  sort_order: number;
}

const emptyForm = {
  name: "",
  duration_type: "monthly" as DurationType,
  duration_days: "30",
  price: "",
  includes_pt: false,
  unlimited_classes: false,
  access_hours: "6 AM – 10 PM",
  color: "#F5A623",
  is_active: true,
};

export function DefaultPlansClient({ plans: initial }: { plans: DefaultPlan[] }) {
  const [plans, setPlans] = useState<DefaultPlan[]>(initial);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DefaultPlan | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function reload() {
    const supabase = createClient();
    const { data } = await supabase
      .from("pulse_default_plans")
      .select("*")
      .order("sort_order");
    setPlans(data ?? []);
  }

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(p: DefaultPlan) {
    setEditing(p);
    setForm({
      name: p.name,
      duration_type: p.duration_type as DurationType,
      duration_days: p.duration_days?.toString() ?? "",
      price: p.price.toString(),
      includes_pt: p.includes_pt,
      unlimited_classes: p.unlimited_classes,
      access_hours: p.access_hours ?? "",
      color: p.color,
      is_active: p.is_active,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name || !form.price) {
      toast({ title: "Name and price are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const payload = {
      name: form.name,
      duration_type: form.duration_type,
      duration_days: form.duration_days ? parseInt(form.duration_days) : null,
      price: parseFloat(form.price),
      includes_pt: form.includes_pt,
      unlimited_classes: form.unlimited_classes,
      access_hours: form.access_hours || null,
      color: form.color,
      is_active: form.is_active,
      sort_order: editing ? editing.sort_order : (plans.length + 1),
    };

    const { error } = editing
      ? await supabase.from("pulse_default_plans").update(payload).eq("id", editing.id)
      : await supabase.from("pulse_default_plans").insert(payload);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: editing ? "Plan updated" : "Plan added", description: "Applied to all new gyms going forward." });
      setDialogOpen(false);
      await reload();
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    const supabase = createClient();
    const { error } = await supabase.from("pulse_default_plans").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Plan removed from defaults" });
      await reload();
    }
    setDeleting(null);
  }

  async function toggleActive(plan: DefaultPlan) {
    const supabase = createClient();
    await supabase.from("pulse_default_plans").update({ is_active: !plan.is_active }).eq("id", plan.id);
    await reload();
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Default Membership Plans</h1>
          <p className="text-sm text-muted-foreground mt-1">
            These plans are automatically added to every new gym when it's created.
          </p>
        </div>
        <Button onClick={openAdd} className="gap-2 shrink-0">
          <Plus className="w-4 h-4" /> Add Plan
        </Button>
      </div>

      {/* Info banner */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground/80">
        <span className="font-medium text-primary">Note:</span> Changes here only affect <strong>new gyms</strong>. Existing gym plans are not modified.
      </div>

      {/* Plans grid */}
      {plans.length === 0 ? (
        <div className="rounded-xl border border-sidebar-border bg-card p-12 text-center text-muted-foreground">
          <p className="font-medium">No default plans yet</p>
          <p className="text-sm mt-1">Add plans that will be seeded into every new gym.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="rounded-xl border bg-card overflow-hidden"
              style={{ borderTopColor: plan.color, borderTopWidth: 3 }}
            >
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: plan.color }} />
                    <span className="font-semibold text-foreground truncate">{plan.name}</span>
                  </div>
                  <Badge
                    variant={plan.is_active ? "success" : "secondary"}
                    className="text-xs shrink-0 cursor-pointer"
                    onClick={() => toggleActive(plan)}
                  >
                    {plan.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>

                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {DURATION_LABELS[plan.duration_type as DurationType] ?? plan.duration_type}
                  {plan.duration_days && <span className="ml-1">({plan.duration_days}d)</span>}
                </div>

                <p className="text-2xl font-bold text-foreground">{formatCurrency(plan.price)}</p>

                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span className="flex items-center gap-1"><Star className="w-3 h-3" /> PT</span>
                    <span className={plan.includes_pt ? "text-green-400 font-medium" : ""}>
                      {plan.includes_pt ? "Included" : "Not included"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="flex items-center gap-1"><Infinity className="w-3 h-3" /> Classes</span>
                    <span className={plan.unlimited_classes ? "text-green-400 font-medium" : ""}>
                      {plan.unlimited_classes ? "Unlimited" : "Limited"}
                    </span>
                  </div>
                  {plan.access_hours && (
                    <div className="flex justify-between">
                      <span>Hours</span>
                      <span className="text-foreground">{plan.access_hours}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-1 border-t border-border">
                  <Button variant="outline" size="sm" className="flex-1 gap-1 text-xs" onClick={() => openEdit(plan)}>
                    <Edit2 className="w-3 h-3" /> Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:border-destructive/50"
                    onClick={() => handleDelete(plan.id)}
                    disabled={deleting === plan.id}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Default Plan" : "Add Default Plan"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Plan Name *</Label>
              <Input placeholder="e.g. Standard" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Duration Type *</Label>
                <Select value={form.duration_type} onValueChange={(v) => setForm({ ...form, duration_type: v as DurationType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(DURATION_LABELS) as [DurationType, string][]).map(([val, label]) => (
                      <SelectItem key={val} value={val}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Duration Days</Label>
                <Input type="number" placeholder="30" value={form.duration_days} onChange={(e) => setForm({ ...form, duration_days: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Price (PKR) *</Label>
                <Input type="number" placeholder="6000" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Access Hours</Label>
                <Input placeholder="6 AM – 10 PM" value={form.access_hours} onChange={(e) => setForm({ ...form, access_hours: e.target.value })} />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setForm({ ...form, includes_pt: !form.includes_pt })}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors flex items-center justify-center gap-2 ${
                  form.includes_pt ? "bg-primary/10 border-primary/30 text-primary" : "border-sidebar-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <Star className="w-3.5 h-3.5" /> {form.includes_pt ? "PT Included" : "No PT"}
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, unlimited_classes: !form.unlimited_classes })}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors flex items-center justify-center gap-2 ${
                  form.unlimited_classes ? "bg-primary/10 border-primary/30 text-primary" : "border-sidebar-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <Infinity className="w-3.5 h-3.5" /> {form.unlimited_classes ? "Unlimited" : "Limited Classes"}
              </button>
            </div>

            <div className="space-y-1.5">
              <Label>Color</Label>
              <div className="flex items-center gap-2 flex-wrap">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm({ ...form, color: c })}
                    className="w-6 h-6 rounded-full border-2 transition-transform"
                    style={{
                      backgroundColor: c,
                      borderColor: form.color === c ? "white" : "transparent",
                      transform: form.color === c ? "scale(1.25)" : "scale(1)",
                    }}
                  />
                ))}
                <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="w-7 h-7 rounded cursor-pointer bg-transparent border-0 p-0" />
              </div>
            </div>

            <div className="flex gap-2">
              {[true, false].map((val) => (
                <button
                  key={String(val)}
                  type="button"
                  onClick={() => setForm({ ...form, is_active: val })}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    form.is_active === val
                      ? val ? "bg-primary/10 border-primary/30 text-primary" : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                      : "border-sidebar-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {val ? "Active" : "Inactive"}
                </button>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : editing ? "Update" : "Add Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
