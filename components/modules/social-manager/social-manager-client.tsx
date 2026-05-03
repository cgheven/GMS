"use client";
import { useState, useMemo, useRef, useEffect } from "react";
import {
  Plus, Users, Clock, CheckCircle2, TrendingUp,
  Instagram, Upload, X, Eye, ExternalLink, AlertCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { formatCurrency, formatDate } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { createSocialLead } from "@/app/actions/social";
import type { SocialManager, SocialLead, SocialLeadStatus, SocialPlatform } from "@/types";

interface Props {
  manager: SocialManager & { gym?: { name: string } | null };
  leads: SocialLead[];
}

const PLATFORMS: { value: SocialPlatform; label: string }[] = [
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "tiktok", label: "TikTok" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "other", label: "Other" },
];

const STATUS_CONFIG: Record<SocialLeadStatus, { label: string; color: string; desc: string }> = {
  unmatched:       { label: "Awaiting Match",   color: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",     desc: "Waiting for customer to walk in" },
  pending_review:  { label: "Under Review",     color: "bg-orange-500/20 text-orange-400 border-orange-500/30", desc: "Owner is reviewing your claim" },
  pending_payment: { label: "Approved",         color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", desc: "Commission will be paid soon" },
  rejected:        { label: "Rejected",         color: "bg-red-500/20 text-red-400 border-red-500/30",        desc: "Owner rejected this claim" },
  paid:            { label: "Paid",             color: "bg-green-500/20 text-green-400 border-green-500/30", desc: "Commission paid out" },
  expired:         { label: "Expired",          color: "bg-zinc-600/20 text-zinc-500 border-zinc-600/30",    desc: "Lead expired without conversion" },
};

const emptyForm = {
  lead_name: "",
  lead_phone: "",
  lead_social_handle: "",
  platform: "instagram" as SocialPlatform,
  notes: "",
};

export function SocialManagerClient({ manager, leads: initialLeads }: Props) {
  const [leads, setLeads] = useState(initialLeads);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [evidenceDialog, setEvidenceDialog] = useState<SocialLead | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { toast({ title: "File too large", description: "Max 5MB", variant: "destructive" }); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  function removeFile() {
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSubmit() {
    if (!form.lead_name.trim()) { toast({ title: "Lead name required", variant: "destructive" }); return; }
    if (!file && !form.lead_phone) {
      toast({ title: "Evidence or phone required", description: "Upload a screenshot OR enter the lead's phone number (or both).", variant: "destructive" });
      return;
    }

    setSaving(true);
    let evidenceUrl: string | null = null;

    if (file) {
      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${manager.gym_id ?? manager.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("social-evidence").upload(path, file, { upsert: false });
      if (uploadError) {
        toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
        setSaving(false);
        return;
      }
      const { data: { publicUrl } } = supabase.storage.from("social-evidence").getPublicUrl(path);
      evidenceUrl = publicUrl;
    }

    const res = await createSocialLead({
      lead_name: form.lead_name.trim(),
      lead_phone: form.lead_phone || null,
      lead_social_handle: form.lead_social_handle || null,
      platform: form.platform,
      evidence_url: evidenceUrl,
      notes: form.notes || null,
    });

    if (res.error) {
      toast({ title: "Error", description: res.error, variant: "destructive" });
      setSaving(false);
      return;
    }

    const newLead: SocialLead = {
      id: res.id as string,
      gym_id: manager.gym_id ?? "",
      manager_id: manager.id,
      lead_name: form.lead_name.trim(),
      lead_phone: form.lead_phone || null,
      lead_social_handle: form.lead_social_handle || null,
      platform: form.platform,
      evidence_url: evidenceUrl,
      notes: form.notes || null,
      member_id: null,
      matched_by: null,
      matched_at: null,
      commission_amount: null,
      status: "unmatched",
      rejection_reason: null,
      approved_at: null,
      paid_at: null,
      expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setLeads((prev) => [newLead, ...prev]);
    toast({ title: "Lead registered", description: "You'll be notified when the customer walks in and is matched." });
    setForm(emptyForm);
    removeFile();
    setSaving(false);
    setAddOpen(false);
  }

  const stats = useMemo(() => {
    const pending = leads.filter((l) => ["unmatched", "pending_review"].includes(l.status)).length;
    const pendingPayout = leads.filter((l) => l.status === "pending_payment").reduce((s, l) => s + Number(l.commission_amount ?? 0), 0);
    const paid = leads.filter((l) => l.status === "paid").reduce((s, l) => s + Number(l.commission_amount ?? 0), 0);
    return { total: leads.length, pending, pendingPayout, paid, totalEarned: pendingPayout + paid };
  }, [leads]);

  const commissionLabel = manager.commission_type === "flat"
    ? `${formatCurrency(manager.commission_value)} flat per confirmed lead`
    : `${manager.commission_value}% of member's monthly fee`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Leads</h1>
          <p className="text-sm text-muted-foreground mt-1">Commission rate: {commissionLabel}</p>
        </div>
        <Button onClick={() => setAddOpen(true)} size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" /> Add Lead
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Leads", value: stats.total, icon: Users, raw: true },
          { label: "In Progress", value: stats.pending, icon: Clock, raw: true },
          { label: "Pending Payout", value: formatCurrency(stats.pendingPayout), icon: TrendingUp, raw: false },
          { label: "Total Earned", value: formatCurrency(stats.totalEarned), icon: CheckCircle2, raw: false },
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

      {/* How it works callout */}
      {leads.length === 0 && (
        <Card className="border-sidebar-border bg-card">
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-foreground mb-3">How it works</p>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>Register a lead here — enter their name, phone number (if you have it), and upload the DM screenshot as evidence.</li>
              <li>When that person walks into the gym, staff will see your pre-registered lead and match it to the new member.</li>
              <li>If the phone matches, commission is auto-approved. If matched by name, the owner reviews your evidence first.</li>
              <li>Once approved, the owner pays your commission and it shows as &quot;Paid&quot; here.</li>
            </ol>
          </CardContent>
        </Card>
      )}

      {/* Leads list */}
      <Card className="border-sidebar-border bg-card">
        <CardContent className="p-0">
          {leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Instagram className="w-10 h-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No leads yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Add your first lead when someone DMs the gym page</p>
              <Button onClick={() => setAddOpen(true)} size="sm" className="mt-4 gap-1.5"><Plus className="w-4 h-4" /> Add Lead</Button>
            </div>
          ) : (
            <div className="divide-y divide-sidebar-border">
              {leads.map((lead) => {
                const cfg = STATUS_CONFIG[lead.status];
                const daysLeft = Math.ceil((new Date(lead.expires_at).getTime() - Date.now()) / 86400000);
                return (
                  <div key={lead.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-foreground">{lead.lead_name}</p>
                          <Badge variant="outline" className={cfg.color}>{cfg.label}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                          {lead.lead_phone && <p className="text-xs text-muted-foreground">{lead.lead_phone}</p>}
                          {lead.lead_social_handle && <p className="text-xs text-muted-foreground">{lead.lead_social_handle}</p>}
                          <p className="text-xs text-muted-foreground capitalize">{lead.platform}</p>
                          <p className="text-xs text-muted-foreground">Added {formatDate(lead.created_at)}</p>
                          {lead.status === "unmatched" && daysLeft > 0 && daysLeft < 14 && (
                            <p className="text-xs text-orange-400">{daysLeft}d left</p>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground/70 mt-0.5">{cfg.desc}</p>
                        {lead.status === "rejected" && lead.rejection_reason && (
                          <p className="text-xs text-red-400 mt-1">Reason: {lead.rejection_reason}</p>
                        )}
                        {lead.member && lead.status !== "unmatched" && (
                          <p className="text-xs text-primary mt-1">Matched to: {lead.member.full_name}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {lead.commission_amount != null && (
                          <p className="text-sm font-semibold text-foreground">{formatCurrency(Number(lead.commission_amount))}</p>
                        )}
                        {lead.evidence_url && (
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEvidenceDialog(lead)}>
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
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

      {/* Add lead dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Register New Lead</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">

            <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3">
              <div className="flex gap-2 text-xs text-yellow-400">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>Register leads <strong>before</strong> the customer walks in. The timestamp proves you knew them first.</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Lead Name *</Label>
              <Input value={form.lead_name} onChange={(e) => setForm((f) => ({ ...f, lead_name: e.target.value }))} placeholder="Ahmed Khan" className="bg-card border-sidebar-border" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Phone Number</Label>
                <Input value={form.lead_phone} onChange={(e) => setForm((f) => ({ ...f, lead_phone: e.target.value }))} placeholder="03xx-xxxxxxx" className="bg-card border-sidebar-border" />
                <p className="text-[10px] text-muted-foreground">Enables auto-match (recommended)</p>
              </div>
              <div className="space-y-1.5">
                <Label>Social Handle</Label>
                <Input value={form.lead_social_handle} onChange={(e) => setForm((f) => ({ ...f, lead_social_handle: e.target.value }))} placeholder="@ahmed_pk" className="bg-card border-sidebar-border" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Platform</Label>
              <Select value={form.platform} onValueChange={(v) => setForm((f) => ({ ...f, platform: v as SocialPlatform }))}>
                <SelectTrigger className="bg-card border-sidebar-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Evidence upload */}
            <div className="space-y-1.5">
              <Label>Screenshot Evidence</Label>
              {!preview ? (
                <div
                  onClick={() => fileRef.current?.click()}
                  className="flex flex-col items-center justify-center border-2 border-dashed border-sidebar-border rounded-lg p-6 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors"
                >
                  <Upload className="w-6 h-6 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Click to upload DM screenshot</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">JPG, PNG, WebP — max 5MB</p>
                </div>
              ) : (
                <div className="relative rounded-lg overflow-hidden border border-sidebar-border">
                  <img src={preview} alt="Preview" className="w-full object-contain max-h-48" />
                  <button onClick={removeFile} className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors">
                    <X className="w-3.5 h-3.5 text-white" />
                  </button>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleFileChange} />
              <p className="text-[10px] text-muted-foreground">Screenshot of the DM conversation showing this person&apos;s name/handle</p>
            </div>

            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="e.g. Interested in monthly plan, said will visit this week" className="bg-card border-sidebar-border resize-none h-16" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} className="border-sidebar-border">Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving || !form.lead_name.trim()}>{saving ? "Registering..." : "Register Lead"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Evidence viewer */}
      <Dialog open={!!evidenceDialog} onOpenChange={(o) => !o && setEvidenceDialog(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Evidence — {evidenceDialog?.lead_name}</DialogTitle></DialogHeader>
          {evidenceDialog?.evidence_url && (
            <div className="space-y-3">
              <div className="rounded-lg overflow-hidden border border-sidebar-border">
                <img src={evidenceDialog.evidence_url} alt="Evidence" className="w-full object-contain max-h-96" />
              </div>
              <a href={evidenceDialog.evidence_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                <ExternalLink className="w-3 h-3" /> Open full image
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
