"use client";
import { useState, useMemo } from "react";
import {
  Plus, Edit2, Trash2, ToggleLeft, ToggleRight,
  Clock, Users, DollarSign, Activity, Tag,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { useGymContext } from "@/contexts/gym-context";
import type { GymClass, Staff, ClassScheduleType } from "@/types";

type StaffRow = Pick<Staff, "id" | "full_name">;

interface Props {
  gymId: string | null;
  classes: GymClass[];
  staff: StaffRow[];
}

const CATEGORIES = ["Yoga", "CrossFit", "Zumba", "Boxing", "HIIT", "Spinning", "Pilates", "Swimming", "Other"] as const;
type ClassCategory = (typeof CATEGORIES)[number];

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
type Day = (typeof DAYS)[number];

const DURATION_OPTIONS = [30, 45, 60, 90] as const;

const COLORS = [
  "#3B82F6", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444",
  "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#6366F1",
];

const categoryColors: Record<ClassCategory, string> = {
  Yoga: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  CrossFit: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  Zumba: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  Boxing: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  HIIT: "bg-red-500/10 text-red-400 border-red-500/20",
  Spinning: "bg-primary/10 text-primary border-primary/20",
  Pilates: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  Swimming: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  Other: "bg-white/10 text-muted-foreground border-white/10",
};

const emptyForm = {
  name: "",
  category: "HIIT" as ClassCategory,
  trainer_id: "" as string,
  capacity: "15",
  duration_minutes: "60" as string,
  price: "0",
  schedule_type: "recurring" as ClassScheduleType,
  recurring_days: [] as Day[],
  start_time: "06:00",
  end_time: "07:00",
  start_date: "",
  end_date: "",
  color: COLORS[0],
  is_active: true,
  description: "",
};

type FormState = typeof emptyForm;

export function ClassesClient({ gymId: initialGymId, classes: initialClasses, staff }: Props) {
  const { gymId: ctxGymId } = useGymContext();
  const gymId = ctxGymId ?? initialGymId;

  const [classes, setClasses] = useState<GymClass[]>(initialClasses);
  const [dialog, setDialog] = useState<"add" | "edit" | null>(null);
  const [editTarget, setEditTarget] = useState<GymClass | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<GymClass | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [filterCategory, setFilterCategory] = useState<ClassCategory | "all">("all");
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("all");

  function openAdd() {
    setForm(emptyForm);
    setEditTarget(null);
    setDialog("add");
  }

  function openEdit(c: GymClass) {
    setForm({
      name: c.name,
      category: (c.category as ClassCategory) ?? "Other",
      trainer_id: c.trainer_id ?? "",
      capacity: String(c.capacity),
      duration_minutes: String(c.duration_minutes),
      price: String(c.price),
      schedule_type: c.schedule_type,
      recurring_days: (c.recurring_days ?? []) as Day[],
      start_time: c.start_time ?? "06:00",
      end_time: c.end_time ?? "07:00",
      start_date: c.start_date ?? "",
      end_date: c.end_date ?? "",
      color: c.color ?? COLORS[0],
      is_active: c.is_active,
      description: c.description ?? "",
    });
    setEditTarget(c);
    setDialog("edit");
  }

  function toggleDay(day: Day) {
    setForm((f) => ({
      ...f,
      recurring_days: f.recurring_days.includes(day)
        ? f.recurring_days.filter((d) => d !== day)
        : [...f.recurring_days, day],
    }));
  }

  async function handleSave() {
    if (!gymId || !form.name.trim()) {
      toast({ title: "Class name is required", variant: "destructive" });
      return;
    }
    if (form.schedule_type === "recurring" && form.recurring_days.length === 0) {
      toast({ title: "Select at least one recurring day", variant: "destructive" });
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const payload = {
      gym_id: gymId,
      name: form.name.trim(),
      category: form.category,
      trainer_id: form.trainer_id || null,
      capacity: parseInt(form.capacity) || 15,
      duration_minutes: parseInt(form.duration_minutes) || 60,
      price: parseFloat(form.price) || 0,
      schedule_type: form.schedule_type,
      recurring_days: form.schedule_type === "recurring" ? form.recurring_days : [],
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      color: form.color,
      is_active: form.is_active,
      description: form.description || null,
    };

    if (dialog === "edit" && editTarget) {
      const { error } = await supabase.from("pulse_classes").update(payload).eq("id", editTarget.id);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); setSaving(false); return; }
      toast({ title: "Class updated" });
    } else {
      const { error } = await supabase.from("pulse_classes").insert(payload);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); setSaving(false); return; }
      toast({ title: "Class created" });
    }

    setDialog(null);
    await reload();
    setSaving(false);
  }

  async function handleToggleActive(c: GymClass) {
    const supabase = createClient();
    const { error } = await supabase.from("pulse_classes").update({ is_active: !c.is_active }).eq("id", c.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setClasses((prev) => prev.map((x) => x.id === c.id ? { ...x, is_active: !c.is_active } : x));
    toast({ title: c.is_active ? "Class deactivated" : "Class activated" });
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const supabase = createClient();
    const { error } = await supabase.from("pulse_classes").delete().eq("id", deleteTarget.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); setDeleting(false); return; }
    toast({ title: "Class deleted" });
    setDeleteTarget(null);
    setClasses((prev) => prev.filter((c) => c.id !== deleteTarget.id));
    setDeleting(false);
  }

  async function reload() {
    if (!gymId) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("pulse_classes")
      .select("*, trainer:pulse_staff(full_name)")
      .eq("gym_id", gymId)
      .order("name");
    setClasses((data ?? []) as GymClass[]);
  }

  const filtered = useMemo(() => {
    let list = classes;
    if (filterCategory !== "all") list = list.filter((c) => c.category === filterCategory);
    if (filterActive === "active") list = list.filter((c) => c.is_active);
    if (filterActive === "inactive") list = list.filter((c) => !c.is_active);
    return list;
  }, [classes, filterCategory, filterActive]);

  const activeCount = classes.filter((c) => c.is_active).length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-normal tracking-tight">Classes</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {activeCount} active class{activeCount !== 1 ? "es" : ""}
          </p>
        </div>
        <Button onClick={openAdd} className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
          <Plus className="w-4 h-4" /> Add Class
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select value={filterCategory} onValueChange={(v) => setFilterCategory(v as ClassCategory | "all")}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterActive} onValueChange={(v) => setFilterActive(v as "all" | "active" | "inactive")}>
          <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Classes Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground rounded-2xl border border-sidebar-border bg-card">
          <Activity className="w-10 h-10 opacity-20" />
          <p className="text-sm">No classes found</p>
          <Button size="sm" variant="outline" onClick={openAdd} className="gap-2 border-primary/30 text-primary hover:bg-primary/10">
            <Plus className="w-3.5 h-3.5" /> Create First Class
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((c) => {
            const catColor = categoryColors[c.category as ClassCategory] ?? categoryColors.Other;
            return (
              <div
                key={c.id}
                className={`relative rounded-2xl border border-sidebar-border bg-card overflow-hidden transition-all hover:border-white/20 ${!c.is_active ? "opacity-60" : ""}`}
                style={{ borderLeft: `3px solid ${c.color ?? "#3B82F6"}` }}
              >
                {/* Inactive overlay badge */}
                {!c.is_active && (
                  <div className="absolute top-2 right-2">
                    <span className="text-xs bg-white/10 text-muted-foreground px-2 py-0.5 rounded-full border border-white/10">Inactive</span>
                  </div>
                )}

                <div className="p-4 space-y-3">
                  {/* Name + Category */}
                  <div>
                    <h3 className="font-semibold text-foreground leading-tight">{c.name}</h3>
                    <div className="mt-1">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${catColor}`}>
                        <Tag className="w-2.5 h-2.5" />
                        {c.category}
                      </span>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    {c.trainer?.full_name && (
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3 h-3 shrink-0" />
                        <span className="truncate">{c.trainer.full_name}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3 shrink-0" />
                      <span>
                        {c.duration_minutes} min
                        {c.start_time && ` · ${c.start_time}`}
                        {c.end_time && `–${c.end_time}`}
                      </span>
                    </div>
                    {c.schedule_type === "recurring" && c.recurring_days?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {(c.recurring_days as Day[]).map((d) => (
                          <span key={d} className="px-1.5 py-0.5 bg-white/5 rounded text-xs border border-white/10">{d}</span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        <span>Cap: {c.capacity}</span>
                      </div>
                      {c.price === 0 ? (
                        <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">
                          Included
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-foreground">{formatCurrency(c.price)}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 pt-1 border-t border-white/5">
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-primary"
                      title="Edit"
                      onClick={() => openEdit(c)}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      className={`h-7 w-7 ${c.is_active ? "text-muted-foreground hover:text-amber-400" : "text-muted-foreground hover:text-emerald-400"}`}
                      title={c.is_active ? "Deactivate" : "Activate"}
                      onClick={() => handleToggleActive(c)}
                    >
                      {c.is_active ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-rose-400 ml-auto"
                      title="Delete"
                      onClick={() => setDeleteTarget(c)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialog === "edit" ? "Edit Class" : "Add Class"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Name */}
            <div className="space-y-1.5">
              <Label>Class Name *</Label>
              <Input placeholder="e.g. Morning HIIT" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>

            {/* Category */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as ClassCategory })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Trainer</Label>
                <Select value={form.trainer_id} onValueChange={(v) => setForm({ ...form, trainer_id: v })}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Capacity, Duration, Price */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Capacity</Label>
                <Input type="number" min="1" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Duration</Label>
                <Select value={form.duration_minutes} onValueChange={(v) => setForm({ ...form, duration_minutes: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTIONS.map((d) => <SelectItem key={d} value={String(d)}>{d} min</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Price (PKR)</Label>
                <Input type="number" min="0" placeholder="0 = free" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </div>
            </div>
            {parseFloat(form.price) === 0 && (
              <p className="text-xs text-emerald-400 -mt-2">Included in membership</p>
            )}

            {/* Schedule Type */}
            <div className="space-y-1.5">
              <Label>Schedule Type</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["recurring", "one_time"] as ClassScheduleType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm({ ...form, schedule_type: t })}
                    className={`py-2.5 rounded-xl border text-sm font-medium transition-all
                      ${form.schedule_type === t
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-white/10 bg-white/5 text-muted-foreground hover:border-white/20"}`}
                  >
                    {t === "recurring" ? "Recurring" : "One-Time"}
                  </button>
                ))}
              </div>
            </div>

            {/* Recurring Days */}
            {form.schedule_type === "recurring" && (
              <div className="space-y-1.5">
                <Label>Days</Label>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDay(d)}
                      className={`w-10 h-10 rounded-lg border text-xs font-medium transition-all
                        ${form.recurring_days.includes(d)
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-white/10 bg-white/5 text-muted-foreground hover:border-white/20"}`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Times */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Time</Label>
                <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>End Time</Label>
                <Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
              </div>
            </div>

            {/* One-time dates */}
            {form.schedule_type === "one_time" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Date</Label>
                  <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>End Date (optional)</Label>
                  <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                </div>
              </div>
            )}

            {/* Color */}
            <div className="space-y-1.5">
              <Label>Class Color</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setForm({ ...form, color: col })}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${form.color === col ? "border-white scale-110" : "border-transparent opacity-70 hover:opacity-100"}`}
                    style={{ backgroundColor: col }}
                    title={col}
                  />
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input placeholder="Optional description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>

            {/* Active toggle */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setForm({ ...form, is_active: !form.is_active })}
                className={`relative w-10 h-5 rounded-full transition-colors ${form.is_active ? "bg-primary" : "bg-white/20"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${form.is_active ? "translate-x-5" : ""}`} />
              </button>
              <Label className="cursor-pointer" onClick={() => setForm({ ...form, is_active: !form.is_active })}>
                {form.is_active ? "Active" : "Inactive"}
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              {saving ? "Saving…" : dialog === "edit" ? "Save Changes" : "Create Class"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Class</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Are you sure you want to delete <span className="text-foreground font-medium">{deleteTarget?.name}</span>?
            This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              variant="destructive"
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
