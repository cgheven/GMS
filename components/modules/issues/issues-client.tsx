"use client";
import { useState, useMemo } from "react";
import { Plus, MessageSquareWarning, CheckCircle2, Clock, Wrench, AlertTriangle, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { formatDate, capitalize } from "@/lib/utils";
import type { Issue, IssueCategory, IssuePriority, IssueStatus, Member } from "@/types";

type MemberRow = Pick<Member, "id" | "full_name">;

interface Props {
  gymId: string | null;
  issues: Issue[];
  members: MemberRow[];
}

const categoryIcons: Record<IssueCategory, string> = {
  equipment: "🏋️", cleanliness: "🧹", staff: "👤",
  facility: "🏢", billing: "💳", other: "📋",
};

const priorityColors: Record<IssuePriority, string> = {
  low:    "text-blue-400 bg-blue-500/10 border-blue-500/20",
  medium: "text-primary bg-primary/10 border-primary/20",
  high:   "text-rose-400 bg-rose-500/10 border-rose-500/20",
};

const statusConfig: Record<IssueStatus, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  open:        { label: "Open",        color: "text-rose-400",   icon: AlertTriangle },
  in_progress: { label: "In Progress", color: "text-primary",    icon: Clock },
  resolved:    { label: "Resolved",    color: "text-emerald-400", icon: CheckCircle2 },
};

const emptyForm = {
  title: "", description: "", category: "other" as IssueCategory,
  priority: "medium" as IssuePriority, member_id: "",
};

