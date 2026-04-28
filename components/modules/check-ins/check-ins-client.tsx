"use client";
import { useState, useMemo } from "react";
import { LogIn, Search, X, CheckCircle2, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { formatDateInput } from "@/lib/utils";
import type { CheckIn, Member } from "@/types";

type MemberLite = Pick<Member, "id" | "full_name" | "member_number" | "photo_url" | "status" | "plan_expiry_date"> & {
  assigned_trainer_id?: string | null;
  trainer?: { full_name: string } | null;
};

type CheckInRow = CheckIn & {
  member?: (NonNullable<CheckIn["member"]> & {
    assigned_trainer_id?: string | null;
    trainer?: { full_name: string } | null;
  }) | null;
};

interface Props {
  gymId: string | null;
  checkIns: CheckInRow[];
  members: MemberLite[];
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
}

export function CheckInsClient({ gymId, checkIns: initial, members }: Props) {
  const [checkIns, setCheckIns] = useState<CheckInRow[]>(initial);
  const [search, setSearch] = useState("");
  const [marking, setMarking] = useState<string | null>(null);

  const checkedInIds = useMemo(() => new Set(checkIns.map((c) => c.member_id)), [checkIns]);

  const matches = useMemo(() => {
    if (!search.trim()) return [] as MemberLite[];
    const q = search.toLowerCase();
    return members
      .filter((m) => m.full_name.toLowerCase().includes(q) || (m.member_number ?? "").toLowerCase().includes(q))
      .slice(0, 6);
  }, [search, members]);

  async function markCheckIn(member: MemberLite) {
    if (!gymId || checkedInIds.has(member.id)) return;
    setMarking(member.id);

    const optimistic: CheckInRow = {
      id: `tmp-${member.id}`,
      gym_id: gymId,
      member_id: member.id,
      checked_in_at: new Date().toISOString(),
      checked_out_at: null,
      check_in_method: "manual",
      notes: null,
      created_at: new Date().toISOString(),
      member: {
        full_name: member.full_name,
        photo_url: member.photo_url,
        member_number: member.member_number,
        status: member.status,
        assigned_trainer_id: member.assigned_trainer_id ?? null,
        trainer: member.trainer ?? null,
      },
    };
    setCheckIns((prev) => [optimistic, ...prev]);
    setSearch("");

    const supabase = createClient();
    const { data, error } = await supabase
      .from("pulse_check_ins")
      .insert({ gym_id: gymId, member_id: member.id, check_in_method: "manual" })
      .select("*, member:pulse_members(full_name,photo_url,member_number,status,assigned_trainer_id,trainer:pulse_staff(full_name))")
      .single();

    setMarking(null);
    if (error) {
      setCheckIns((prev) => prev.filter((c) => c.id !== optimistic.id));
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setCheckIns((prev) => [data as CheckInRow, ...prev.filter((c) => c.id !== optimistic.id)]);
    toast({ title: `${member.full_name} checked in` });
  }

  const today = formatDateInput(new Date());

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-serif font-normal tracking-tight">Check-ins</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {new Date(today).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          <span className="ml-2 text-xs text-muted-foreground/60">· PT clients only</span>
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.04] p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/25 flex items-center justify-center">
              <LogIn className="w-4 h-4 text-sky-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Today</p>
              <p className="text-2xl font-bold text-foreground">{checkIns.length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-sidebar-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">PT clients</p>
              <p className="text-2xl font-bold text-foreground">{members.length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-sidebar-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Attendance rate</p>
              <p className="text-2xl font-bold text-foreground">
                {members.length ? Math.round((checkIns.length / members.length) * 100) : 0}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Walk-in marker */}
      <div className="rounded-2xl border border-sidebar-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-sidebar-border">
          <p className="text-sm font-semibold text-foreground">Mark walk-in</p>
          <p className="text-xs text-muted-foreground mt-0.5">Search a member by name or ID, then tap to check in.</p>
        </div>
        <div className="p-4 space-y-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search member…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 pr-9" />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {matches.length > 0 && (
            <div className="rounded-lg border border-sidebar-border divide-y divide-sidebar-border/50 max-w-md">
              {matches.map((m) => {
                const already = checkedInIds.has(m.id);
                return (
                  <div key={m.id} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                      {m.full_name[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{m.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.member_number ? `#${m.member_number} · ` : ""}
                        {m.trainer?.full_name ?? "—"}
                      </p>
                    </div>
                    {already ? (
                      <span className="text-xs text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> In
                      </span>
                    ) : (
                      <Button size="sm" disabled={marking === m.id} onClick={() => markCheckIn(m)} className="h-7 text-xs gap-1">
                        <LogIn className="w-3 h-3" /> Check In
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Today's check-ins list */}
      <div className="rounded-2xl border border-sidebar-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-sidebar-border">
          <p className="text-sm font-semibold text-foreground">Today's check-ins</p>
        </div>
        {checkIns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
            <LogIn className="w-10 h-10 opacity-20" />
            <p className="text-sm">No check-ins yet today</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-sidebar-border">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Member</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">ID</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Trainer</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Time</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Method</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sidebar-border/50">
                {checkIns.map((c) => {
                  const name = c.member?.full_name ?? "—";
                  const trainerName = c.member?.trainer?.full_name;
                  return (
                    <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                            {name[0]?.toUpperCase() ?? "?"}
                          </div>
                          <p className="font-medium text-foreground">{name}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="text-xs text-muted-foreground">{c.member?.member_number ?? "—"}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                          {trainerName ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-medium text-foreground">{formatTime(c.checked_in_at)}</span>
                      </td>
                      <td className="px-4 py-3 text-right hidden md:table-cell">
                        <span className="text-xs text-muted-foreground capitalize">{c.check_in_method}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
