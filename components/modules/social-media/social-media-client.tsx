"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Search, Edit2, Trash2, Instagram, KeyRound, UserX,
  CheckCircle2, Clock, XCircle, Users, TrendingUp, Wallet,
  ExternalLink, Eye, ChevronDown, Filter,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/hooks/use-toast";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  createSocialManager, updateSocialManager, deleteSocialManager,
  createSocialManagerLogin, removeSocialManagerLogin,
  approveSocialLead, rejectSocialLead, markSocialLeadPaid,
} from "@/app/actions/social";
import type { SocialManager, SocialLead, SocialCommissionType, SocialLeadStatus } from "@/types";

interface Props {
  gymId: string | null;
  gymName: string | null;
  managers: SocialManager[];
  leads: SocialLead[];
}

const PLATFORMS = ["instagram", "facebook", "tiktok", "whatsapp", "other"] as const;
const platformLabel = (p: string) => p.charAt(0).toUpperCase() + p.slice(1);

const STATUS_CONFIG: Record<SocialLeadStatus, { label: string; color: string }> = {
  unmatched:       { label: "Awaiting Match",    color: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30" },
  pending_review:  { label: "Needs Review",      color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  pending_payment: { label: "Pending Payment",   color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  rejected:        { label: "Rejected",          color: "bg-red-500/20 text-red-400 border-red-500/30" },
  paid:            { label: "Paid",              color: "bg-green-500/20 text-green-400 border-green-500/30" },
  expired:         { label: "Expired",           color: "bg-zinc-600/20 text-zinc-500 border-zinc-600/30" },
};

const emptyForm = {
  full_name: "", phone: "", email: "", notes: "",
  commission_type: "flat" as SocialCommissionType, commission_value: "",
  status: "active" as "active" | "inactive",
};

export function SocialMediaClient({ gymId, gymName, managers: initial, leads: initialLeads }: Props) {
  const router = useRouter();
  const [managers, setManagers] = useState(initial);
  const [leads, setLeads] = useState(initialLeads);
  const [search, setSearch] = useState("");
  const [leadSearch, setLeadSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<SocialLeadStatus | "all">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SocialManager | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [loginDialog, setLoginDialog] = useState<SocialManager | null>(null);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [loginSaving, setLoginSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SocialManager | null>(null);
  const [removeLoginTarget, setRemoveLoginTarget] = useState<SocialManager | null>(null);
  const [evidenceDialog, setEvidenceDialog] = useState<SocialLead | null>(null);
  const [rejectDialog, setRejectDialog] = useState<SocialLead | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => { setManagers(initial); }, [initial]);
  useEffect(() => { setLeads(initialLeads); }, [initialLeads]);

  function openNew() { setEditing(null); setForm(emptyForm); setDialogOpen(true); }
  function openEdit(m: SocialManager) {
    setEditing(m);
    setForm({
      full_name: m.full_name, phone: m.phone ?? "", email: m.email ?? "",
      notes: m.notes ?? "", commission_type: m.commission_type,
      commission_value: m.commission_value.toString(), status: m.status,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.full_name.trim()) return;
    setSaving(true);
    const payload = {
      full_name: form.full_name.trim(),
      phone: form.phone || null,
      email: form.email || null,
      notes: form.notes || null,
      commission_type: form.commission_type,
      commission_value: parseFloat(form.commission_value) || 0,
    };
    if (editing) {
      const res = await updateSocialManager(editing.id, { ...payload, status: form.status });
      if (res.error) { toast({ title: "Error", description: res.error, variant: "destructive" }); setSaving(false); return; }
      setManagers((prev) => prev.map((m) => m.id === editing.id ? { ...m, ...payload, status: form.status } : m));
    } else {
      const res = await createSocialManager(payload);
      if (res.error) { toast({ title: "Error", description: res.error, variant: "destructive" }); setSaving(false); return; }
      setManagers((prev) => [...prev, { id: res.id!, gym_id: gymId!, user_id: null, status: "active", created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...payload }]);
    }
    toast({ title: editing ? "Manager updated" : "Manager added" });
    setSaving(false);
    setDialogOpen(false);
    router.refresh();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const res = await deleteSocialManager(deleteTarget.id);
    if ("blocked" in res) { toast({ title: "Cannot delete", description: `${res.count} pending commission(s). Resolve first.`, variant: "destructive" }); setDeleteTarget(null); return; }
    if (res.error) { toast({ title: "Error", description: res.error, variant: "destructive" }); setDeleteTarget(null); return; }
    setManagers((prev) => prev.filter((m) => m.id !== deleteTarget.id));
    toast({ title: "Manager removed" });
    setDeleteTarget(null);
  }

  async function handleCreateLogin() {
    if (!loginDialog) return;
    setLoginSaving(true);
    const res = await createSocialManagerLogin(loginDialog.id, loginForm.email, loginForm.password);
    if (res.error) { toast({ title: "Error", description: res.error, variant: "destructive" }); setLoginSaving(false); return; }
    setManagers((prev) => prev.map((m) => m.id === loginDialog.id ? { ...m, user_id: res.userId as string, email: loginForm.email } : m));
    toast({ title: "Login created" });
    setLoginSaving(false);
    setLoginDialog(null);
    setLoginForm({ email: "", password: "" });
  }

  async function handleRemoveLogin() {
    if (!removeLoginTarget) return;
    const res = await removeSocialManagerLogin(removeLoginTarget.id);
    if (res.error) { toast({ title: "Error", description: res.error, variant: "destructive" }); setRemoveLoginTarget(null); return; }
    setManagers((prev) => prev.map((m) => m.id === removeLoginTarget.id ? { ...m, user_id: null } : m));
    toast({ title: "Login removed" });
    setRemoveLoginTarget(null);
  }

  async function handleApprove(lead: SocialLead) {
    setActionLoading(lead.id + "_approve");
    const res = await approveSocialLead(lead.id);
    if (res.error) { toast({ title: "Error", description: res.error, variant: "destructive" }); }
    else {
      setLeads((prev) => prev.map((l) => l.id === lead.id ? { ...l, status: "pending_payment" as SocialLeadStatus, approved_at: new Date().toISOString() } : l));
      toast({ title: "Lead approved", description: "Commission queued for payment." });
    }
    setActionLoading(null);
  }

  async function handleReject() {
    if (!rejectDialog) return;
    setActionLoading(rejectDialog.id + "_reject");
    const res = await rejectSocialLead(rejectDialog.id, rejectReason);
    if (res.error) { toast({ title: "Error", description: res.error, variant: "destructive" }); }
    else {
      setLeads((prev) => prev.map((l) => l.id === rejectDialog.id ? { ...l, status: "rejected" as SocialLeadStatus, rejection_reason: rejectReason } : l));
      toast({ title: "Lead rejected" });
      setRejectDialog(null);
      setRejectReason("");
    }
    setActionLoading(null);
  }

  async function handlePay(lead: SocialLead) {
    setActionLoading(lead.id + "_pay");
    const res = await markSocialLeadPaid(lead.id);
    if (res.error) { toast({ title: "Error", description: res.error, variant: "destructive" }); }
    else {
      setLeads((prev) => prev.map((l) => l.id === lead.id ? { ...l, status: "paid" as SocialLeadStatus, paid_at: new Date().toISOString() } : l));
      toast({ title: "Commission marked paid" });
    }
    setActionLoading(null);
  }

  const filteredManagers = useMemo(() =>
    managers.filter((m) => !search || m.full_name.toLowerCase().includes(search.toLowerCase())),
    [managers, search]);

  const filteredLeads = useMemo(() => {
    let list = leads;
    if (statusFilter !== "all") list = list.filter((l) => l.status === statusFilter);
    if (leadSearch) list = list.filter((l) =>
      l.lead_name.toLowerCase().includes(leadSearch.toLowerCase()) ||
      (l.lead_phone ?? "").includes(leadSearch) ||
      (l.lead_social_handle ?? "").toLowerCase().includes(leadSearch.toLowerCase()) ||
      (l.manager?.full_name ?? "").toLowerCase().includes(leadSearch.toLowerCase())
    );
    return list;
  }, [leads, statusFilter, leadSearch]);

  const stats = useMemo(() => {
    const review = leads.filter((l) => l.status === "pending_review").length;
    const pendingPayment = leads.filter((l) => l.status === "pending_payment").reduce((s, l) => s + Number(l.commission_amount ?? 0), 0);
    const paid = leads.filter((l) => l.status === "paid").reduce((s, l) => s + Number(l.commission_amount ?? 0), 0);
    return { review, pendingPayment, paid, totalLeads: leads.length };
  }, [leads]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Social Media</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage social media managers and commission leads</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Leads", value: stats.totalLeads, icon: Users, raw: true, color: "text-primary" },
          { label: "Needs Review", value: stats.review, icon: Clock, raw: true, color: "text-orange-400" },
          { label: "Pending Payout", value: formatCurrency(stats.pendingPayment), icon: Wallet, raw: false, color: "text-yellow-400" },
          { label: "Total Paid", value: formatCurrency(stats.paid), icon: TrendingUp, raw: false, color: "text-green-400" },
        ].map((s) => (
          <Card key={s.label} className="border-sidebar-border bg-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <s.icon className={`w-4 h-4 ${s.color}`} />
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <p className="text-xl font-bold text-foreground">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="leads">
        <TabsList className="bg-card border border-sidebar-border">
          <TabsTrigger value="leads">Leads {stats.review > 0 && <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] bg-orange-500/20 text-orange-400">{stats.review}</span>}</TabsTrigger>
          <TabsTrigger value="managers">Managers</TabsTrigger>
        </TabsList>

        {/* ── Leads tab ── */}
        <TabsContent value="leads" className="space-y-4 mt-4">
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search leads..." className="pl-9 bg-card border-sidebar-border" value={leadSearch} onChange={(e) => setLeadSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as SocialLeadStatus | "all")}>
              <SelectTrigger className="w-44 bg-card border-sidebar-border">
                <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card className="border-sidebar-border bg-card">
            <CardContent className="p-0">
              {filteredLeads.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Instagram className="w-10 h-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">No leads found</p>
                </div>
              ) : (
                <div className="divide-y divide-sidebar-border">
                  {filteredLeads.map((lead) => {
                    const cfg = STATUS_CONFIG[lead.status];
                    return (
                      <div key={lead.id} className="px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium text-foreground">{lead.lead_name}</p>
                              <Badge variant="outline" className={cfg.color}>{cfg.label}</Badge>
                              <Badge variant="outline" className="text-xs text-muted-foreground border-sidebar-border">{platformLabel(lead.platform)}</Badge>
                            </div>
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                              {lead.lead_phone && <p className="text-xs text-muted-foreground">{lead.lead_phone}</p>}
                              {lead.lead_social_handle && <p className="text-xs text-muted-foreground">{lead.lead_social_handle}</p>}
                              <p className="text-xs text-muted-foreground">by {lead.manager?.full_name ?? "—"}</p>
                              <p className="text-xs text-muted-foreground">{formatDate(lead.created_at)}</p>
                            </div>
                            {lead.member && (
                              <p className="text-xs text-primary mt-1">Matched: {lead.member.full_name} (joined {formatDate(lead.member.join_date ?? "")})</p>
                            )}
                            {lead.status === "rejected" && lead.rejection_reason && (
                              <p className="text-xs text-red-400 mt-1">Reason: {lead.rejection_reason}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {lead.commission_amount != null && (
                              <span className="text-sm font-semibold text-foreground">{formatCurrency(Number(lead.commission_amount))}</span>
                            )}
                            {lead.evidence_url && (
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEvidenceDialog(lead)}>
                                <Eye className="w-3.5 h-3.5 mr-1" /> Evidence
                              </Button>
                            )}
                            {lead.status === "pending_review" && (
                              <>
                                <Button size="sm" className="h-7 px-3 text-xs bg-green-600 hover:bg-green-700 text-white" disabled={actionLoading === lead.id + "_approve"} onClick={() => handleApprove(lead)}>Approve</Button>
                                <Button size="sm" variant="outline" className="h-7 px-3 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10" onClick={() => { setRejectDialog(lead); setRejectReason(""); }}>Reject</Button>
                              </>
                            )}
                            {lead.status === "pending_payment" && (
                              <Button size="sm" className="h-7 px-3 text-xs" disabled={actionLoading === lead.id + "_pay"} onClick={() => handlePay(lead)}>Mark Paid</Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Managers tab ── */}
        <TabsContent value="managers" className="space-y-4 mt-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search managers..." className="pl-9 bg-card border-sidebar-border" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Button onClick={openNew} size="sm" className="gap-1.5">
              <Plus className="w-4 h-4" /> Add Manager
            </Button>
          </div>

          <div className="space-y-3">
            {filteredManagers.length === 0 ? (
              <Card className="border-sidebar-border bg-card">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <Instagram className="w-10 h-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">No social media managers yet</p>
                  <Button onClick={openNew} size="sm" className="mt-4 gap-1.5"><Plus className="w-4 h-4" /> Add first manager</Button>
                </CardContent>
              </Card>
            ) : filteredManagers.map((m) => {
              const myLeads = leads.filter((l) => l.manager_id === m.id);
              const pendingCount = myLeads.filter((l) => ["pending_review", "pending_payment"].includes(l.status)).length;
              return (
                <Card key={m.id} className="border-sidebar-border bg-card">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-foreground">{m.full_name}</p>
                          <Badge variant="outline" className={m.status === "active" ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-zinc-500/20 text-zinc-400 border-zinc-500/30"}>
                            {m.status}
                          </Badge>
                          {m.user_id && <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">Has Login</Badge>}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5">
                          {m.phone && <p className="text-xs text-muted-foreground">{m.phone}</p>}
                          {m.email && <p className="text-xs text-muted-foreground">{m.email}</p>}
                          <p className="text-xs text-muted-foreground">
                            Commission: {m.commission_type === "flat" ? formatCurrency(m.commission_value) + " flat" : `${m.commission_value}% of fee`}
                          </p>
                          <p className="text-xs text-muted-foreground">{myLeads.length} leads{pendingCount > 0 ? ` · ${pendingCount} pending` : ""}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
                        {!m.user_id ? (
                          <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs border-sidebar-border gap-1" onClick={() => { setLoginDialog(m); setLoginForm({ email: "", password: "" }); }}>
                            <KeyRound className="w-3 h-3" /> Create Login
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10 gap-1" onClick={() => setRemoveLoginTarget(m)}>
                            <UserX className="w-3 h-3" /> Remove Login
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="h-7 px-2 border-sidebar-border" onClick={() => openEdit(m)}><Edit2 className="w-3.5 h-3.5" /></Button>
                        <Button size="sm" variant="outline" className="h-7 px-2 border-red-500/30 text-red-400 hover:bg-red-500/10" onClick={() => setDeleteTarget(m)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Add/Edit manager dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Edit Manager" : "Add Social Media Manager"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Full Name *</Label>
              <Input value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} placeholder="Ahmed Khan" className="bg-card border-sidebar-border" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="03xx-xxxxxxx" className="bg-card border-sidebar-border" />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="ahmed@..." className="bg-card border-sidebar-border" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Commission Type</Label>
              <Select value={form.commission_type} onValueChange={(v) => setForm((f) => ({ ...f, commission_type: v as SocialCommissionType }))}>
                <SelectTrigger className="bg-card border-sidebar-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="flat">Flat Amount per Lead</SelectItem>
                  <SelectItem value="percentage">% of Member&apos;s Monthly Fee</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{form.commission_type === "flat" ? "Amount (PKR)" : "Percentage (%)"}</Label>
              <Input type="number" value={form.commission_value} onChange={(e) => setForm((f) => ({ ...f, commission_value: e.target.value }))} placeholder={form.commission_type === "flat" ? "2000" : "10"} className="bg-card border-sidebar-border" />
            </div>
            {editing && (
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as "active" | "inactive" }))}>
                  <SelectTrigger className="bg-card border-sidebar-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional notes..." className="bg-card border-sidebar-border resize-none h-20" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="border-sidebar-border">Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.full_name.trim()}>{saving ? "Saving..." : editing ? "Save Changes" : "Add Manager"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create login dialog */}
      <Dialog open={!!loginDialog} onOpenChange={(o) => !o && setLoginDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Create Login — {loginDialog?.full_name}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={loginForm.email} onChange={(e) => setLoginForm((f) => ({ ...f, email: e.target.value }))} placeholder="name@musabkhan.me" className="bg-card border-sidebar-border" />
              <p className="text-xs text-muted-foreground">Must use @musabkhan.me domain</p>
            </div>
            <div className="space-y-1.5">
              <Label>Password</Label>
              <Input type="password" value={loginForm.password} onChange={(e) => setLoginForm((f) => ({ ...f, password: e.target.value }))} placeholder="Min 6 characters" className="bg-card border-sidebar-border" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLoginDialog(null)} className="border-sidebar-border">Cancel</Button>
            <Button onClick={handleCreateLogin} disabled={loginSaving || !loginForm.email || !loginForm.password}>{loginSaving ? "Creating..." : "Create Login"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Evidence viewer */}
      <Dialog open={!!evidenceDialog} onOpenChange={(o) => !o && setEvidenceDialog(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Evidence — {evidenceDialog?.lead_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground space-y-1">
              {evidenceDialog?.lead_phone && <p>Phone: {evidenceDialog.lead_phone}</p>}
              {evidenceDialog?.lead_social_handle && <p>Handle: {evidenceDialog.lead_social_handle}</p>}
              <p>Platform: {evidenceDialog ? platformLabel(evidenceDialog.platform) : ""}</p>
              <p>Registered: {evidenceDialog ? formatDate(evidenceDialog.created_at) : ""}</p>
              {evidenceDialog?.notes && <p>Notes: {evidenceDialog.notes}</p>}
            </div>
            {evidenceDialog?.evidence_url && (
              <div className="rounded-lg overflow-hidden border border-sidebar-border">
                <img src={evidenceDialog.evidence_url} alt="Evidence screenshot" className="w-full object-contain max-h-96" />
              </div>
            )}
            {evidenceDialog?.evidence_url && (
              <a href={evidenceDialog.evidence_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                <ExternalLink className="w-3 h-3" /> Open full image
              </a>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={(o) => !o && setRejectDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Reject Lead — {rejectDialog?.lead_name}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">This will reject the commission claim. The social media manager will see the rejection reason.</p>
            <div className="space-y-1.5">
              <Label>Reason (optional)</Label>
              <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="e.g. Screenshot doesn't match member name" className="bg-card border-sidebar-border resize-none h-20" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(null)} className="border-sidebar-border">Cancel</Button>
            <Button variant="destructive" disabled={actionLoading === rejectDialog?.id + "_reject"} onClick={handleReject}>Confirm Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete ${deleteTarget?.full_name}?`}
        description="This will permanently remove the social media manager and their login. Their lead history will be preserved."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Remove login confirm */}
      <ConfirmDialog
        open={!!removeLoginTarget}
        title="Remove login access?"
        description={`${removeLoginTarget?.full_name} will immediately lose access to their portal.`}
        confirmLabel="Remove Login"
        onConfirm={handleRemoveLogin}
        onCancel={() => setRemoveLoginTarget(null)}
      />
    </div>
  );
}
