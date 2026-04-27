"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Dumbbell, Wallet, TrendingDown, Banknote,
  Clock, CheckCircle2, FileWarning, Users, UserCog,
  Activity, AlertTriangle, TrendingUp, Target,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { DashboardStats, DashboardMember, Bill } from "@/types";

const ExpenseChart = dynamic(
  () => import("./expense-chart").then((m) => m.ExpenseChart),
  { ssr: false, loading: () => <div className="h-[220px] animate-pulse rounded-xl bg-white/5" /> }
);

interface Props {
  data: {
    gymId: string;
    stats: DashboardStats;
    upcomingBills: Bill[];
    monthlyData: { month: string; collected: number; expenses: number }[];
    overdueMembers: DashboardMember[];
  } | null;
}

export function DashboardClient({ data }: Props) {
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3 text-muted-foreground">
        <Dumbbell className="w-10 h-10 opacity-20" />
        <p className="text-sm">No gym data. Complete setup in Settings.</p>
      </div>
    );
  }

  const { stats, upcomingBills, monthlyData, overdueMembers } = data;

  const isProfit = stats.net_profit >= 0;

  // Progress toward monthly revenue target
  const targetProgress = stats.revenue_target > 0
    ? Math.min(100, Math.round((stats.monthly_collected / stats.revenue_target) * 100))
    : 0;

  // Collection rate for outstanding section
  const hasOutstanding = stats.monthly_outstanding > 0;

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Header ──────────────────────────────────────────── */}
      <div>
        <h1 className="text-3xl font-serif font-normal tracking-tight text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })} overview
        </p>
      </div>

      {/* ── 4 Hero KPI Cards ──────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Active Members */}
        <div className="relative rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-5 hover:border-emerald-500/50 transition-all duration-300 animate-fade-up">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active Members</p>
              <p className="mt-2 text-3xl font-bold leading-none text-emerald-400">
                {stats.active_members}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {stats.total_members} total enrolled
              </p>
            </div>
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 shrink-0">
              <Users className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
        </div>

        {/* Today's Check-ins */}
        <div className="relative rounded-2xl border border-[hsl(219_100%_50%/0.3)] bg-[hsl(219_100%_50%/0.06)] p-5 hover:border-[hsl(219_100%_50%/0.5)] transition-all animate-fade-up" style={{ animationDelay: "75ms" }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Today&apos;s Check-ins</p>
              <p className="mt-2 text-3xl font-bold leading-none text-[hsl(219_100%_50%)]">
                {stats.todays_checkins}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                members checked in today
              </p>
            </div>
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-[hsl(219_100%_50%/0.1)] border border-[hsl(219_100%_50%/0.2)] shrink-0">
              <Activity className="w-4 h-4 text-[hsl(219_100%_50%)]" />
            </div>
          </div>
        </div>

        {/* Monthly Revenue */}
        <div className="relative rounded-2xl border border-sidebar-border bg-card p-5 hover:border-[hsl(219_100%_50%/0.3)] transition-all animate-fade-up" style={{ animationDelay: "150ms" }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider truncate">Monthly Revenue</p>
              <p className="mt-2 text-2xl font-bold leading-none truncate">{formatCurrency(stats.monthly_collected)}</p>
              {stats.revenue_target > 0 && (
                <>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-[hsl(219_100%_50%)] rounded-full transition-all"
                        style={{ width: `${targetProgress}%` }}
                      />
                    </div>
                    <span className="text-xs text-[hsl(219_100%_50%)] font-semibold shrink-0">{targetProgress}%</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground truncate">
                    {formatCurrency(stats.revenue_target)} target
                  </p>
                </>
              )}
            </div>
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-[hsl(219_100%_50%/0.1)] border border-[hsl(219_100%_50%/0.2)] shrink-0">
              <Wallet className="w-4 h-4 text-[hsl(219_100%_50%)]" />
            </div>
          </div>
        </div>

        {/* Outstanding Dues */}
        <div className={`relative rounded-2xl border p-5 transition-all animate-fade-up ${hasOutstanding ? "border-rose-500/30 bg-rose-500/[0.06] hover:border-rose-500/50" : "border-sidebar-border bg-card hover:border-emerald-500/30"}`} style={{ animationDelay: "225ms" }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider truncate">Outstanding Dues</p>
              <p className={`mt-2 text-2xl font-bold leading-none truncate ${hasOutstanding ? "text-rose-400" : "text-emerald-400"}`}>
                {formatCurrency(stats.monthly_outstanding)}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {overdueMembers.length > 0
                  ? `${overdueMembers.length} member${overdueMembers.length !== 1 ? "s" : ""} with dues`
                  : "All members paid up"}
              </p>
            </div>
            <div className={`flex items-center justify-center w-9 h-9 rounded-xl shrink-0 ${hasOutstanding ? "bg-rose-500/10 border border-rose-500/20" : "bg-emerald-500/10 border border-emerald-500/20"}`}>
              <Clock className={`w-4 h-4 ${hasOutstanding ? "text-rose-400" : "text-emerald-400"}`} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Net Profit Banner ─────────────────────────────────── */}
      <div className={`rounded-2xl border p-5 flex items-center justify-between gap-4 animate-fade-up ${isProfit ? "border-emerald-500/30 bg-emerald-500/[0.06]" : "border-rose-500/30 bg-rose-500/[0.06]"}`} style={{ animationDelay: "300ms" }}>
        <div className="flex items-center gap-4">
          <div className={`flex items-center justify-center w-10 h-10 rounded-xl border shrink-0 ${isProfit ? "bg-emerald-500/10 border-emerald-500/20" : "bg-rose-500/10 border-rose-500/20"}`}>
            <Banknote className={`w-5 h-5 ${isProfit ? "text-emerald-400" : "text-rose-400"}`} />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Net Profit This Month</p>
            <p className={`text-2xl font-bold leading-none mt-1 ${isProfit ? "text-emerald-400" : "text-rose-400"}`}>
              {isProfit ? "+" : ""}{formatCurrency(stats.net_profit)}
            </p>
          </div>
        </div>
        <div className="hidden sm:grid grid-cols-3 gap-6 text-right">
          <div>
            <p className="text-xs text-muted-foreground">Revenue</p>
            <p className="text-sm font-semibold text-foreground mt-0.5">{formatCurrency(stats.monthly_revenue)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Expenses</p>
            <p className="text-sm font-semibold text-rose-400 mt-0.5">{formatCurrency(stats.monthly_expenses)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Salaries</p>
            <p className="text-sm font-semibold text-purple-400 mt-0.5">{formatCurrency(stats.monthly_salaries)}</p>
          </div>
        </div>
      </div>

      {/* ── Additional Stats Row ──────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: "Expiring This Week",
            value: String(stats.expiring_this_week),
            icon: AlertTriangle,
            color: "text-[hsl(43_100%_50%)]",
            bg: "bg-[hsl(43_100%_50%/0.1)]",
            border: "border-[hsl(43_100%_50%/0.2)]",
          },
          {
            label: "Expired Members",
            value: String(stats.expired_members),
            icon: TrendingDown,
            color: "text-rose-400",
            bg: "bg-rose-500/10",
            border: "border-rose-500/20",
          },
          {
            label: "Frozen Members",
            value: String(stats.frozen_members),
            icon: Target,
            color: "text-sky-400",
            bg: "bg-sky-500/10",
            border: "border-sky-500/20",
          },
          {
            label: "Staff Salaries",
            value: formatCurrency(stats.monthly_salaries),
            icon: UserCog,
            color: "text-purple-400",
            bg: "bg-purple-500/10",
            border: "border-purple-500/20",
          },
        ].map(({ label, value, icon: Icon, color, bg, border }, i) => (
          <div
            key={label}
            className="flex items-center gap-3 rounded-xl border border-sidebar-border bg-card/50 px-4 py-3 animate-fade-up"
            style={{ animationDelay: `${400 + i * 50}ms` }}
          >
            <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${bg} border ${border} shrink-0`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">{label}</p>
              <p className={`text-sm font-bold truncate ${color}`}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Overdue Members + Chart ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Overdue members */}
        <div className="lg:col-span-2 rounded-2xl border border-sidebar-border bg-card p-6 animate-fade-up animate-delay-300">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Overdue Payments</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Members with outstanding dues</p>
            </div>
            {overdueMembers.length > 0 && (
              <Badge variant="destructive" className="text-xs tabular-nums">{overdueMembers.length}</Badge>
            )}
          </div>

          {overdueMembers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[180px] gap-2 text-muted-foreground">
              <CheckCircle2 className="w-10 h-10 opacity-30 text-emerald-400" />
              <p className="text-sm font-medium text-emerald-400">All caught up</p>
              <p className="text-xs">No outstanding dues</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[260px] overflow-y-auto scrollbar-hide">
              {overdueMembers.map((m, i) => (
                <div
                  key={m.id}
                  className="flex items-center gap-3 rounded-xl bg-white/[0.03] border border-white/5 px-3 py-2.5 animate-fade-up"
                  style={{ animationDelay: `${300 + i * 60}ms` }}
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[hsl(219_100%_50%/0.1)] border border-[hsl(219_100%_50%/0.2)] shrink-0">
                    <span className="text-xs font-bold text-[hsl(219_100%_50%)]">{m.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.name}</p>
                    <span className={`text-xs font-medium capitalize ${m.status === "overdue" ? "text-rose-400" : "text-[hsl(43_100%_50%)]"}`}>
                      {m.status}{m.days_overdue ? ` · ${m.days_overdue}d` : ""}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-foreground">{formatCurrency(m.amount)}</p>
                    <Link href="/payments" className="text-[10px] text-[hsl(219_100%_50%)] hover:underline">
                      Record
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          {overdueMembers.length > 0 && (
            <div className="mt-4 pt-4 border-t border-sidebar-border">
              <Link href="/payments" className="text-xs text-[hsl(219_100%_50%)] hover:underline font-medium">
                View all payments →
              </Link>
            </div>
          )}
        </div>

        {/* Revenue vs Expenses Chart */}
        <div className="lg:col-span-3 rounded-2xl border border-sidebar-border bg-card p-6 animate-fade-up animate-delay-300">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Revenue vs Expenses</h2>
              <p className="text-xs text-muted-foreground mt-0.5">6-month trend</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-0.5 rounded-full bg-[hsl(219_100%_50%)] inline-block" />
                Collected
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-0.5 rounded-full bg-rose-400 inline-block" />
                Costs
              </span>
            </div>
          </div>
          <ExpenseChart data={monthlyData} />
        </div>
      </div>

      {/* ── Action Items ──────────────────────────────────────── */}
      {(stats.expiring_this_week > 0 || overdueMembers.length > 0 || stats.unpaid_bills > 0) && (
        <div className="rounded-2xl border border-sidebar-border bg-card p-6 animate-fade-up animate-delay-400">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-[hsl(219_100%_50%)]" />
            <h2 className="text-sm font-semibold text-foreground">Action Items</h2>
          </div>
          <div className="space-y-2">
            {stats.expiring_this_week > 0 && (
              <Link
                href="/members"
                className="flex items-center justify-between px-4 py-3 rounded-xl bg-[hsl(43_100%_50%/0.06)] border border-[hsl(43_100%_50%/0.2)] hover:border-[hsl(43_100%_50%/0.4)] transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-4 h-4 text-[hsl(43_100%_50%)]" />
                  <span className="text-sm font-medium">
                    <span className="font-bold text-[hsl(43_100%_50%)]">{stats.expiring_this_week}</span>
                    {" "}member{stats.expiring_this_week !== 1 ? "s" : ""} expiring this week
                  </span>
                </div>
                <span className="text-xs text-muted-foreground group-hover:text-[hsl(43_100%_50%)] transition-colors">Renew →</span>
              </Link>
            )}
            {overdueMembers.length > 0 && (
              <Link
                href="/payments"
                className="flex items-center justify-between px-4 py-3 rounded-xl bg-rose-500/[0.06] border border-rose-500/20 hover:border-rose-500/40 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-rose-400" />
                  <span className="text-sm font-medium">
                    <span className="font-bold text-rose-400">{overdueMembers.length}</span>
                    {" "}overdue payment{overdueMembers.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground group-hover:text-rose-400 transition-colors">Collect →</span>
              </Link>
            )}
            {stats.unpaid_bills > 0 && (
              <Link
                href="/bills"
                className="flex items-center justify-between px-4 py-3 rounded-xl bg-[hsl(219_100%_50%/0.06)] border border-[hsl(219_100%_50%/0.2)] hover:border-[hsl(219_100%_50%/0.4)] transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <FileWarning className="w-4 h-4 text-[hsl(219_100%_50%)]" />
                  <span className="text-sm font-medium">
                    <span className="font-bold text-[hsl(219_100%_50%)]">{stats.unpaid_bills}</span>
                    {" "}unpaid bill{stats.unpaid_bills !== 1 ? "s" : ""}{" "}
                    <span className="text-muted-foreground font-normal">({formatCurrency(stats.unpaid_bills_amount)})</span>
                  </span>
                </div>
                <span className="text-xs text-muted-foreground group-hover:text-[hsl(219_100%_50%)] transition-colors">View →</span>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* ── Upcoming / Pending Bills ──────────────────────────── */}
      {upcomingBills.length > 0 && (
        <div className="rounded-2xl border border-sidebar-border bg-card p-6 animate-fade-up animate-delay-400">
          <div className="flex items-center gap-2 mb-4">
            <FileWarning className="w-4 h-4 text-rose-400" />
            <h2 className="text-sm font-semibold text-foreground">Pending Bills</h2>
            <Badge variant="destructive" className="text-xs ml-auto">{upcomingBills.length}</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {upcomingBills.map((bill, i) => (
              <div
                key={bill.id}
                className="flex items-center gap-3 rounded-xl bg-white/[0.03] border border-white/5 px-3 py-2.5 animate-fade-up"
                style={{ animationDelay: `${400 + i * 60}ms` }}
              >
                <div className={`w-1.5 h-8 rounded-full shrink-0 ${bill.status === "overdue" ? "bg-rose-500" : "bg-[hsl(219_100%_50%)]"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{bill.title}</p>
                  <p className="text-xs text-muted-foreground">Due {formatDate(bill.due_date)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-foreground">{formatCurrency(bill.amount)}</p>
                  <p className={`text-xs font-medium capitalize ${bill.status === "overdue" ? "text-rose-400" : "text-[hsl(219_100%_50%)]"}`}>
                    {bill.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
