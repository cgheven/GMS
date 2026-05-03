"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Target, Plus, Search, Phone, Mail, MessageCircle, Trash2,
  Clock, CheckCircle2, XCircle, Send, Activity, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { toast } from "@/hooks/use-toast";
import { formatDate, formatDateInput, formatCurrency } from "@/lib/utils";
import { whatsappUrl } from "@/lib/whatsapp-reminder";
import {
  createLead, updateLead, deleteLead, setLeadStatus, markLeadLost,
  logLeadActivity, convertLeadToMember,
} from "@/app/actions/leads";
import type {
  Lead, LeadSource, LeadStatus, LeadLostReason, LeadActivityType,
  MembershipPlan, Staff,
} from "@/types";

type PlanLite = Pick<MembershipPlan, "id" | "name" | "price">;
type StaffLite = Pick<Staff, "id" | "full_name" | "role">;

interface Props {
  gymId: string | null;
  leads: Lead[];
  plans: PlanLite[];
  staff: StaffLite[];
}

const SOURCE_LABELS: Record<LeadSource, string> = {
  walk_in: "Walk-in", instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok",
  referral: "Referral", ad: "Ad", website: "Website", google: "Google", other: "Other",
};

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New", contacted: "Contacted", visited: "Visited",
  trial: "Trial", negotiating: "Negotiating", won: "Won", lost: "Lost",
};

const STATUS_STYLES: Record<LeadStatus, string> = {
  new:         "bg-sky-500/10 text-sky-400 border-sky-500/20",
  contacted:   "bg-primary/10 text-primary border-primary/20",
  visited:     "bg-amber-500/10 text-amber-400 border-amber-500/20",
  trial:       "bg-purple-500/10 text-purple-400 border-purple-500/20",
  negotiating: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  won:         "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  lost:        "bg-rose-500/10 text-rose-400 border-rose-500/20",
};

const ACTIVE_STATUSES: LeadStatus[] = ["new", "contacted", "visited", "trial", "negotiating"];

const LOST_REASONS: { value: LeadLostReason; label: string }[] = [
  { value: "price",       label: "Price too high" },
  { value: "location",    label: "Location" },
  { value: "schedule",    label: "Schedule mismatch" },
  { value: "competitor",  label: "Joined competitor" },
  { value: "not_ready",   label: "Not ready yet" },
  { value: "no_response", label: "No response" },
  { value: "other",       label: "Other" },
];

const OFFER_TEMPLATES = [
  { id: "discount20",  label: "20% off first month",       text: "Hi {name}! 🏋️ Special offer for you — get 20% off your first month at our gym. Reply YES to claim before it expires!" },
  { id: "freeTrial",   label: "Free 3-day trial",          text: "Hi {name}! Come try our gym FREE for 3 days. No commitment — just bring your gear and we'll set you up. Drop by anytime this week." },
  { id: "noAdmission", label: "No admission fee",          text: "Hi {name}! Limited-time: skip the admission fee when you sign up this week. Save instantly. Want me to lock it in for you?" },
  { id: "buddy",       label: "Bring a friend, both save", text: "Hi {name}! Sign up with a friend this week and both of you get 15% off + waived admission. Who's your gym buddy?" },
  { id: "followup",    label: "Soft follow-up",            text: "Hi {name}! Just checking in after your visit. Any questions about plans, timings, or trainers? Happy to help you get started." },
];

function daysSince(iso: string | null | undefined) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function followupBadge(date: string | null | undefined, status: LeadStatus): { text: string; cls: string } | null {
  if (!date || status === "won" || status === "lost") return null;
  const today = formatDateInput(new Date());
  if (date < today)  return { text: `Overdue ${daysSince(date)}d`, cls: "text-rose-400 bg-rose-500/10 border-rose-500/20" };
  if (date === today) return { text: "Due today",                    cls: "text-amber-400 bg-amber-500/10 border-amber-500/20" };
  return                    { text: `Due ${formatDate(date)}`,        cls: "text-muted-foreground bg-white/5 border-white/10" };
}

