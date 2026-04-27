"use client";
import { useState, useMemo } from "react";
import {
  Plus, Edit2, Trash2, Wrench, Package, DollarSign,
  Search, Filter, Bike, Dumbbell, BarChart2, Zap, Box,
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { formatCurrency, formatDate, formatDateInput } from "@/lib/utils";
import type { Equipment, EquipmentCategory, EquipmentCondition } from "@/types";

const CATEGORIES: { value: EquipmentCategory; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "cardio",       label: "Cardio",       icon: Bike },
  { value: "strength",     label: "Strength",     icon: BarChart2 },
  { value: "free_weights", label: "Free Weights", icon: Dumbbell },
  { value: "functional",   label: "Functional",   icon: Zap },
  { value: "accessories",  label: "Accessories",  icon: Box },
  { value: "other",        label: "Other",        icon: Package },
];

const CONDITIONS: { value: EquipmentCondition; label: string; badge: string }[] = [
  { value: "excellent",    label: "Excellent",    badge: "bg-emerald-500/10 border-emerald-500/25 text-emerald-400" },
  { value: "good",         label: "Good",         badge: "bg-blue-500/10 border-blue-500/25 text-blue-400" },
  { value: "fair",         label: "Fair",         badge: "bg-yellow-500/10 border-yellow-500/25 text-yellow-400" },
  { value: "needs_repair", label: "Needs Repair", badge: "bg-rose-500/10 border-rose-500/25 text-rose-400" },
  { value: "retired",      label: "Retired",      badge: "bg-white/5 border-white/10 text-muted-foreground" },
];

const conditionBadge = (condition: EquipmentCondition) =>
  CONDITIONS.find((c) => c.value === condition)?.badge ?? "";

const conditionLabel = (condition: EquipmentCondition) =>
  CONDITIONS.find((c) => c.value === condition)?.label ?? condition;

const categoryLabel = (category: EquipmentCategory) =>
  CATEGORIES.find((c) => c.value === category)?.label ?? category;

const CategoryIcon = ({ category, className }: { category: EquipmentCategory; className?: string }) => {
  const entry = CATEGORIES.find((c) => c.value === category);
  const Icon = entry?.icon ?? Package;
  return <Icon className={className} />;
};

const emptyForm = {
  name: "",
  category: "cardio" as EquipmentCategory,
  quantity: "1",
  purchase_date: "",
  purchase_price: "",
  condition: "good" as EquipmentCondition,
  last_maintenance_date: "",
  notes: "",
};

interface Props {
  gymId: string | null;
  equipment: Equipment[];
}

export function EquipmentClient({ gymId, equipment: initialEquipment }: Props) {
  const [equipment, setEquipment] = useState<Equipment[]>(initialEquipment);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterCondition, setFilterCondition] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Equipment | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function reload() {
    if (!gymId) return;
    const supabase = createClient();
    const { data } = await supabase.from("pulse_equipment").select("*").eq("gym_id", gymId).order("name");
    setEquipment((data as Equipment[]) ?? []);
  }

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(item: Equipment) {
    setEditing(item);
    setForm({
      name: item.name,
      category: item.category,
      quantity: item.quantity.toString(),
      purchase_date: item.purchase_date ?? "",
      purchase_price: item.purchase_price?.toString() ?? "",
      condition: item.condition,
      last_maintenance_date: item.last_maintenance_date ?? "",
      notes: item.notes ?? "",
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!gymId || !form.name) return;
    setSaving(true);
    const supabase = createClient();
    const payload = {
      gym_id: gymId,
      name: form.name,
      category: form.category,
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
    if (filterCategory !== "all") list = list.filter((e) => e.category === filterCategory);
    if (filterCondition !== "all") list = list.filter((e) => e.condition === filterCondition);
    return list;
  }, [equipment, search, filterCategory, filterCondition]);

  const stats = useMemo(() => {
    const totalItems = equipment.reduce((s, e) => s + e.quantity, 0);
    const needsRepair = equipment.filter((e) => e.condition === "needs_repair").length;
    const totalValue = equipment.reduce((s, e) => s + (e.purchase_price ? Number(e.purchase_price) * e.quantity : 0), 0);
    return { totalItems, needsRepair, totalValue };
  }, [equipment]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-normal tracking-tight">Equipment</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage gym equipment inventory</p>
        </div>
        <Button onClick={openAdd} className="gap-2 w-full sm:w-auto">
          <Plus className="w-4 h-4" /> Add Equipment
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total Items",   value: stats.totalItems,               icon: Package,  color: "text-blue-400",   bg: "bg-blue-500/10 border border-blue-500/20" },
          { label: "Needs Repair",  value: stats.needsRepair,              icon: Wrench,   color: "text-rose-400",   bg: "bg-rose-500/10 border border-rose-500/20" },
          { label: "Total Value",   value: formatCurrency(stats.totalValue), icon: DollarSign, color: "text-primary", bg: "bg-primary/10 border border-primary/20" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg ${bg}`}><Icon className={`w-4 h-4 ${color}`} /></div>
              <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-bold">{value}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search equipment..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterCondition} onValueChange={setFilterCondition}>
          <SelectTrigger className="w-full sm:w-44">
            <Filter className="w-3.5 h-3.5 mr-1.5" />
            <SelectValue placeholder="Condition" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Conditions</SelectItem>
            {CONDITIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Equipment list */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Package className="w-10 h-10 mb-3 opacity-30" />
            <p className="font-medium">{search || filterCategory !== "all" || filterCondition !== "all" ? "No equipment matches filters" : "No equipment yet"}</p>
            {!search && filterCategory === "all" && filterCondition === "all" && (
              <p className="text-sm mt-1">Add your first piece of equipment to get started</p>
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
                        <span className="text-sm text-muted-foreground capitalize">{categoryLabel(item.category)}</span>
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

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit Equipment" : "Add Equipment"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input placeholder="e.g. Treadmill, Dumbbell Set…" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as EquipmentCategory })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Quantity</Label>
                <Input type="number" min="1" placeholder="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Condition</Label>
                <Select value={form.condition} onValueChange={(v) => setForm({ ...form, condition: v as EquipmentCondition })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONDITIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Purchase Price (PKR)</Label>
                <Input type="number" placeholder="0" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} />
              </div>
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