export function IssuesClient({ gymId, issues: initial, members }: Props) {
  const [issues, setIssues] = useState<Issue[]>(initial);
  const [tab, setTab] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [resolveDialog, setResolveDialog] = useState<Issue | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function reload() {
    if (!gymId) return;
    const supabase = createClient();
    const { data } = await supabase.from("pulse_issues")
      .select("*, member:pulse_members(full_name)")
      .eq("gym_id", gymId).order("created_at", { ascending: false });
    setIssues((data ?? []) as Issue[]);
  }

  async function handleSave() {
    if (!gymId || !form.title) return;
    setSaving(true);
    const supabase = createClient();
    const payload = {
      gym_id: gymId,
      title: form.title,
      description: form.description || null,
      category: form.category,
      priority: form.priority,
      member_id: form.member_id || null,
      status: "open" as IssueStatus,
    };
    const { error } = await supabase.from("pulse_issues").insert(payload);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
    else { toast({ title: "Issue logged" }); setDialogOpen(false); setForm(emptyForm); await reload(); }
    setSaving(false);
  }

  async function updateStatus(issue: Issue, status: IssueStatus) {
    const supabase = createClient();
    const { error } = await supabase.from("pulse_issues").update({ status }).eq("id", issue.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    await reload();
  }

  async function handleResolve() {
    if (!resolveDialog) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("pulse_issues").update({
      status: "resolved",
      resolution_notes: resolutionNotes || null,
      resolved_at: new Date().toISOString(),
    }).eq("id", resolveDialog.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
    else { toast({ title: "Issue resolved" }); setResolveDialog(null); setResolutionNotes(""); await reload(); }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("pulse_issues").delete().eq("id", id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Deleted" });
    await reload();
  }

  const filtered = useMemo(() => {
    if (tab === "all") return issues;
    return issues.filter((c) => c.status === tab);
  }, [issues, tab]);

  const stats = useMemo(() => ({
    open:        issues.filter((c) => c.status === "open").length,
    in_progress: issues.filter((c) => c.status === "in_progress").length,
    resolved:    issues.filter((c) => c.status === "resolved").length,
  }), [issues]);

  function IssueCard({ issue }: { issue: Issue }) {
    const cfg = statusConfig[issue.status];
    const StatusIcon = cfg.icon;
    return (
      <div className="rounded-xl border border-sidebar-border bg-card/50 p-4 hover:border-white/10 transition-colors">
        <div className="flex items-start gap-3">
          <span className="text-2xl shrink-0 mt-0.5">{categoryIcons[issue.category]}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium text-foreground">{issue.title}</p>
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-xs font-medium ${priorityColors[issue.priority]}`}>
                {capitalize(issue.priority)}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
              {issue.member?.full_name && <span className="text-xs text-muted-foreground">Member: {issue.member.full_name}</span>}
              <span className="text-xs text-muted-foreground capitalize">{categoryIcons[issue.category]} {capitalize(issue.category)}</span>
              <span className="text-xs text-muted-foreground">{formatDate(issue.created_at)}</span>
            </div>
            {issue.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{issue.description}</p>}
            {issue.resolution_notes && <p className="text-xs text-emerald-400 mt-1">✓ {issue.resolution_notes}</p>}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <div className={`flex items-center gap-1 text-xs font-medium ${cfg.color}`}>
              <StatusIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{cfg.label}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-sidebar-border">
          {issue.status === "open" && (
            <Button variant="ghost" size="sm" className="h-7 text-xs text-primary hover:bg-primary/10 border border-primary/20" onClick={() => updateStatus(issue, "in_progress")}>
              <Wrench className="w-3 h-3 mr-1" /> Start Progress
            </Button>
          )}
          {issue.status !== "resolved" && (
            <Button variant="ghost" size="sm" className="h-7 text-xs text-emerald-400 hover:bg-emerald-500/10 border border-emerald-500/20" onClick={() => { setResolveDialog(issue); setResolutionNotes(""); }}>
              <CheckCircle2 className="w-3 h-3 mr-1" /> Resolve
            </Button>
          )}
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(issue.id)}>
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-normal tracking-tight">Issues</h1>
          <p className="text-muted-foreground text-sm mt-1">Gym maintenance requests & member issues</p>
        </div>
        <Button onClick={() => { setForm(emptyForm); setDialogOpen(true); }} className="gap-2 w-full sm:w-auto">
          <Plus className="w-4 h-4" /> Log Issue
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Open",        value: stats.open,        color: "text-rose-400",   bg: "bg-rose-500/10 border border-rose-500/20" },
          { label: "In Progress", value: stats.in_progress, color: "text-primary",    bg: "bg-primary/10 border border-primary/20" },
          { label: "Resolved",    value: stats.resolved,    color: "text-emerald-400", bg: "bg-emerald-500/10 border border-emerald-500/20" },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`rounded-2xl border bg-card p-4 text-center ${bg}`}>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{label}</p>
          </div>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">All ({issues.length})</TabsTrigger>
          <TabsTrigger value="open"><AlertTriangle className="w-3 h-3" /> Open ({stats.open})</TabsTrigger>
          <TabsTrigger value="in_progress"><Clock className="w-3 h-3" /> In Progress ({stats.in_progress})</TabsTrigger>
          <TabsTrigger value="resolved"><CheckCircle2 className="w-3 h-3" /> Resolved ({stats.resolved})</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground rounded-2xl border border-sidebar-border bg-card">
              <MessageSquareWarning className="w-10 h-10 opacity-20" />
              <p className="text-sm">No issues in this category</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {filtered.map((issue) => <IssueCard key={issue.id} issue={issue} />)}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete issue?"
        description="This issue record will be permanently deleted."
        onConfirm={() => { handleDelete(deleteId!); setDeleteId(null); }}
        onCancel={() => setDeleteId(null)}
      />

      {/* Log Issue Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Log Issue</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input placeholder="e.g. Treadmill belt broken" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as IssueCategory })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(categoryIcons) as IssueCategory[]).map((c) => (
                      <SelectItem key={c} value={c}>{categoryIcons[c]} {capitalize(c)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as IssuePriority })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Member (optional)</Label>
              <Select value={form.member_id} onValueChange={(v) => setForm({ ...form, member_id: v === "_none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Select member (optional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">None</SelectItem>
                  {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea placeholder="Describe the issue…" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.title}>{saving ? "Saving…" : "Log Issue"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resolve Dialog */}
      <Dialog open={!!resolveDialog} onOpenChange={(o) => !o && setResolveDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Resolve Issue</DialogTitle></DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-muted-foreground">Resolving: <span className="text-foreground font-medium">{resolveDialog?.title}</span></p>
            <div className="space-y-1.5">
              <Label>Resolution Notes</Label>
              <Textarea placeholder="What was done to fix this?" value={resolutionNotes} onChange={(e) => setResolutionNotes(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialog(null)}>Cancel</Button>
            <Button onClick={handleResolve} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {saving ? "Saving…" : "Mark Resolved"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