export function LeadsClient({ gymId, leads, plans, staff }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<LeadSource | "all">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailLead, setDetailLead] = useState<Lead | null>(null);

  const trainers = useMemo(() => staff.filter((s) => s.role === "trainer"), [staff]);
  const today = formatDateInput(new Date());

  // Stats
  const stats = useMemo(() => {
    const open = leads.filter((l) => ACTIVE_STATUSES.includes(l.status));
    const overdue = open.filter((l) => l.next_followup_at && l.next_followup_at < today);
    const dueToday = open.filter((l) => l.next_followup_at === today);
    const won = leads.filter((l) => l.status === "won").length;
    const lost = leads.filter((l) => l.status === "lost").length;
    const total = leads.length;
    const closedTotal = won + lost;
    const conversionRate = closedTotal > 0 ? Math.round((won / closedTotal) * 100) : 0;
    return { open: open.length, overdue: overdue.length, dueToday: dueToday.length, won, total, conversionRate };
  }, [leads, today]);

  // Source attribution
  const sourceStats = useMemo(() => {
    const map = new Map<LeadSource, { total: number; won: number }>();
    for (const l of leads) {
      const s = map.get(l.source) ?? { total: 0, won: 0 };
      s.total += 1;
      if (l.status === "won") s.won += 1;
      map.set(l.source, s);
    }
    return Array.from(map.entries())
      .map(([source, v]) => ({ source, ...v, rate: v.total > 0 ? Math.round((v.won / v.total) * 100) : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [leads]);

  const filtered = useMemo(() => {
    let list = leads;
    if (statusFilter !== "all") list = list.filter((l) => l.status === statusFilter);
    if (sourceFilter !== "all") list = list.filter((l) => l.source === sourceFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((l) =>
        l.full_name.toLowerCase().includes(q) ||
        (l.phone ?? "").includes(q) ||
        (l.email ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [leads, statusFilter, sourceFilter, search]);

  function refresh() { router.refresh(); }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-normal tracking-tight flex items-center gap-3">
            <Target className="w-7 h-7 text-primary" /> Leads
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Walk-ins, follow-ups, and conversions.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2 self-start sm:self-auto">
          <Plus className="w-4 h-4" /> Add Lead
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard label="Open" value={stats.open} icon={Target} />
        <StatCard label="Due today" value={stats.dueToday} icon={Clock} accent={stats.dueToday > 0 ? "amber" : undefined} />
        <StatCard label="Overdue" value={stats.overdue} icon={Clock} accent={stats.overdue > 0 ? "rose" : undefined} />
        <StatCard label="Won" value={stats.won} icon={CheckCircle2} accent="emerald" />
        <StatCard label="Conversion" value={`${stats.conversionRate}%`} icon={Activity} />
      </div>

      {/* Source attribution */}
      {sourceStats.length > 0 && (
        <div className="rounded-2xl border border-sidebar-border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">Source attribution</p>
          <div className="flex flex-wrap gap-2">
            {sourceStats.map((s) => (
              <div key={s.source} className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-sidebar-border bg-white/[0.02] text-xs">
                <span className="font-medium text-foreground">{SOURCE_LABELS[s.source]}</span>
                <span className="text-muted-foreground">{s.total} leads</span>
                <span className={`font-bold ${s.rate >= 50 ? "text-emerald-400" : s.rate >= 25 ? "text-primary" : "text-muted-foreground"}`}>
                  {s.rate}% won
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search name, phone, email…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(["all", ...ACTIVE_STATUSES, "won", "lost"] as const).map((s) => {
            const active = statusFilter === s;
            const label = s === "all" ? "All" : STATUS_LABELS[s];
            return (
              <button key={s} type="button" onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  active
                    ? "bg-primary/15 border-primary/30 text-primary"
                    : "bg-white/[0.03] border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"
                }`}>{label}</button>
            );
          })}
        </div>
      </div>

      {/* Pipeline list */}
      <div className="rounded-2xl border border-sidebar-border bg-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
            <Target className="w-10 h-10 opacity-20" />
            <p className="text-sm">No leads match these filters</p>
          </div>
        ) : (
          <div className="divide-y divide-sidebar-border/50">
            {filtered.map((l) => {
              const fb = followupBadge(l.next_followup_at, l.status);
              const sinceContact = daysSince(l.last_activity_at ?? l.updated_at);
              return (
                <button key={l.id} type="button"
                  onClick={() => setDetailLead(l)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors text-left">
                  <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                    {l.full_name[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-foreground truncate">{l.full_name}</p>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${STATUS_STYLES[l.status]}`}>
                        {STATUS_LABELS[l.status]}
                      </span>
                      {fb && <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${fb.cls}`}>{fb.text}</span>}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5 flex-wrap">
                      {l.phone && <span className="flex items-center gap-0.5"><Phone className="w-2.5 h-2.5" />{l.phone}</span>}
                      <span className="opacity-50">·</span>
                      <span>{SOURCE_LABELS[l.source]}</span>
                      {l.plan?.name && <><span className="opacity-50">·</span><span>{l.plan.name}</span></>}
                      {sinceContact != null && <><span className="opacity-50">·</span><span className={sinceContact > 7 ? "text-rose-400" : ""}>{sinceContact}d since contact</span></>}
                    </div>
                  </div>
                  {l.assignee?.full_name && (
                    <span className="hidden sm:inline text-[11px] text-muted-foreground shrink-0">{l.assignee.full_name}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Create dialog */}
      {createOpen && (
        <CreateLeadDialog
          plans={plans}
          staff={staff}
          onClose={() => setCreateOpen(false)}
          onSaved={() => { setCreateOpen(false); refresh(); }}
        />
      )}

      {/* Detail dialog */}
      {detailLead && gymId && (
        <LeadDetailDialog
          lead={detailLead}
          plans={plans}
          trainers={trainers}
          onClose={() => setDetailLead(null)}
          onChanged={refresh}
        />
      )}
    </div>
  );
}

// ── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, accent }: { icon: typeof Target; label: string; value: number | string; accent?: "emerald" | "rose" | "amber" }) {
  const cls = accent === "emerald" ? "border-emerald-500/20 bg-emerald-500/[0.04]"
            : accent === "rose"    ? "border-rose-500/20 bg-rose-500/[0.04]"
            : accent === "amber"   ? "border-amber-500/20 bg-amber-500/[0.04]"
            : "border-sidebar-border bg-card";
  const iconCls = accent === "emerald" ? "text-emerald-400"
                : accent === "rose"    ? "text-rose-400"
                : accent === "amber"   ? "text-amber-400"
                : "text-muted-foreground";
  return (
    <div className={`rounded-2xl border p-4 ${cls}`}>
      <div className={`flex items-center gap-2 text-xs mb-1 ${iconCls}`}>
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}

// ── Create lead dialog ───────────────────────────────────────────────────────

function CreateLeadDialog({ plans, staff, onClose, onSaved }: {
  plans: PlanLite[]; staff: StaffLite[]; onClose: () => void; onSaved: () => void;
}) {
  const trainers = staff.filter((s) => s.role === "trainer");
  const NO_TRAINER = "__none__";
  const [form, setForm] = useState({
    full_name: "", phone: "", email: "",
    source: "walk_in" as LeadSource,
    source_detail: "",
    interested_plan_id: "",
    fitness_goals: "",
    next_followup_at: "",
    assigned_to: NO_TRAINER,
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.full_name.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    setSaving(true);
    const res = await createLead({
      full_name: form.full_name,
      phone: form.phone || null,
      email: form.email || null,
      source: form.source,
      source_detail: form.source_detail || null,
      interested_plan_id: form.interested_plan_id || null,
      fitness_goals: form.fitness_goals || null,
      next_followup_at: form.next_followup_at || null,
      assigned_to: form.assigned_to === NO_TRAINER ? null : form.assigned_to,
      notes: form.notes || null,
    });
    setSaving(false);
    if (res.error) { toast({ title: "Error", description: res.error, variant: "destructive" }); return; }
    toast({ title: "Lead added" });
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg p-7">
        <DialogHeader>
          <DialogTitle>New Lead</DialogTitle>
          <p className="text-xs text-muted-foreground">Capture walk-in details so they don't slip through.</p>
        </DialogHeader>
        <div className="space-y-3 py-2 max-h-[65vh] overflow-y-auto px-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Full Name *</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input placeholder="+92 300 0000000" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Source</Label>
              <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v as LeadSource })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(SOURCE_LABELS) as [LeadSource, string][]).map(([k, label]) => (
                    <SelectItem key={k} value={k}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Source detail</Label>
              <Input placeholder="e.g. Saud's friend" value={form.source_detail}
                onChange={(e) => setForm({ ...form, source_detail: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Interested plan</Label>
              <Select value={form.interested_plan_id || "__none__"}
                onValueChange={(v) => setForm({ ...form, interested_plan_id: v === "__none__" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— None —</SelectItem>
                  {plans.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} · {formatCurrency(p.price)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Assigned to</Label>
              <Select value={form.assigned_to} onValueChange={(v) => setForm({ ...form, assigned_to: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_TRAINER}>— Unassigned —</SelectItem>
                  {trainers.map((t) => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Next follow-up</Label>
            <DatePicker value={form.next_followup_at} onChange={(v) => setForm({ ...form, next_followup_at: v })} minDate={new Date()} />
          </div>
          <div className="space-y-1.5">
            <Label>Fitness goals</Label>
            <Input placeholder="e.g. Lose 5kg, build muscle" value={form.fitness_goals}
              onChange={(e) => setForm({ ...form, fitness_goals: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input placeholder="Anything relevant" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || !form.full_name.trim()}>
            {saving ? "Saving…" : "Add Lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Lead detail dialog ───────────────────────────────────────────────────────

function LeadDetailDialog({ lead, plans, trainers, onClose, onChanged }: {
  lead: Lead;
  plans: PlanLite[];
  trainers: StaffLite[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [activityType, setActivityType] = useState<LeadActivityType>("note");
  const [activityNote, setActivityNote] = useState("");
  const [showOffers, setShowOffers] = useState(false);
  const [showLost, setShowLost] = useState(false);
  const [showConvert, setShowConvert] = useState(false);
  const [followupDate, setFollowupDate] = useState(lead.next_followup_at ?? "");

  async function changeStatus(s: LeadStatus) {
    setBusy(true);
    const res = await setLeadStatus(lead.id, s);
    setBusy(false);
    if (res.error) toast({ title: "Error", description: res.error, variant: "destructive" });
    else { toast({ title: `Marked ${STATUS_LABELS[s].toLowerCase()}` }); onChanged(); onClose(); }
  }

  async function logActivity() {
    if (!activityNote.trim() && activityType === "note") return;
    setBusy(true);
    const res = await logLeadActivity(lead.id, activityType, activityNote);
    setBusy(false);
    if (res.error) toast({ title: "Error", description: res.error, variant: "destructive" });
    else { toast({ title: "Activity logged" }); setActivityNote(""); onChanged(); }
  }

  async function setFollowup() {
    setBusy(true);
    const res = await updateLead(lead.id, { next_followup_at: followupDate || null });
    setBusy(false);
    if (res.error) toast({ title: "Error", description: res.error, variant: "destructive" });
    else { toast({ title: "Follow-up updated" }); onChanged(); }
  }

  async function remove() {
    if (!confirm(`Delete lead "${lead.full_name}"? This is permanent.`)) return;
    setBusy(true);
    const res = await deleteLead(lead.id);
    setBusy(false);
    if (res.error) toast({ title: "Error", description: res.error, variant: "destructive" });
    else { toast({ title: "Lead deleted" }); onChanged(); onClose(); }
  }

  function sendWhatsApp(template: typeof OFFER_TEMPLATES[number]) {
    if (!lead.phone) {
      toast({ title: "No phone number on this lead", variant: "destructive" });
      return;
    }
    const msg = template.text.replace("{name}", lead.full_name.split(" ")[0]);
    const url = whatsappUrl(lead.phone, msg);
    if (!url) {
      toast({ title: "Invalid phone number", variant: "destructive" });
      return;
    }
    window.open(url, "_blank");
    logLeadActivity(lead.id, "offer", `Sent: ${template.label}`).then(() => onChanged());
  }

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-2xl p-0 overflow-hidden">
          <div className="px-6 pt-6 pb-4 border-b border-sidebar-border">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center text-lg font-bold text-primary shrink-0">
                {lead.full_name[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-xl flex items-center gap-2">
                  {lead.full_name}
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${STATUS_STYLES[lead.status]}`}>
                    {STATUS_LABELS[lead.status]}
                  </span>
                </DialogTitle>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1">
                  {lead.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{lead.phone}</span>}
                  {lead.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{lead.email}</span>}
                  <span>· {SOURCE_LABELS[lead.source]}{lead.source_detail && ` (${lead.source_detail})`}</span>
                  {lead.plan?.name && <span>· Interested: {lead.plan.name}</span>}
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 py-5 max-h-[65vh] overflow-y-auto space-y-5">
            {lead.fitness_goals && (
              <div className="rounded-lg border border-primary/15 bg-primary/[0.03] px-3 py-2">
                <p className="text-[10px] text-primary uppercase tracking-wider font-semibold">Fitness Goal</p>
                <p className="text-sm text-foreground mt-0.5">{lead.fitness_goals}</p>
              </div>
            )}

            {/* Status pipeline */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Move through pipeline</p>
              <div className="flex flex-wrap gap-1.5">
                {ACTIVE_STATUSES.map((s) => (
                  <button key={s} type="button" disabled={busy || lead.status === s}
                    onClick={() => changeStatus(s)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      lead.status === s
                        ? `${STATUS_STYLES[s]}`
                        : "bg-white/[0.03] border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"
                    } disabled:opacity-50`}>
                    {STATUS_LABELS[s]}
                  </button>
                ))}
                <div className="h-7 w-px bg-white/10 mx-1" />
                <button type="button" disabled={busy || lead.status === "won"}
                  onClick={() => setShowConvert(true)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium border bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50 inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Convert
                </button>
                <button type="button" disabled={busy || lead.status === "lost"}
                  onClick={() => setShowLost(true)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium border bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20 transition-colors disabled:opacity-50 inline-flex items-center gap-1">
                  <XCircle className="w-3 h-3" /> Lost
                </button>
              </div>
            </div>

            {/* Follow-up */}
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 items-end">
              <div className="space-y-1.5">
                <Label className="text-xs">Next follow-up</Label>
                <DatePicker value={followupDate} onChange={setFollowupDate} />
              </div>
              <Button size="sm" onClick={setFollowup} disabled={busy}>Save</Button>
              <Button size="sm" variant="outline" onClick={() => setShowOffers(true)} disabled={!lead.phone} className="gap-1">
                <Send className="w-3.5 h-3.5" /> Send Offer
              </Button>
            </div>

            {/* Activity log */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Log activity</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Select value={activityType} onValueChange={(v) => setActivityType(v as LeadActivityType)}>
                  <SelectTrigger className="sm:w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="note">📝 Note</SelectItem>
                    <SelectItem value="call">📞 Call</SelectItem>
                    <SelectItem value="message">💬 Message</SelectItem>
                    <SelectItem value="visit">🚪 Visit</SelectItem>
                    <SelectItem value="trial">🏋️ Trial</SelectItem>
                  </SelectContent>
                </Select>
                <Input placeholder="What happened? (optional)" value={activityNote}
                  onChange={(e) => setActivityNote(e.target.value)}
                  className="flex-1" />
                <Button size="sm" onClick={logActivity} disabled={busy}>Log</Button>
              </div>
            </div>

            {/* Lost reason if applicable */}
            {lead.status === "lost" && lead.lost_reason && (
              <div className="rounded-lg border border-rose-500/15 bg-rose-500/[0.03] px-3 py-2">
                <p className="text-[10px] text-rose-400 uppercase tracking-wider font-semibold">Lost</p>
                <p className="text-sm text-foreground mt-0.5">
                  {LOST_REASONS.find((r) => r.value === lead.lost_reason)?.label ?? lead.lost_reason}
                  {lead.lost_note && ` — ${lead.lost_note}`}
                </p>
              </div>
            )}

            {lead.notes && (
              <div className="rounded-lg border border-sidebar-border bg-card/50 px-3 py-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Notes</p>
                <p className="text-sm text-foreground mt-0.5">{lead.notes}</p>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button onClick={remove} disabled={busy}
                className="text-xs text-muted-foreground hover:text-rose-400 inline-flex items-center gap-1">
                <Trash2 className="w-3 h-3" /> Delete lead
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {showOffers && (
        <Dialog open onOpenChange={(o) => !o && setShowOffers(false)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Send Offer via WhatsApp</DialogTitle>
              <p className="text-xs text-muted-foreground">Pick a template — opens in WhatsApp pre-filled.</p>
            </DialogHeader>
            <div className="space-y-2 py-2">
              {OFFER_TEMPLATES.map((t) => (
                <button key={t.id} type="button"
                  onClick={() => { sendWhatsApp(t); setShowOffers(false); }}
                  className="w-full text-left p-3 rounded-lg border border-sidebar-border bg-card hover:border-primary/30 hover:bg-primary/[0.04] transition-colors">
                  <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <MessageCircle className="w-3.5 h-3.5 text-primary" /> {t.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {t.text.replace("{name}", lead.full_name.split(" ")[0])}
                  </p>
                </button>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowOffers(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {showLost && (
        <LostReasonDialog
          onConfirm={async (reason, note) => {
            const res = await markLeadLost(lead.id, reason, note);
            if (res.error) toast({ title: "Error", description: res.error, variant: "destructive" });
            else { toast({ title: "Marked lost" }); onChanged(); onClose(); }
          }}
          onClose={() => setShowLost(false)}
        />
      )}

      {showConvert && (
        <ConvertDialog
          lead={lead}
          plans={plans}
          trainers={trainers}
          onClose={() => setShowConvert(false)}
          onSaved={() => { setShowConvert(false); onChanged(); onClose(); }}
        />
      )}
    </>
  );
}

// ── Lost reason dialog ───────────────────────────────────────────────────────

function LostReasonDialog({ onConfirm, onClose }: { onConfirm: (reason: LeadLostReason, note?: string) => void; onClose: () => void }) {
  const [reason, setReason] = useState<LeadLostReason>("price");
  const [note, setNote] = useState("");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Why was this lost?</DialogTitle></DialogHeader>
        <div className="space-y-2 py-2">
          {LOST_REASONS.map((r) => (
            <button key={r.value} type="button" onClick={() => setReason(r.value)}
              className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                reason === r.value
                  ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                  : "bg-white/[0.03] border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"
              }`}>{r.label}</button>
          ))}
          <div className="space-y-1.5 pt-1">
            <Label>Note (optional)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Will reconsider next month" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onConfirm(reason, note || undefined)}>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Convert dialog ───────────────────────────────────────────────────────────

function ConvertDialog({ lead, plans, trainers, onClose, onSaved }: {
  lead: Lead; plans: PlanLite[]; trainers: StaffLite[]; onClose: () => void; onSaved: () => void;
}) {
  const NO_TRAINER = "__none__";
  const today = formatDateInput(new Date());
  const targetDate = new Date(); targetDate.setMonth(targetDate.getMonth() + 1);
  const [form, setForm] = useState({
    plan_id: lead.interested_plan_id ?? "",
    monthly_fee: "",
    admission_fee: "0",
    admission_paid: true,
    join_date: today,
    plan_expiry_date: formatDateInput(targetDate),
    assigned_trainer_id: lead.assigned_to ?? NO_TRAINER,
  });
  const [saving, setSaving] = useState(false);

  function pickPlan(planId: string) {
    const p = plans.find((pp) => pp.id === planId);
    setForm((f) => ({ ...f, plan_id: planId, monthly_fee: p ? String(p.price) : f.monthly_fee }));
  }

  async function save() {
    setSaving(true);
    const res = await convertLeadToMember(lead.id, {
      plan_id: form.plan_id || null,
      monthly_fee: parseFloat(form.monthly_fee) || 0,
      admission_fee: parseFloat(form.admission_fee) || 0,
      admission_paid: form.admission_paid,
      join_date: form.join_date,
      plan_expiry_date: form.plan_expiry_date,
      assigned_trainer_id: form.assigned_trainer_id === NO_TRAINER ? null : form.assigned_trainer_id,
    });
    setSaving(false);
    if (res.error) { toast({ title: "Error", description: res.error, variant: "destructive" }); return; }
    toast({ title: `🎉 ${lead.full_name} converted to member` });
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Convert to Member</DialogTitle>
          <p className="text-xs text-muted-foreground">Creates a member from this lead with their info.</p>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="rounded-lg bg-white/[0.03] border border-white/10 px-3 py-2 text-xs">
            <p className="font-semibold text-foreground">{lead.full_name}</p>
            <p className="text-muted-foreground">{lead.phone ?? "no phone"} · {lead.email ?? "no email"}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Plan</Label>
              <Select value={form.plan_id || "__none__"} onValueChange={(v) => pickPlan(v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— None —</SelectItem>
                  {plans.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} · {formatCurrency(p.price)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Trainer</Label>
              <Select value={form.assigned_trainer_id} onValueChange={(v) => setForm({ ...form, assigned_trainer_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_TRAINER}>SELF</SelectItem>
                  {trainers.map((t) => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Monthly Fee</Label>
              <Input type="number" value={form.monthly_fee} onChange={(e) => setForm({ ...form, monthly_fee: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Admission Fee</Label>
              <Input type="number" value={form.admission_fee} onChange={(e) => setForm({ ...form, admission_fee: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Join Date</Label>
              <DatePicker value={form.join_date} onChange={(v) => setForm({ ...form, join_date: v })} />
            </div>
            <div className="space-y-1.5">
              <Label>Plan Expiry</Label>
              <DatePicker value={form.plan_expiry_date} onChange={(v) => setForm({ ...form, plan_expiry_date: v })} />
            </div>
          </div>
          {parseFloat(form.admission_fee) > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-sidebar-border bg-white/[0.02] p-2.5">
              <button type="button" onClick={() => setForm({ ...form, admission_paid: true })}
                className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  form.admission_paid
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                    : "bg-white/5 text-muted-foreground border border-transparent hover:text-foreground"
                }`}>Admission Paid</button>
              <button type="button" onClick={() => setForm({ ...form, admission_paid: false })}
                className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  !form.admission_paid
                    ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                    : "bg-white/5 text-muted-foreground border border-transparent hover:text-foreground"
                }`}>Pending</button>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {saving ? "Converting…" : "🎉 Convert to Member"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
