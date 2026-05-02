"use client";
import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Edit2, Trash2, KeyRound, Users, TrendingUp, Clock, CheckCircle2, UserX, Percent, DollarSign } from "lucide-react";
import { createReferrer, updateReferrer, deleteReferrer, createReferrerLogin, removeReferrerLogin, markReferralPaid } from "@/app/actions/referrers";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Referrer, Referral, ReferrerCommissionType } from "@/types";

interface Props {
  gymId: string | null;
  gymName?: string | null;
  referrers: Referrer[];
  referrals: (Referral & { member?: { full_name: string; phone: string | null; join_date: string } | null })[];
}

const emptyForm = {
  full_name: "", phone: "", email: "", notes: "",
  commission_type: "flat" as ReferrerCommissionType,
  commission_value: "",
  status: "active" as "active" | "inactive",
};

function buildUsername(name: string, gymName: string | null | undefined): string {
  const first = name.trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, "");
  const initials = gymName
    ? gymName.trim().split(/\s+/).map((w) => w[0]).join("").toLowerCase().replace(/[^a-z0-9]/g, "")
    : "";
  return initials ? `${first}.${initials}` : first;
}

export function ReferrersClient({ gymId, gymName, referrers: initial, referrals: initialReferrals }: Props) {
  const router = useRouter();
  const [referrers, setReferrers] = useState(initial);
  const [referrals, setReferrals] = useState(initialReferrals);

  // Sync local state when server data refreshes via router.refresh()
  useEffect(() => { setReferrers(initial); }, [initial]);
  useEffect(() => { setReferrals(initialReferrals); }, [initialReferrals]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Referrer | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Referrer | null>(null);

  // Login dialog
  const [loginDialog, setLoginDialog] = useState<Referrer | null>(null);
  const [loginForm, setLoginForm] = useState({ username: "", password: "", phone: "" });
  const [loginSaving, setLoginSaving] = useState(false);
  const [loginCreated, setLoginCreated] = useState<{ email: string; password: string; phone: string } | null>(null);

  function openAdd() { setEditing(null); setForm(emptyForm); setDialogOpen(true); }
  function openEdit(r: Referrer) {
    setEditing(r);
    setForm({
      full_name: r.full_name, phone: r.phone ?? "", email: r.email ?? "",
      notes: r.notes ?? "", commission_type: r.commission_type,
      commission_value: String(r.commission_value), status: r.status,
    });
    setDialogOpen(true);
  }
  function closeDialog() { setDialogOpen(false); setEditing(null); setForm(emptyForm); }

  async function handleSave() {
    if (!form.full_name || !form.commission_value) {
      toast({ title: "Name and commission value are required", variant: "destructive" }); return;
    }
    setSaving(true);
    const payload = {
      full_name: form.full_name, phone: form.phone || null, email: form.email || null,
      notes: form.notes || null, commission_type: form.commission_type,
      commission_value: parseFloat(form.commission_value) || 0,
      status: form.status,
    };
    const res = editing
      ? await updateReferrer(editing.id, payload)
      : await createReferrer(payload);
    setSaving(false);
    if (res.error) { toast({ title: "Error", description: res.error, variant: "destructive" }); return; }
    toast({ title: editing ? "Updated" : "Referrer added" });
    if (editing) {
      setReferrers((prev) => prev.map((r) => r.id === editing.id ? { ...r, ...payload, updated_at: new Date().toISOString() } : r));
    } else if ("id" in res && res.id) {
      const newRef: Referrer = {
        id: res.id as string,
        gym_id: gymId!,
        ...payload,
        phone: payload.phone ?? null,
        email: payload.email ?? null,
        notes: payload.notes ?? null,
        user_id: null,
        status: "active",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setReferrers((prev) => [...prev, newRef].sort((a, b) => a.full_name.localeCompare(b.full_name)));
    }
    closeDialog();
    router.refresh();
  }

  async function handleDelete(id: string) {
    const res = await deleteReferrer(id);
    if ("blocked" in res) {
      toast({ title: "Cannot delete", description: `${res.count} pending commission(s). Mark as paid first.`, variant: "destructive" });
    } else if (res.error) {
      toast({ title: "Error", description: res.error, variant: "destructive" });
    } else {
      toast({ title: "Deleted" });
      setReferrers((prev) => prev.filter((r) => r.id !== id));
    }
  }

  async function handleCreateLogin() {
    if (!loginDialog || !loginForm.username || !loginForm.password) return;
    setLoginSaving(true);
    const email = `${loginForm.username.trim().toLowerCase()}@musabkhan.me`;
    const res = await createReferrerLogin(loginDialog.id, email, loginForm.password);
    if (res.error) {
      toast({ title: "Error", description: res.error, variant: "destructive" });
    } else {
      const userId = "userId" in res && res.userId ? res.userId : email;
      setReferrers((prev) => prev.map((r) => r.id === loginDialog.id ? { ...r, user_id: userId, email } : r));
      setLoginCreated({ email, password: loginForm.password, phone: loginForm.phone });
    }
    setLoginSaving(false);
  }

  function closeLoginDialog() {
    setLoginDialog(null);
    setLoginCreated(null);
    setLoginForm({ username: "", password: "", phone: "" });
  }

  async function handleRemoveLogin(r: Referrer) {
    const res = await removeReferrerLogin(r.id);
    if (res.error) toast({ title: "Error", description: res.error, variant: "destructive" });
    else {
      toast({ title: "Login removed" });
      setReferrers((prev) => prev.map((ref) => ref.id === r.id ? { ...ref, user_id: null } : ref));
    }
  }

  async function handleMarkPaid(referralId: string) {
    const res = await markReferralPaid(referralId);
    if (res.error) { toast({ title: "Error", description: res.error, variant: "destructive" }); return; }
    toast({ title: "Marked as paid" });
    setReferrals((prev) => prev.map((r) => r.id === referralId ? { ...r, status: "paid" as const } : r));
  }

  const stats = useMemo(() => ({
    total: referrers.length,
    totalReferrals: referrals.length,
    pending: referrals.filter((r) => r.status === "pending").reduce((s, r) => s + r.commission_amount, 0),
    paid: referrals.filter((r) => r.status === "paid").reduce((s, r) => s + r.commission_amount, 0),
  }), [referrers, referrals]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Partners & Referrals</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage referral partners and track commissions</p>
        </div>
        <Button onClick={openAdd} className="gap-2"><Plus className="w-4 h-4" /> Add Partner</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Partners", value: stats.total, icon: Users },
          { label: "Total Referrals", value: stats.totalReferrals, icon: TrendingUp },
          { label: "Pending Payout", value: formatCurrency(stats.pending), icon: Clock },
          { label: "Paid Out", value: formatCurrency(stats.paid), icon: CheckCircle2 },
        ].map((s) => (
          <Card key={s.label} className="border-sidebar-border bg-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <s.icon className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <p className="text-xl font-bold text-foreground">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="partners">
        <TabsList><TabsTrigger value="partners">Partners</TabsTrigger><TabsTrigger value="referrals">Referrals</TabsTrigger></TabsList>

        {/* Partners tab */}
        <TabsContent value="partners" className="mt-4">
          <Card className="border-sidebar-border bg-card">
            <CardContent className="p-0">
              {referrers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Users className="w-10 h-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">No partners yet</p>
                </div>
              ) : (
                <div className="divide-y divide-sidebar-border">
                  {referrers.map((r) => {
                    const myReferrals = referrals.filter((ref) => ref.referrer_id === r.id);
                    const pendingAmt = myReferrals.filter((ref) => ref.status === "pending").reduce((s, ref) => s + ref.commission_amount, 0);
                    return (
                      <div key={r.id} className="flex items-center justify-between px-4 py-3 gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-foreground truncate">{r.full_name}</p>
                            <Badge variant="outline" className={r.status === "active" ? "text-green-400 border-green-500/30 bg-green-500/10" : "text-muted-foreground"}>
                              {r.status}
                            </Badge>
                            {r.user_id && <Badge variant="outline" className="text-primary border-primary/30 bg-primary/10 text-xs">Has Login</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {r.phone ?? "—"} · {r.commission_type === "flat" ? formatCurrency(r.commission_value) : `${r.commission_value}%`} per referral
                            {" · "}{myReferrals.length} referral(s)
                            {pendingAmt > 0 ? <span className="text-yellow-400"> · {formatCurrency(pendingAmt)} pending</span> : null}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {r.user_id ? (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleRemoveLogin(r)} title="Remove login">
                              <UserX className="w-3.5 h-3.5" />
                            </Button>
                          ) : (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => { setLoginDialog(r); setLoginForm({ username: buildUsername(r.full_name, gymName), password: "", phone: r.phone ?? "" }); }} title="Create login">
                              <KeyRound className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}><Edit2 className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(r)}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Referrals tab */}
        <TabsContent value="referrals" className="mt-4">
          <Card className="border-sidebar-border bg-card">
            <CardContent className="p-0">
              {referrals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <TrendingUp className="w-10 h-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">No referrals yet</p>
                </div>
              ) : (
                <div className="divide-y divide-sidebar-border">
                  {referrals.map((ref) => {
                    const referrer = referrers.find((r) => r.id === ref.referrer_id);
                    return (
                      <div key={ref.id} className="flex items-center justify-between px-4 py-3 gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">{ref.member?.full_name ?? "—"}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            via <span className="text-foreground/70">{referrer?.full_name ?? "—"}</span>
                            {" · "}Joined {ref.member?.join_date ? formatDate(ref.member.join_date) : "—"}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <p className="text-sm font-semibold text-foreground">{formatCurrency(ref.commission_amount)}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(ref.created_at)}</p>
                          </div>
                          {ref.status === "pending" ? (
                            <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleMarkPaid(ref.id)}>Mark Paid</Button>
                          ) : (
                            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Paid</Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{editing ? "Edit Partner" : "Add Partner"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Full Name *</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input placeholder="03001234567" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Commission Type *</Label>
              <Select value={form.commission_type} onValueChange={(v) => setForm({ ...form, commission_type: v as ReferrerCommissionType })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="flat"><span className="flex items-center gap-2"><DollarSign className="w-3.5 h-3.5" /> Flat amount (PKR)</span></SelectItem>
                  <SelectItem value="percentage"><span className="flex items-center gap-2"><Percent className="w-3.5 h-3.5" /> Percentage of monthly fee</span></SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{form.commission_type === "flat" ? "Amount (PKR) *" : "Percentage (%) *"}</Label>
              <Input type="number" min="0" placeholder={form.commission_type === "flat" ? "e.g. 500" : "e.g. 10"} value={form.commission_value} onChange={(e) => setForm({ ...form, commission_value: e.target.value })} />
            </div>
            {editing && (
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as "active" | "inactive" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea placeholder="Optional notes…" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : editing ? "Update" : "Add Partner"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Login Dialog */}
      <Dialog open={!!loginDialog} onOpenChange={(o) => !o && closeLoginDialog()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{loginCreated ? "Login Created" : `Create Login — ${loginDialog?.full_name}`}</DialogTitle>
          </DialogHeader>
          {loginCreated ? (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-green-500/10 border border-green-500/20 px-3 py-2.5 text-xs text-green-400">
                Login created for <span className="font-medium">{loginDialog?.full_name}</span>. Share credentials via WhatsApp.
              </div>
              <div className="rounded-lg border border-input bg-muted/30 px-3 py-2.5 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span className="font-mono font-medium">{loginCreated.email}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Password</span><span className="font-mono font-medium">{loginCreated.password}</span></div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const digits = loginCreated.phone.replace(/\D/g, "");
                  const intl = digits.startsWith("0") ? "92" + digits.slice(1) : digits;
                  const msg = `Hi ${loginDialog?.full_name}! 👋\n\nYour Partner Portal credentials for *Pulse GMS*:\n\n🔗 Login: ${window.location.origin}/login\n📧 Email: ${loginCreated.email}\n🔑 Password: ${loginCreated.password}\n\nYou can track your referrals and commissions after logging in.\n\nPlease save these credentials safely.`;
                  const url = intl ? `https://wa.me/${intl}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
                  window.open(url, "_blank");
                }}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-[#25D366]/30 bg-[#25D366]/10 text-[#25D366] text-sm font-medium hover:bg-[#25D366]/20 transition-colors"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Send via WhatsApp
              </button>
              <DialogFooter><Button className="w-full" onClick={closeLoginDialog}>Done</Button></DialogFooter>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Username *</Label>
                <div className="flex items-center rounded-md border border-input overflow-hidden focus-within:ring-1 focus-within:ring-ring">
                  <Input type="text" value={loginForm.username} onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value.replace(/\s/g, "").toLowerCase() })} className="border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0" />
                  <span className="px-3 text-sm font-medium text-primary bg-primary/10 border-l border-primary/20 whitespace-nowrap">@musabkhan.me</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Password *</Label>
                  <button type="button" onClick={() => { const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$!"; setLoginForm((f) => ({ ...f, password: Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("") })); }} className="text-xs text-primary hover:underline">Auto-generate</button>
                </div>
                <Input type="text" placeholder="Min 6 characters" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>WhatsApp Number</Label>
                <Input type="tel" placeholder="03001234567" value={loginForm.phone} onChange={(e) => setLoginForm({ ...loginForm, phone: e.target.value })} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeLoginDialog}>Cancel</Button>
                <Button onClick={handleCreateLogin} disabled={loginSaving || !loginForm.username || !loginForm.password} className="gap-1.5">
                  <KeyRound className="w-3.5 h-3.5" />{loginSaving ? "Creating…" : "Create Login"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete ${deleteTarget?.full_name}?`}
        description="Blocked if they have pending commissions. Paid referral history is preserved."
        onConfirm={() => { const t = deleteTarget; if (t) { handleDelete(t.id); setDeleteTarget(null); } }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
