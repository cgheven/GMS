"use client";
import { useState, useMemo, useCallback } from "react";
import {
  UserCheck, LogOut, Plus, RefreshCw, Sun, Sunset, Moon,
  Clock, QrCode, Smartphone, User,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { formatDateInput } from "@/lib/utils";
import { useGymContext } from "@/contexts/gym-context";
import type { CheckIn, Member, CheckInMethod } from "@/types";

type MemberRow = Pick<Member, "id" | "full_name" | "member_number" | "photo_url" | "status" | "plan_expiry_date">;

interface Props {
  gymId: string | null;
  checkIns: CheckIn[];
  members: MemberRow[];
}

const methodConfig: Record<CheckInMethod, { label: string; color: string; icon: React.ElementType }> = {
  manual: { label: "Manual", color: "bg-white/10 text-muted-foreground border-white/10",  icon: User },
  qr:     { label: "QR",     color: "bg-primary/10 text-primary border-primary/20",       icon: QrCode },
  app:    { label: "App",    color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: Smartphone },
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function formatDuration(checkIn: string, checkOut: string | null): string {
  if (!checkOut) return "—";
  const mins = Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function MemberAvatar({ member }: { member: CheckIn["member"] }) {
  if (member?.photo_url) {
    return (
      <img
        src={member.photo_url}
        alt={member.full_name}
        className="w-8 h-8 rounded-full object-cover shrink-0"
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
      />
    );
  }
  return (
    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
      {getInitials(member?.full_name ?? "?")}
    </div>
  );
}

export function CheckInsClient({ gymId: initialGymId, checkIns: initialCheckIns, members }: Props) {
  const { gymId: ctxGymId } = useGymContext();
  const gymId = ctxGymId ?? initialGymId;

  const [checkIns, setCheckIns] = useState<CheckIn[]>(initialCheckIns);
  const [selectedDate, setSelectedDate] = useState(formatDateInput(new Date()));
  const [loading, setLoading] = useState(false);

  // Check-in dialog
  const [checkInDialog, setCheckInDialog] = useState(false);
  const [checkInForm, setCheckInForm] = useState({ member_id: "", method: "manual" as CheckInMethod });
  const [saving, setSaving] = useState(false);

  const memberMap = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m])), [members]);

  const loadCheckIns = useCallback(async (date: string) => {
    if (!gymId) return;
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("pulse_check_ins")
      .select("*, member:pulse_members(full_name,photo_url,member_number,status)")
      .eq("gym_id", gymId)
      .gte("checked_in_at", `${date}T00:00:00`)
      .lte("checked_in_at", `${date}T23:59:59`)
      .order("checked_in_at", { ascending: false });
    if (error) {
      toast({ title: "Failed to load check-ins", description: error.message, variant: "destructive" });
    } else {
      setCheckIns((data ?? []) as CheckIn[]);
    }
    setLoading(false);
  }, [gymId]);

  async function handleDateChange(date: string) {
    setSelectedDate(date);
    await loadCheckIns(date);
  }

  async function handleCheckIn() {
    if (!gymId || !checkInForm.member_id) {
      toast({ title: "Please select a member", variant: "destructive" });
      return;
    }
    // Check if member is already checked in today without checkout
    const alreadyIn = checkIns.find(
      (c) => c.member_id === checkInForm.member_id && !c.checked_out_at
    );
    if (alreadyIn) {
      toast({ title: "Member already checked in", description: "Check them out first", variant: "destructive" });
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("pulse_check_ins").insert({
      gym_id: gymId,
      member_id: checkInForm.member_id,
      checked_in_at: new Date().toISOString(),
      check_in_method: checkInForm.method,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Checked in successfully" });
      setCheckInDialog(false);
      setCheckInForm({ member_id: "", method: "manual" });
      await loadCheckIns(selectedDate);
    }
    setSaving(false);
  }

  async function handleCheckOut(checkIn: CheckIn) {
    const supabase = createClient();
    const { error } = await supabase
      .from("pulse_check_ins")
      .update({ checked_out_at: new Date().toISOString() })
      .eq("id", checkIn.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      // Optimistic update
      setCheckIns((prev) =>
        prev.map((c) => c.id === checkIn.id ? { ...c, checked_out_at: new Date().toISOString() } : c)
      );
      toast({ title: "Checked out" });
    }
  }

  const stats = useMemo(() => {
    const total = checkIns.length;
    const morning = checkIns.filter((c) => new Date(c.checked_in_at).getHours() < 12).length;
    const afternoon = checkIns.filter((c) => {
      const h = new Date(c.checked_in_at).getHours();
      return h >= 12 && h < 17;
    }).length;
    const evening = checkIns.filter((c) => new Date(c.checked_in_at).getHours() >= 17).length;
    return { total, morning, afternoon, evening };
  }, [checkIns]);

  const isToday = selectedDate === formatDateInput(new Date());

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-normal tracking-tight">Check-Ins</h1>
          <p className="text-muted-foreground text-sm mt-1">Attendance &amp; member access tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => handleDateChange(e.target.value)}
            className="w-auto"
          />
          <Button onClick={() => loadCheckIns(selectedDate)} disabled={loading} variant="ghost" size="icon" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button
            onClick={() => { setCheckInForm({ member_id: "", method: "manual" }); setCheckInDialog(true); }}
            className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Plus className="w-4 h-4" /> Check In
          </Button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: isToday ? "Today's Total" : "Total",  value: stats.total,     icon: UserCheck, color: "text-primary",     bg: "bg-primary/10 border-primary/20" },
          { label: "Morning (before 12pm)",              value: stats.morning,   icon: Sun,       color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/20" },
          { label: "Afternoon (12–5pm)",                 value: stats.afternoon, icon: Sunset,    color: "text-orange-400",  bg: "bg-orange-500/10 border-orange-500/20" },
          { label: "Evening (after 5pm)",                value: stats.evening,   icon: Moon,      color: "text-indigo-400",  bg: "bg-indigo-500/10 border-indigo-500/20" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="rounded-2xl border border-sidebar-border bg-card p-5">
            <div className="flex items-center gap-3">
              <div className={`flex items-center justify-center w-9 h-9 rounded-xl border ${bg} shrink-0`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold text-foreground leading-none mt-0.5">{value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Check-ins Table */}
      <div className="rounded-2xl border border-sidebar-border bg-card overflow-hidden">
        {checkIns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
            <UserCheck className="w-10 h-10 opacity-20" />
            <p className="text-sm">No check-ins for {isToday ? "today" : selectedDate}</p>
            {isToday && (
              <Button
                size="sm" variant="outline"
                className="mt-2 gap-2 border-primary/30 text-primary hover:bg-primary/10"
                onClick={() => setCheckInDialog(true)}
              >
                <Plus className="w-3.5 h-3.5" /> Check In First Member
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="hidden sm:grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto_auto] gap-x-4 px-4 py-2.5 border-b border-white/5 text-xs text-muted-foreground font-medium">
              <span className="w-8" />
              <span>Member</span>
              <span className="w-20 text-center">Time In</span>
              <span className="w-20 text-center">Time Out</span>
              <span className="w-16 text-center">Duration</span>
              <span className="w-16 text-center">Method</span>
              <span className="w-20 text-right">Actions</span>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {checkIns.map((c) => {
                const method = methodConfig[c.check_in_method];
                const MethodIcon = method.icon;
                return (
                  <div
                    key={c.id}
                    className="flex sm:grid sm:grid-cols-[auto_1fr_auto_auto_auto_auto_auto] items-center gap-3 sm:gap-x-4 px-4 py-3 hover:bg-white/[0.02] transition-colors"
                  >
                    {/* Avatar */}
                    <MemberAvatar member={c.member} />

                    {/* Name + member# */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{c.member?.full_name ?? "—"}</p>
                      {c.member?.member_number && (
                        <p className="text-xs text-muted-foreground font-mono">{c.member.member_number}</p>
                      )}
                    </div>

                    {/* Time In */}
                    <div className="w-20 text-center">
                      <p className="text-xs text-foreground font-medium">{formatTime(c.checked_in_at)}</p>
                    </div>

                    {/* Time Out */}
                    <div className="w-20 text-center">
                      <p className="text-xs text-muted-foreground">
                        {c.checked_out_at ? formatTime(c.checked_out_at) : <span className="text-emerald-400">Active</span>}
                      </p>
                    </div>

                    {/* Duration */}
                    <div className="w-16 text-center">
                      <p className="text-xs text-muted-foreground">{formatDuration(c.checked_in_at, c.checked_out_at)}</p>
                    </div>

                    {/* Method badge */}
                    <div className="w-16 flex justify-center">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${method.color}`}>
                        <MethodIcon className="w-3 h-3" />
                        <span className="hidden sm:inline">{method.label}</span>
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="w-20 flex justify-end">
                      {!c.checked_out_at && (
                        <Button
                          variant="ghost" size="sm"
                          className="h-7 text-xs gap-1 text-rose-400 hover:bg-rose-500/10 border border-rose-500/20"
                          onClick={() => handleCheckOut(c)}
                        >
                          <LogOut className="w-3 h-3" /> Out
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Check In Dialog */}
      <Dialog open={checkInDialog} onOpenChange={(o) => !o && setCheckInDialog(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Check In Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Member *</Label>
              <Select value={checkInForm.member_id} onValueChange={(v) => setCheckInForm({ ...checkInForm, member_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select active member" /></SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      <span className="flex items-center gap-2">
                        <span>{m.full_name}</span>
                        {m.member_number && <span className="text-xs text-muted-foreground font-mono">#{m.member_number}</span>}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Check-In Method</Label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.entries(methodConfig) as [CheckInMethod, typeof methodConfig[CheckInMethod]][]).map(([key, cfg]) => {
                  const Icon = cfg.icon;
                  const active = checkInForm.method === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setCheckInForm({ ...checkInForm, method: key })}
                      className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all text-xs font-medium
                        ${active ? "border-primary bg-primary/10 text-primary" : "border-white/10 bg-white/5 text-muted-foreground hover:border-white/20"}`}
                    >
                      <Icon className="w-4 h-4" />
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckInDialog(false)}>Cancel</Button>
            <Button onClick={handleCheckIn} disabled={saving} className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
              <UserCheck className="w-4 h-4" />
              {saving ? "Checking in…" : "Check In"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
