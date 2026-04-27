"use client";
import { useState, useMemo } from "react";
import {
  Plus, Edit2, Trash2, Wrench, Package, DollarSign,
  Search, Bike, Dumbbell, BarChart2, Zap, Box, PenLine,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Equipment, EquipmentCategory, EquipmentCondition } from "@/types";

const CATEGORIES: { value: EquipmentCategory; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "cardio",       label: "Cardio",       icon: Bike },
  { value: "strength",     label: "Strength",     icon: BarChart2 },
  { value: "free_weights", label: "Free Weights", icon: Dumbbell },
  { value: "functional",   label: "Functional",   icon: Zap },
  { value: "accessories",  label: "Accessories",  icon: Box },
  { value: "other",        label: "Other",        icon: Package },
];

const PRESETS: Record<EquipmentCategory, string[]> = {
  cardio: [
    "Treadmill", "Spin Bike", "Stationary Bike", "Recumbent Bike", "Elliptical",
    "Rowing Machine", "Stair Climber", "Stepper", "Air Bike", "Vertical Climber",
    "Ski Erg", "Jump Rope",
  ],
  strength: [
    "Chest Press Machine", "Shoulder Press Machine", "Lat Pulldown", "Seated Row",
    "Cable Machine", "Cable Crossover", "Smith Machine", "Leg Press", "Leg Extension",
    "Leg Curl", "Hack Squat Machine", "Hip Thrust Machine", "Pec Deck Machine",
    "Preacher Curl Machine", "Assisted Pull-Up Machine", "Hip Abductor Machine",
    "Hip Adductor Machine", "Calf Raise Machine", "Ab Crunch Machine", "Multi-Station Gym",
  ],
  free_weights: [
    "Dumbbell Set", "Dumbbell Rack", "Barbell", "Olympic Bar", "EZ Bar", "Curl Bar",
    "Swiss Bar", "Hex Bar", "Weight Plates", "Weight Tree", "Kettlebell",
    "Power Rack", "Squat Rack", "Flat Bench", "Adjustable Bench", "Medicine Ball",
  ],
  functional: [
    "Pull-up Bar", "Dip Station", "Gymnastics Rings", "Parallettes", "TRX Suspension",
    "Battle Ropes", "Resistance Bands", "Plyometric Box", "Slam Ball", "Wall Ball",
    "Sandbag", "Power Sled", "Agility Ladder", "Speed Bag", "Monkey Bars",
  ],
  accessories: [
    "Yoga Mat", "Foam Roller", "Exercise Ball", "Bosu Ball", "Step Platform",
    "Balance Board", "Ab Roller", "Weight Belt", "Wrist Wraps", "Knee Sleeves",
    "Ankle Weights", "Gym Gloves", "Pull-up Assist Band", "Massage Gun",
    "Skipping Rope", "Mirror", "Water Cooler",
  ],
  other: [
    "Locker", "Storage Rack", "Dumbbell Storage Tree", "Reception Desk",
    "Weighing Scale", "First Aid Kit", "Towel Rack", "Water Dispenser",
    "TV Screen", "Sound System", "Whiteboard", "Clock",
    "Fan", "AC Unit", "CCTV Camera", "Vending Machine",
  ],
};

const CONDITIONS: { value: EquipmentCondition; label: string; badge: string }[] = [
  { value: "excellent",    label: "Excellent",    badge: "bg-emerald-500/10 border-emerald-500/25 text-emerald-400" },
  { value: "good",         label: "Good",         badge: "bg-blue-500/10 border-blue-500/25 text-blue-400" },
  { value: "fair",         label: "Fair",         badge: "bg-yellow-500/10 border-yellow-500/25 text-yellow-400" },
  { value: "needs_repair", label: "Needs Repair", badge: "bg-rose-500/10 border-rose-500/25 text-rose-400" },
  { value: "retired",      label: "Retired",      badge: "bg-white/5 border-white/10 text-muted-foreground" },
];

