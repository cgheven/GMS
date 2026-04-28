"use client";
import { useMemo, useState } from "react";
import {
  Trophy, Target, Sparkles, AlertTriangle, Crown, ArrowRight, TrendingDown, TrendingUp, Calendar,
} from "lucide-react";
import type { DashboardStats, DashboardMember, Bill, TrainerStat, GoalsOverview } from "@/types";

function formatJourneyDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "2-digit" });
}

interface ExpiringMember { id: string; name: string; plan_expiry_date: string; days_left: number }

interface Props {
  data: {
    gymId: string;
    stats: DashboardStats;
    upcomingBills: Bill[];
    monthlyData: { month: string; collected: number; expenses: number }[];
    overdueMembers: DashboardMember[];
    trainerStats: TrainerStat[];
    expiringMembers: ExpiringMember[];
    goalsOverview: GoalsOverview;
  } | null;
}

export function LeaderboardClient({ data }: Props) {
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3 text-muted-foreground">
        <Trophy className="w-10 h-10 opacity-20" />
        <p className="text-sm">No team data yet.</p>
      </div>
    );
  }

  const { trainerStats, goalsOverview } = data;
  const noActivity = trainerStats.length === 0 && goalsOverview.activeCount === 0 && goalsOverview.totalAchieved === 0;

  const [trainerFilter, setTrainerFilter] = useState<string>("all");

  const visibleWins = useMemo(() => {
    const list = trainerFilter === "all"
      ? goalsOverview.recentWins
      : goalsOverview.recentWins.filter((w) => w.trainerId === trainerFilter);
    return list.slice(0, 12);
  }, [goalsOverview.recentWins, trainerFilter]);

  // Stat numbers shift when a specific trainer is selected
  const filteredStats = useMemo(() => {
    if (trainerFilter === "all") {
      return {
        active: goalsOverview.activeCount,
        wins30: goalsOverview.recentWins.length,
        total: goalsOverview.totalAchieved,
        behind: goalsOverview.behindCount,
      };
    }
    const t = goalsOverview.byTrainer.find((x) => x.id === trainerFilter);
    return {
      active: t?.activeCount ?? 0,
      wins30: t?.recentAchieved ?? 0,
      total: t?.achievedCount ?? 0,
      behind: 0, // not tracked per trainer
    };
  }, [goalsOverview, trainerFilter]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-serif font-normal tracking-tight flex items-center gap-3">
          <Trophy className="w-7 h-7 text-amber-400" /> Leaderboard
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Team performance, goal wins, and trainer rankings.</p>
      </div>

      {noActivity && (
        <div className="rounded-2xl border border-dashed border-sidebar-border bg-card/50 py-16 flex flex-col items-center gap-2 text-muted-foreground">
          <Crown className="w-10 h-10 opacity-20" />
          <p className="text-sm">No trainers or goals yet</p>
          <p className="text-xs">Assign trainers and set member goals to see rankings here</p>
        </div>
      )}

      {/* Stat strip */}
      {!noActivity && (
        <>
          {/* Trainer filter chips */}
          {goalsOverview.byTrainer.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => setTrainerFilter("all")}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors inline-flex items-center gap-1.5 ${
                  trainerFilter === "all"
                    ? "bg-primary/15 border-primary/30 text-primary"
                    : "bg-white/[0.03] border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"
                }`}>
                All trainers <span className="text-[10px] opacity-70">{goalsOverview.recentWins.length}</span>
              </button>
              {goalsOverview.byTrainer.map((t) => (
                <button key={t.id} type="button"
                  onClick={() => setTrainerFilter(trainerFilter === t.id ? "all" : t.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors inline-flex items-center gap-1.5 ${
                    trainerFilter === t.id
                      ? "bg-primary/15 border-primary/30 text-primary"
                      : "bg-white/[0.03] border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"
                  }`}>
                  {t.name} <span className="text-[10px] opacity-70">{t.recentAchieved}</span>
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon={Target}        label="Active goals"     value={filteredStats.active} />
            <StatCard icon={Trophy}        label="Wins this month"  value={filteredStats.wins30} accent="emerald" />
            <StatCard icon={Sparkles}      label="Total achieved"   value={filteredStats.total} />
            <StatCard icon={AlertTriangle} label="Behind schedule"  value={filteredStats.behind} accent={filteredStats.behind > 0 ? "rose" : undefined} />
          </div>

          {/* Recent wins gallery */}
          <div className="rounded-2xl border border-sidebar-border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-semibold text-foreground">Recent Wins</h2>
                <span className="text-[11px] text-muted-foreground">last 30 days</span>
              </div>
              {visibleWins.length > 0 && (
                <span className="text-xs text-emerald-400 font-medium">🎉 {visibleWins.length} achieved</span>
              )}
            </div>
            {visibleWins.length === 0 ? (
              <div className="py-12 flex flex-col items-center gap-2 text-muted-foreground">
                <Sparkles className="w-7 h-7 opacity-30" />
                <p className="text-sm">
                  {trainerFilter === "all" ? "No wins yet — first achievements show here" : "No wins for this trainer in the last 30 days"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {visibleWins.map((w) => {
                  const days = Math.max(1, Math.floor((new Date(w.achievedAt).getTime() - new Date(w.startDate).getTime()) / 86400000));
                  const delta = w.startValue != null ? w.finalValue - w.startValue : null;
                  const deltaText = delta != null ? `${delta > 0 ? "+" : ""}${delta.toFixed(1)} ${w.unit}` : null;
                  const TrendIcon = w.direction === "down" ? TrendingDown : TrendingUp;
                  return (
                    <div key={w.id} className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-3 hover:border-emerald-500/40 transition-colors">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-lg shrink-0">
                          🏆
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-emerald-400 truncate">{w.memberName}</p>
                          <p className="text-xs text-foreground truncate">{w.title}</p>
                        </div>
                      </div>

                      {/* Transformation: start → final */}
                      <div className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-white/[0.03] border border-white/5">
                        <div className="text-center flex-1 min-w-0">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Start</p>
                          <p className="text-sm font-bold text-foreground">
                            {w.startValue ?? "—"} <span className="text-[10px] font-normal text-muted-foreground">{w.unit}</span>
                          </p>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-emerald-400/60 shrink-0" />
                        <div className="text-center flex-1 min-w-0">
                          <p className="text-[10px] text-emerald-400 uppercase tracking-wider flex items-center justify-center gap-1">
                            <TrendIcon className="w-2.5 h-2.5" /> Final
                          </p>
                          <p className="text-sm font-bold text-emerald-400">
                            {w.finalValue} <span className="text-[10px] font-normal opacity-70">{w.unit}</span>
                          </p>
                        </div>
                        {deltaText && (
                          <>
                            <div className="w-px h-8 bg-white/10 shrink-0" />
                            <div className="text-center flex-1 min-w-0">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Change</p>
                              <p className={`text-sm font-bold ${
                                (w.direction === "down" && delta! < 0) || (w.direction === "up" && delta! > 0)
                                  ? "text-emerald-400" : "text-amber-400"
                              }`}>
                                {deltaText}
                              </p>
                            </div>
                          </>
                        )}
                      </div>

                      <div className="mt-2 px-1 space-y-1 text-[11px] text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3 shrink-0" />
                          <span className="text-foreground font-medium">{formatJourneyDate(w.startDate)}</span>
                          <ArrowRight className="w-2.5 h-2.5 opacity-60 shrink-0" />
                          <span className="text-foreground font-medium">{formatJourneyDate(w.achievedAt)}</span>
                          <span className="opacity-60">· {days} day{days !== 1 ? "s" : ""}</span>
                        </div>
                        <p className="opacity-90">
                          Coached by <span className="text-foreground font-medium">{w.trainerName}</span>
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: { icon: typeof Trophy; label: string; value: number; accent?: "emerald" | "rose" }) {
  const cls = accent === "emerald" ? "border-emerald-500/20 bg-emerald-500/[0.04]"
            : accent === "rose"    ? "border-rose-500/20 bg-rose-500/[0.04]"
            : "border-sidebar-border bg-card";
  const iconCls = accent === "emerald" ? "text-emerald-400"
                : accent === "rose"    ? "text-rose-400"
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
