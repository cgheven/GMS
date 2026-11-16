"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Dumbbell, Wallet,
  AlertTriangle, Clock, CheckCircle2,
  Banknote, Users, FileWarning, Zap, Trophy, Target, HandCoins, Instagram, Scale,
} from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";
import type { DashboardStats, DashboardMember, Bill, TrainerStat, GoalsOverview } from "@/types";

const ExpenseChart = dynamic(
  () => import("./expense-chart").then((m) => m.ExpenseChart),
  { ssr: false, loading: () => <div className="h-[200px] animate-pulse rounded-xl bg-white/5" /> }
);

interface ExpiringMember { id: string; name: string; plan_expiry_date: string; days_left: number }

type ActionItem = {
  key: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  text: string;
  action: string;
  href: string;
  urgency: number;
};

interface LeadsSummary {
  open: number;
  overdue: number;
  dueToday: number;
  upcoming: { id: string; name: string; source: string }[];
  conversionRate: number;
}

interface Props {
  data: {
    gymId: string;
    stats: DashboardStats;
    upcomingBills: Bill[];
    monthlyData: { month: string; collected: number; expenses: number }[];
    overdueMembers: DashboardMember[];
    trainerStats: TrainerStat[];
    selfStat: TrainerStat | null;
    expiringMembers: ExpiringMember[];
    goalsOverview: GoalsOverview;
  } | null;
  leadsSummary?: LeadsSummary | null;
}