const conditionBadge = (c: EquipmentCondition) => CONDITIONS.find((x) => x.value === c)?.badge ?? "";
const conditionLabel  = (c: EquipmentCondition) => CONDITIONS.find((x) => x.value === c)?.label ?? c;
const categoryLabel   = (c: EquipmentCategory)  => CATEGORIES.find((x) => x.value === c)?.label ?? c;

const CategoryIcon = ({ category, className }: { category: EquipmentCategory; className?: string }) => {
  const Icon = CATEGORIES.find((c) => c.value === category)?.icon ?? Package;
  return <Icon className={className} />;
};

const emptyForm = {
  name: "", category: "cardio" as EquipmentCategory, quantity: "1",
  purchase_date: "", purchase_price: "", condition: "good" as EquipmentCondition,
  last_maintenance_date: "", notes: "",
};

interface QuickAdd { name: string; category: EquipmentCategory }

interface Props { gymId: string | null; equipment: Equipment[] }

export function EquipmentClient({ gymId, equipment: initialEquipment }: Props) {
  const [equipment, setEquipment]         = useState<Equipment[]>(initialEquipment);
  const [search, setSearch]               = useState("");
  const [activeCategory, setActiveCategory] = useState<EquipmentCategory | "all">("all");
  const [filterCondition, setFilterCondition] = useState("all");
  const [dialogOpen, setDialogOpen]       = useState(false);
  const [editing, setEditing]             = useState<Equipment | null>(null);
  const [form, setForm]                   = useState(emptyForm);
  const [saving, setSaving]               = useState(false);
  const [deleteId, setDeleteId]           = useState<string | null>(null);

  // Quick-add state
  const [quickAdd, setQuickAdd]           = useState<QuickAdd | null>(null);
  const [quickQty, setQuickQty]           = useState("1");
  const [quickCondition, setQuickCondition] = useState<EquipmentCondition>("good");
  const [quickSaving, setQuickSaving]     = useState(false);

  async function reload() {
    if (!gymId) return;
    const supabase = createClient();
    const { data } = await supabase.from("pulse_equipment").select("*").eq("gym_id", gymId).order("name");
    setEquipment((data as Equipment[]) ?? []);
  }

  function openQuickAdd(name: string, category: EquipmentCategory) {
    setQuickAdd({ name, category });
    setQuickQty("1");
    setQuickCondition("good");
  }

  async function handleQuickAdd() {
    if (!gymId || !quickAdd) return;
    setQuickSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("pulse_equipment").insert({
      gym_id: gymId,
      name: quickAdd.name,
      category: quickAdd.category,
      quantity: parseInt(quickQty) || 1,
      condition: quickCondition,
      purchase_date: null, purchase_price: null,
      last_maintenance_date: null, notes: null,
    });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: `${quickAdd.name} added` });
      setQuickAdd(null);
      await reload();
    }
    setQuickSaving(false);
  }

  function openAdd(category?: EquipmentCategory) {
    setEditing(null);
    setForm({ ...emptyForm, ...(category ? { category } : {}) });
    setDialogOpen(true);
  }

  function openEdit(item: Equipment) {
    setEditing(item);
    setForm({
      name: item.name, category: item.category, quantity: item.quantity.toString(),
      purchase_date: item.purchase_date ?? "", purchase_price: item.purchase_price?.toString() ?? "",
      condition: item.condition, last_maintenance_date: item.last_maintenance_date ?? "",
      notes: item.notes ?? "",
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!gymId || !form.name) return;
    setSaving(true);
    const supabase = createClient();
    const payload = {
      gym_id: gymId, name: form.name, category: form.category,
      quantity: parseInt(form.quantity) || 1,
      purchase_date: form.purchase_date || null,
      purchase_price: form.purchase_price ? parseFloat(form.purchase_price) : null,
      condition: form.condition,
      last_maintenance_date: form.last_maintenance_date || null,
      notes: form.notes || null,
    };
    const { error } = editing
      ? await supabase.from("pulse_equipment").update(payload).eq("id", editing.id)
      : await supabase.from("pulse_equipment").insert(payload);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: editing ? "Equipment updated" : "Equipment added" }); setDialogOpen(false); await reload(); }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("pulse_equipment").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Deleted" }); await reload(); }
  }

  const filtered = useMemo(() => {
    let list = equipment;
    if (search) list = list.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()));
    if (activeCategory !== "all") list = list.filter((e) => e.category === activeCategory);
    if (filterCondition !== "all") list = list.filter((e) => e.condition === filterCondition);
    return list;
  }, [equipment, search, activeCategory, filterCondition]);

  const stats = useMemo(() => ({
    totalItems:  equipment.reduce((s, e) => s + e.quantity, 0),
    needsRepair: equipment.filter((e) => e.condition === "needs_repair").length,
    totalValue:  equipment.reduce((s, e) => s + (e.purchase_price ? Number(e.purchase_price) * e.quantity : 0), 0),
  }), [equipment]);

  const presets = activeCategory !== "all" ? PRESETS[activeCategory] : [];
  const existingNames = useMemo(() => new Set(equipment.map((e) => e.name.toLowerCase())), [equipment]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-normal tracking-tight">Equipment</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage gym equipment inventory</p>
        </div>
        <Button onClick={() => openAdd()} className="gap-2 w-full sm:w-auto">
          <PenLine className="w-4 h-4" /> Custom Entry
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total Items",  value: stats.totalItems,                icon: Package,    color: "text-blue-400",  bg: "bg-blue-500/10 border border-blue-500/20" },
          { label: "Needs Repair", value: stats.needsRepair,               icon: Wrench,     color: "text-rose-400",  bg: "bg-rose-500/10 border border-rose-500/20" },
          { label: "Total Value",  value: formatCurrency(stats.totalValue), icon: DollarSign, color: "text-primary",   bg: "bg-primary/10 border border-primary/20" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg ${bg}`}><Icon className={`w-4 h-4 ${color}`} /></div>
              <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-bold">{value}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick-add panel */}
      <div className="rounded-2xl border border-sidebar-border bg-card p-5 space-y-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quick Add</p>

        {/* Category chips */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveCategory("all")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              activeCategory === "all"
                ? "bg-primary/15 border-primary/40 text-primary"
                : "bg-white/[0.03] border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"
            }`}
          >
            <Package className="w-3 h-3" /> All
          </button>
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            const active = activeCategory === c.value;
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => setActiveCategory(active ? "all" : c.value)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  active
                    ? "bg-primary/15 border-primary/40 text-primary"
                    : "bg-white/[0.03] border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"
                }`}
              >
                <Icon className="w-3 h-3" />
                {c.label}
              </button>
            );
          })}
        </div>

        {/* Preset item chips */}
        {presets.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {presets.map((name) => {
              const already = existingNames.has(name.toLowerCase());
              return (
                <button
                  key={name}
                  type="button"
                  disabled={already}
                  onClick={() => openQuickAdd(name, activeCategory as EquipmentCategory)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    already
                      ? "border-white/5 text-white/20 cursor-default line-through"
                      : "bg-white/[0.03] border-white/10 text-foreground hover:bg-primary/10 hover:border-primary/30 hover:text-primary"
                  }`}
                >
                  {!already && <Plus className="w-3 h-3" />}
                  {name}
                </button>
              );
            })}
          </div>
        )}

        {presets.length === 0 && (
          <p className="text-xs text-muted-foreground">Select a category above to see preset items.</p>
        )}
      </div>

      {/* Search + condition filter */}
      <div className="space-y-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search equipment..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFilterCondition("all")}
            className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              filterCondition === "all"
                ? "bg-primary/15 border-primary/40 text-primary"
                : "bg-white/[0.03] border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"
            }`}
          >
            All Conditions
          </button>
          {CONDITIONS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setFilterCondition(c.value)}
              className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                filterCondition === c.value ? c.badge : "bg-white/[0.03] border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Equipment list */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Package className="w-10 h-10 mb-3 opacity-30" />
            <p className="font-medium">{search || activeCategory !== "all" || filterCondition !== "all" ? "No equipment matches filters" : "No equipment yet"}</p>
            {!search && activeCategory === "all" && filterCondition === "all" && (
              <p className="text-sm mt-1">Pick a category above and tap an item to add it</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Equipment</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 hidden sm:table-cell">Category</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Condition</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 hidden md:table-cell">Last Maintenance</th>
                    <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3 hidden lg:table-cell">Value</th>
                    <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sidebar-border">
                  {filtered.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 shrink-0">
                            <CategoryIcon category={item.category} className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{item.name}</p>
                            <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="text-sm text-muted-foreground">{categoryLabel(item.category)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium ${conditionBadge(item.condition)}`}>
                          {conditionLabel(item.condition)}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-sm text-muted-foreground">
                        {item.last_maintenance_date ? formatDate(item.last_maintenance_date) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right hidden lg:table-cell text-sm font-medium">
                        {item.purchase_price ? formatCurrency(Number(item.purchase_price) * item.quantity) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(item)}><Edit2 className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(item.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={!!deleteId}
        title="Delete equipment?"
        description="This equipment record will be permanently deleted."
        onConfirm={() => { handleDelete(deleteId!); setDeleteId(null); }}
        onCancel={() => setDeleteId(null)}
      />

      {/* Quick-add dialog */}
      <Dialog open={!!quickAdd} onOpenChange={(o) => { if (!o) setQuickAdd(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add {quickAdd?.name}</DialogTitle>
          </DialogHeader>
          {quickAdd && (
            <div className="space-y-5 py-1">
              {/* Category badge */}
              <div className="flex items-center gap-2">
                <CategoryIcon category={quickAdd.category} className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs text-primary font-medium">{categoryLabel(quickAdd.category)}</span>
              </div>

              {/* Quantity */}
              <div className="space-y-2">
                <Label>Quantity</Label>
                <div className="flex items-center gap-2 flex-wrap">
                  {[1, 2, 3, 5, 10].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setQuickQty(q.toString())}
                      className={`w-10 h-10 rounded-xl text-sm font-semibold border transition-colors ${
                        quickQty === q.toString()
                          ? "bg-primary/15 border-primary/40 text-primary"
                          : "bg-white/[0.03] border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                  <Input
                    type="number"
                    min="1"
                    placeholder="Other"
                    value={[1,2,3,5,10].includes(parseInt(quickQty)) ? "" : quickQty}
                    onChange={(e) => setQuickQty(e.target.value)}
                    className="w-20 h-10"
                  />
                </div>
              </div>

              {/* Condition */}
              <div className="space-y-2">
                <Label>Condition</Label>
                <div className="flex flex-wrap gap-2">
                  {CONDITIONS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setQuickCondition(c.value)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        quickCondition === c.value ? c.badge : "bg-white/[0.03] border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickAdd(null)}>Cancel</Button>
            <Button onClick={handleQuickAdd} disabled={quickSaving}>
              {quickSaving ? "Adding…" : "Add Equipment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Full Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit Equipment" : "Custom Equipment"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input placeholder="e.g. Custom Machine…" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => {
                  const Icon = c.icon;
                  const active = form.category === c.value;
                  return (
                    <button key={c.value} type="button" onClick={() => setForm({ ...form, category: c.value })}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        active ? "bg-primary/15 border-primary/40 text-primary" : "bg-white/[0.03] border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"
                      }`}>
                      <Icon className="w-3 h-3" />{c.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Condition</Label>
              <div className="flex flex-wrap gap-2">
                {CONDITIONS.map((c) => (
                  <button key={c.value} type="button" onClick={() => setForm({ ...form, condition: c.value as EquipmentCondition })}
                    className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      form.condition === c.value ? c.badge : "bg-white/[0.03] border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"
                    }`}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Quantity</Label>
              <Input type="number" min="1" placeholder="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Purchase Price (PKR)</Label>
              <Input type="number" placeholder="0" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Purchase Date</Label>
                <Input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Last Maintenance</Label>
                <Input type="date" value={form.last_maintenance_date} onChange={(e) => setForm({ ...form, last_maintenance_date: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea placeholder="Optional…" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name}>
              {saving ? "Saving…" : editing ? "Update" : "Add Equipment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