export function DashboardClient({ data, leadsSummary }: Props) {
  const { format } = useCurrency();
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3 text-muted-foreground">
        <Dumbbell className="w-10 h-10 opacity-20" />
        <p className="text-sm">No gym data. Complete setup in Settings.</p>
      </div>
    );
  }

  const { stats, upcomingBills, monthlyData, overdueMembers, trainerStats, selfStat, expiringMembers, goalsOverview } = data;

  const isProfit = stats.net_profit >= 0;
  const targetProgress = stats.revenue_target > 0
    ? Math.min(100, Math.round((stats.monthly_collected / stats.revenue_target) * 100))
    : 0;

  // Profit breakdown — the cost components that turn revenue into net profit.
  const profitCosts = [
    { label: "Expenses", value: stats.monthly_expenses,                  bar: "bg-rose-400",   text: "text-rose-400" },
    { label: "Salaries", value: stats.monthly_salaries,                  bar: "bg-purple-400", text: "text-purple-400" },
    { label: "Bills",    value: stats.monthly_paid_bills,                bar: "bg-orange-400", text: "text-orange-400" },
    { label: "Partner",  value: stats.paid_commissions_this_month,       bar: "bg-amber-400",  text: "text-amber-400" },
    { label: "Social",   value: stats.paid_social_commissions_this_month, bar: "bg-pink-400",   text: "text-pink-400" },
  ].filter((c) => c.value > 0);
  const breakdownDenom = Math.max(stats.monthly_collected, profitCosts.reduce((s, c) => s + c.value, 0), 1);
  const profitBarWidth = isProfit ? (stats.net_profit / breakdownDenom) * 100 : 0;
  const profitMargin = stats.monthly_collected > 0 ? Math.round((stats.net_profit / stats.monthly_collected) * 100) : 0;

  // Unified action items — sorted by urgency, capped to keep UI compact
  const ACTION_LIMIT = 12;
  const allActionItems: ActionItem[] = [
    ...expiringMembers.map((m) => ({
      key: `exp-${m.id}`,
      icon: AlertTriangle,
      color: m.days_left <= 2 ? "text-rose-400" : "text-primary",
      bg:   m.days_left <= 2 ? "bg-rose-500/10 border-rose-500/20" : "bg-primary/10 border-primary/20",
      text: `${m.name} — expires in ${m.days_left === 0 ? "today" : m.days_left === 1 ? "1 day" : `${m.days_left} days`}`,
      action: "Renew",
      href: "/members",
      urgency: m.days_left,
    })),
    ...overdueMembers.map((m) => ({
      key: `due-${m.id}`,
      icon: Clock,
      color: "text-rose-400",
      bg: "bg-rose-500/10 border-rose-500/20",
      text: `${m.name} owes ${format(m.amount)}`,
      action: "Collect",
      href: "/payments",
      urgency: 100,
    })),
    ...(() => {
      const todayMs = new Date().setHours(0, 0, 0, 0);
      const overdue: ActionItem[] = [];
      const upcoming: ActionItem[] = [];
      for (const b of upcomingBills) {
        if (b.status === "paid") continue;
        const dueMs = new Date(b.due_date).setHours(0, 0, 0, 0);
        const daysUntil = Math.round((dueMs - todayMs) / 86400000);
        if (daysUntil < 0 || b.status === "overdue") {
          overdue.push({
            key: `bill-overdue-${b.id}`,
            icon: FileWarning,
            color: "text-rose-400",
            bg: "bg-rose-500/10 border-rose-500/20",
            text: `${b.title} bill overdue — ${format(Number(b.amount) + Number(b.late_fee))}${b.late_fee > 0 ? ` (incl. ${format(b.late_fee)} late fee)` : ""}`,
            action: "View",
            href: "/bills",
            urgency: 90,
          });
        } else {
          const reminderDays = b.reminder_days ?? 5;
          if (reminderDays > 0 && daysUntil <= reminderDays) {
            upcoming.push({
              key: `bill-due-${b.id}`,
              icon: FileWarning,
              color: "text-amber-400",
              bg: "bg-amber-500/10 border-amber-500/20",
              text: `${b.title} due ${daysUntil === 0 ? "today" : `in ${daysUntil} day${daysUntil !== 1 ? "s" : ""}`} — ${format(b.amount)}`,
              action: "View",
              href: "/bills",
              urgency: 50 + daysUntil,
            });
          }
        }
      }
      return [...overdue, ...upcoming];
    })(),
  ].sort((a, b) => a.urgency - b.urgency);
  const actionItems = allActionItems.slice(0, ACTION_LIMIT);
  const hiddenCount = allActionItems.length - actionItems.length;

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-serif font-normal tracking-tight text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })} overview
        </p>
      </div>

      {/* ── Hero KPI Cards (premium grid) ────────────────────── */}
      {/* Net Profit and the 4th card span both columns on mobile so the 2-col
          mobile grid stays even; all four sit in one row from lg. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Net Profit — most prominent, full-width on mobile */}
        <div className={`col-span-2 lg:col-span-1 relative rounded-2xl border p-4 sm:p-5 transition-all duration-300 animate-fade-up ${isProfit ? "border-emerald-500/30 bg-emerald-500/[0.06] hover:border-emerald-500/50" : "border-rose-500/30 bg-rose-500/[0.06] hover:border-rose-500/50"}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Net Profit</p>
              <p className={`mt-2 text-3xl font-bold leading-none break-words ${isProfit ? "text-emerald-400" : "text-rose-400"}`}>
                {isProfit ? "+" : ""}{format(stats.net_profit)}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {stats.monthly_collected > 0
                  ? <>{isProfit ? "↑" : "↓"} <span className={`font-semibold ${isProfit ? "text-emerald-400" : "text-rose-400"}`}>{profitMargin}%</span> margin this month</>
                  : (isProfit ? "↑ Profit this month" : "↓ Loss this month")}
              </p>
            </div>
            <div className={`flex items-center justify-center w-9 h-9 rounded-xl border shrink-0 ${isProfit ? "bg-emerald-500/10 border-emerald-500/20" : "bg-rose-500/10 border-rose-500/20"}`}>
              <Banknote className={`w-4 h-4 ${isProfit ? "text-emerald-400" : "text-rose-400"}`} />
            </div>
          </div>
        </div>

        {/* Collected */}
        <div className="relative rounded-2xl border border-sidebar-border bg-card p-4 sm:p-5 hover:border-emerald-500/30 transition-all animate-fade-up" style={{ animationDelay: "75ms" }}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide leading-tight">Collected</p>
              <p className="mt-2 text-lg sm:text-2xl font-bold leading-tight break-words">{format(stats.monthly_collected)}</p>
              {stats.revenue_target > 0 ? (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${targetProgress}%` }} />
                  </div>
                  <span className="text-xs text-emerald-400 font-semibold shrink-0">{targetProgress}%</span>
                </div>
              ) : (
                <p className="mt-2 text-[10px] sm:text-xs text-muted-foreground">{stats.active_members} active members</p>
              )}
            </div>
            <div className="hidden sm:flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 shrink-0">
              <Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
            </div>
          </div>
        </div>

        {/* Outstanding */}
        <div className="relative rounded-2xl border border-sidebar-border bg-card p-4 sm:p-5 hover:border-rose-500/30 transition-all animate-fade-up" style={{ animationDelay: "150ms" }}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide leading-tight">Outstanding</p>
              <p className="mt-2 text-lg sm:text-2xl font-bold leading-tight break-words">{format(stats.monthly_outstanding)}</p>
              {overdueMembers.length > 0 ? (
                <Link href="/payments" className="group/out mt-2 flex items-center gap-1.5 text-[10px] sm:text-xs text-muted-foreground">
                  <span><span className="text-rose-400 font-semibold">{overdueMembers.length}</span> member{overdueMembers.length !== 1 ? "s" : ""} owe money</span>
                  <span className="text-rose-400 opacity-0 group-hover/out:opacity-100 transition-opacity">→</span>
                </Link>
              ) : (
                <p className="mt-2 text-[10px] sm:text-xs text-emerald-400 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> All caught up
                </p>
              )}
            </div>
            <div className="hidden sm:flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 shrink-0">
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400" />
            </div>
          </div>
        </div>

        {/* Active Members — full-width on mobile, same as Net Profit */}
        <div className="col-span-2 lg:col-span-1 relative rounded-2xl border border-sidebar-border bg-card p-4 sm:p-5 hover:border-blue-500/30 transition-all animate-fade-up" style={{ animationDelay: "225ms" }}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide leading-tight">Active Members</p>
              <p className="mt-2 text-lg sm:text-2xl font-bold leading-none">{stats.active_members.toLocaleString()}</p>
              <p className="mt-2 text-[10px] sm:text-xs text-muted-foreground">
                {stats.todays_checkins > 0
                  ? `${stats.todays_checkins.toLocaleString()} checked in today`
                  : `${stats.total_members.toLocaleString()} total members`}
              </p>
            </div>
            <div className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 shrink-0">
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Profit Breakdown ─────────────────────────────────── */}
      {stats.monthly_collected > 0 && (
        <div className="rounded-2xl border border-sidebar-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <Scale className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Profit Breakdown</p>
                <p className="text-xs text-muted-foreground">Where this month&apos;s revenue went</p>
              </div>
            </div>
            <div className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 ${isProfit ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
              {profitMargin}% margin
            </div>
          </div>

          {/* Proportional bar — costs eat into revenue, the remainder is profit */}
          <div className="flex h-2.5 w-full rounded-full overflow-hidden bg-white/5">
            {profitCosts.map((c) => (
              <div key={c.label} className={c.bar} style={{ width: `${(c.value / breakdownDenom) * 100}%` }} title={`${c.label} ${format(c.value)}`} />
            ))}
            {profitBarWidth > 0 && (
              <div className="bg-emerald-400" style={{ width: `${profitBarWidth}%` }} title={`Net profit ${format(stats.net_profit)}`} />
            )}
          </div>

          {/* Legend — reads like a P&L line */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 shrink-0" />
              <span className="text-muted-foreground">Revenue</span>
              <span className="font-semibold text-emerald-400">{format(stats.monthly_collected)}</span>
            </div>
            {profitCosts.map((c) => (
              <div key={c.label} className="flex items-center gap-2">
                <span className="text-muted-foreground">−</span>
                <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${c.bar}`} />
                <span className="text-muted-foreground">{c.label}</span>
                <span className={`font-semibold ${c.text}`}>{format(c.value)}</span>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">=</span>
              <span className="text-muted-foreground">Net Profit</span>
              <span className={`font-semibold ${isProfit ? "text-emerald-400" : "text-rose-400"}`}>{isProfit ? "+" : ""}{format(stats.net_profit)}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Pending Payouts (partner / social) ───────────────── */}
      {(stats.pending_commissions_count > 0 || stats.pending_social_commissions_count > 0) && (
        <div className={`grid grid-cols-1 gap-4 ${stats.pending_commissions_count > 0 && stats.pending_social_commissions_count > 0 ? "sm:grid-cols-2" : ""}`}>
          {stats.pending_commissions_count > 0 && (
            <Link href="/referrers" className="group/pay relative rounded-2xl border border-amber-500/25 bg-amber-500/[0.05] p-4 sm:p-5 hover:border-amber-500/45 transition-all">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide leading-tight">Partner Payouts</p>
                  <p className="mt-2 text-lg sm:text-2xl font-bold leading-tight break-words text-amber-400">{format(stats.pending_commissions_amount)}</p>
                  <p className="mt-2 text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1.5">
                    <span><span className="text-amber-400 font-semibold">{stats.pending_commissions_count}</span> pending payout{stats.pending_commissions_count !== 1 ? "s" : ""}</span>
                    <span className="text-amber-400 opacity-0 group-hover/pay:opacity-100 transition-opacity">→</span>
                  </p>
                </div>
                <div className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 shrink-0">
                  <HandCoins className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
                </div>
              </div>
            </Link>
          )}
          {stats.pending_social_commissions_count > 0 && (
            <Link href="/social-media" className="group/pay relative rounded-2xl border border-pink-500/25 bg-pink-500/[0.05] p-4 sm:p-5 hover:border-pink-500/45 transition-all">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide leading-tight">Social Payouts</p>
                  <p className="mt-2 text-lg sm:text-2xl font-bold leading-tight break-words text-pink-400">{format(stats.pending_social_commissions_amount)}</p>
                  <p className="mt-2 text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1.5">
                    <span><span className="text-pink-400 font-semibold">{stats.pending_social_commissions_count}</span> pending payout{stats.pending_social_commissions_count !== 1 ? "s" : ""}</span>
                    <span className="text-pink-400 opacity-0 group-hover/pay:opacity-100 transition-opacity">→</span>
                  </p>
                </div>
                <div className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-pink-500/10 border border-pink-500/20 shrink-0">
                  <Instagram className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-pink-400" />
                </div>
              </div>
            </Link>
          )}
        </div>
      )}

      {/* ── Leads strip ──────────────────────────────────────── */}
      {leadsSummary && (leadsSummary.open > 0 || leadsSummary.dueToday > 0 || leadsSummary.overdue > 0) && (
        <Link href="/leads"
          className={`flex items-center gap-3 rounded-2xl border p-4 transition-colors group ${
            leadsSummary.overdue > 0
              ? "border-rose-500/20 bg-rose-500/[0.04] hover:bg-rose-500/[0.08]"
              : leadsSummary.dueToday > 0
              ? "border-amber-500/20 bg-amber-500/[0.04] hover:bg-amber-500/[0.08]"
              : "border-primary/20 bg-primary/[0.04] hover:bg-primary/[0.08]"
          }`}>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            leadsSummary.overdue > 0
              ? "bg-rose-500/15 border border-rose-500/25"
              : leadsSummary.dueToday > 0
              ? "bg-amber-500/15 border border-amber-500/25"
              : "bg-primary/15 border border-primary/25"
          }`}>
            <Target className={`w-4 h-4 ${
              leadsSummary.overdue > 0 ? "text-rose-400" :
              leadsSummary.dueToday > 0 ? "text-amber-400" : "text-primary"
            }`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Leads & Follow-ups</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              <span className="text-primary">{leadsSummary.open} open</span>
              {leadsSummary.dueToday > 0 && <>
                <span className="opacity-50"> · </span>
                <span className="text-amber-400">{leadsSummary.dueToday} due today</span>
              </>}
              {leadsSummary.overdue > 0 && <>
                <span className="opacity-50"> · </span>
                <span className="text-rose-400">⚠ {leadsSummary.overdue} overdue</span>
              </>}
              {leadsSummary.upcoming.length > 0 && <>
                <span className="opacity-50"> · </span>
                <span>Today: {leadsSummary.upcoming.map((u) => u.name).join(", ")}</span>
              </>}
              <span className="opacity-50"> · </span>
              <span>{leadsSummary.conversionRate}% conversion</span>
            </p>
          </div>
          <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors shrink-0">View →</span>
        </Link>
      )}

      {/* ── Compact: Leaderboard hint strip ─────────────────── */}
      {(trainerStats.length > 0 || goalsOverview.activeCount > 0 || goalsOverview.recentWins.length > 0) && (
        <Link href="/leaderboard"
          className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/[0.04] p-4 hover:bg-primary/[0.08] hover:border-primary/30 transition-colors group">
          <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
            <Trophy className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Team Leaderboard</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {trainerStats.length} trainer{trainerStats.length !== 1 ? "s" : ""}
              <span className="opacity-50"> · </span>
              <span className="text-primary">{goalsOverview.activeCount} active goals</span>
              {goalsOverview.achievedThisMonth > 0 && <>
                <span className="opacity-50"> · </span>
                <span className="text-emerald-400">🎉 {goalsOverview.achievedThisMonth} wins this month</span>
              </>}
              {goalsOverview.behindCount > 0 && <>
                <span className="opacity-50"> · </span>
                <span className="text-rose-400">{goalsOverview.behindCount} behind</span>
              </>}
            </p>
          </div>
          <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors shrink-0">View →</span>
        </Link>
      )}

      {/* ── Collection Performance ──────────────────────────── */}
      {(trainerStats.length > 0 || selfStat) && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Dumbbell className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Collection Performance</h2>
              <span className="text-xs text-muted-foreground">— {new Date().toLocaleDateString("en-US", { month: "long" })}</span>
            </div>
            <Link href="/trainers" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Manage →</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {[...trainerStats, ...(selfStat ? [selfStat] : [])].map((t) => {
              const rateColor = t.rate >= 80 ? "text-emerald-400" : t.rate >= 50 ? "text-primary" : "text-rose-400";
              const barColor  = t.rate >= 80 ? "bg-emerald-400"   : t.rate >= 50 ? "bg-primary"   : "bg-rose-400";
              const isSelf    = t.id === "__self__";
              return (
                <div key={t.id} className="rounded-2xl border border-sidebar-border bg-card p-4 space-y-3 hover:border-primary/20 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full border flex items-center justify-center text-sm font-bold shrink-0 ${isSelf ? "bg-white/10 border-white/20 text-muted-foreground" : "bg-primary/15 border-primary/25 text-primary"}`}>
                      {isSelf ? "S" : t.name[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold text-foreground truncate">{t.name}</p>
                        {isSelf && <span className="text-[10px] text-muted-foreground border border-sidebar-border rounded px-1 py-0.5 shrink-0">No Trainer</span>}
                      </div>
                      <p className="text-xs text-muted-foreground">{t.total} member{t.total !== 1 ? "s" : ""}</p>
                    </div>
                    <span className={`text-lg font-bold tabular-nums shrink-0 ${rateColor}`}>{t.rate}%</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{t.paid} paid</span>
                      <span>{t.unpaid} unpaid</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${t.rate}%` }} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-sidebar-border/60">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Collected</p>
                      <p className="text-sm font-bold text-emerald-400">{format(t.collected)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Due</p>
                      <p className="text-sm font-bold text-foreground">{format(t.totalDue)}</p>
                    </div>
                  </div>
                  {t.unpaid > 0 && (
                    <Link href="/payments" className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-rose-500/[0.08] border border-rose-500/15 hover:border-rose-500/30 transition-colors group">
                      <span className="text-xs text-rose-400 font-medium">{t.unpaid} haven&apos;t paid</span>
                      <span className="text-[10px] text-muted-foreground group-hover:text-rose-400 transition-colors">Collect →</span>
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Section 3: Chart ────────────────────────────────── */}
      <div className="rounded-2xl border border-sidebar-border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Revenue vs Costs</h2>
            <p className="text-xs text-muted-foreground mt-0.5">6-month trend</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-0.5 rounded-full bg-emerald-400 inline-block" />Collected</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-0.5 rounded-full bg-rose-400 inline-block" />Costs</span>
          </div>
        </div>
        <ExpenseChart data={monthlyData} />
      </div>

      {/* ── Section 4: Unified Action List ──────────────────── */}
      {actionItems.length > 0 && (
        <div className="rounded-2xl border border-sidebar-border bg-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Needs Attention</h2>
            <span className="ml-auto text-xs font-semibold text-primary bg-primary/10 border border-primary/20 rounded-full px-2 py-0.5">
              {allActionItems.length}
            </span>
          </div>
          <div className="space-y-1.5">
            {actionItems.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors group ${item.bg} hover:opacity-90`}
              >
                <item.icon className={`w-4 h-4 shrink-0 ${item.color}`} />
                <span className="text-sm text-foreground flex-1 min-w-0 truncate">{item.text}</span>
                <span className={`text-xs font-medium shrink-0 ${item.color} opacity-60 group-hover:opacity-100 transition-opacity`}>
                  {item.action} →
                </span>
              </Link>
            ))}
          </div>
          {hiddenCount > 0 && (
            <Link href="/payments"
              className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors pt-1">
              +{hiddenCount} more {hiddenCount === 1 ? "item" : "items"} — view all →
            </Link>
          )}
        </div>
      )}

    </div>
  );
}
