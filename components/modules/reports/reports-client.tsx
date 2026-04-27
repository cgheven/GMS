"use client";
import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  BarChart3, TrendingUp, TrendingDown, Users,
  AlertTriangle, Banknote, Activity,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { RevenueMonth, AgingBucket } from "@/types";

const RevenueChart = dynamic(() => import("./revenue-chart").then((m) => m.RevenueChart), {
  ssr: false, loading: () => <div className="h-[260px] animate-pulse bg-white/5 rounded-xl" />,
});
const ExpenseBreakdownChart = dynamic(() => import("./expense-breakdown-chart").then((m) => m.ExpenseBreakdownChart), {
  ssr: false, loading: () => <div className="h-[200px] animate-pulse bg-white/5 rounded-xl" />,
});

interface Props {
  data: {
    gymId: string;
    revenueByMonth: RevenueMonth[];
    aging: { d30: AgingBucket; d60: AgingBucket; d90: AgingBucket; d90plus: AgingBucket };
    totalCapacity?: number;
  } | null;
}

export function ReportsClient({ data }: Props) {
  const [period, setPeriod] = useState<3 | 6 | 12>(6);

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-2 text-muted-foreground">
        <BarChart3 className="w-10 h-10 opacity-20" />
        <p className="text-sm">No data available. Add members and payments to see reports.</p>
      </div>
    );
  }

  const { revenueByMonth, aging } = data;
  const months = useMemo(() => revenueByMonth.slice(-period), [revenueByMonth, period]);

  // ── KPIs ───────────────────────────────────────────────
  const totalCollected  = useMemo(() => months.reduce((s, m) => s + m.collected, 0), [months]);
  const totalExpenses   = useMemo(() => months.reduce((s, m) => s + m.expenses, 0), [months]);
  const totalProfit     = useMemo(() => months.reduce((s, m) => s + m.profit, 0), [months]);
  const totalSalaries   = useMemo(() => months.reduce((s, m) => s + m.salaries, 0), [months]);
  const totalOperating  = totalExpenses - totalSalaries;
  const totalNewMembers       = useMemo(() => months.reduce((s, m) => s + m.newMembers, 0), [months]);
  const totalCancelledMembers = useMemo(() => months.reduce((s, m) => s + m.cancelledMembers, 0), [months]);
  const profitMargin    = totalCollected > 0 ? Math.round((totalProfit / totalCollected) * 100) : 0;
  const avgMonthly      = months.length > 0 ? Math.round(totalCollected / months.length) : 0;
  const avgCollectionRate = useMemo(() => {
    const withDue = months.filter((m) => m.due > 0);
    return withDue.length > 0 ? Math.round(withDue.reduce((s, m) => s + m.collectionRate, 0) / withDue.length) : 0;
  }, [months]);

  const bestMonth  = useMemo(() => months.length > 1 ? months.reduce((b, m) => m.profit > b.profit ? m : b, months[0]) : null, [months]);
  const worstMonth = useMemo(() => months.length > 1 ? months.reduce((w, m) => m.profit < w.profit ? m : w, months[0]) : null, [months]);
  const maxCollected = useMemo(() => Math.max(...months.map((m) => m.collected), 1), [months]);

  const agingRows = [
    { label: "0–30 days",  bucket: aging.d30,     color: "bg-yellow-400",   text: "text-yellow-400" },
    { label: "31–60 days", bucket: aging.d60,     color: "bg-orange-400",   text: "text-orange-400" },
    { label: "61–90 days", bucket: aging.d90,     color: "bg-rose-400",     text: "text-rose-400" },
    { label: "90+ days",   bucket: aging.d90plus, color: "bg-rose-600",     text: "text-rose-600" },
  ];
  const totalAgingCount  = agingRows.reduce((s, r) => s + r.bucket.count, 0);
  const totalAgingAmount = agingRows.reduce((s, r) => s + r.bucket.amount, 0);

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Header ───────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-normal tracking-tight">Reports</h1>
          <p className="text-muted-foreground text-sm mt-1">Financial and member analytics</p>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-sidebar-border bg-card p-1 self-start sm:self-auto">
          {([3, 6, 12] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                period === p ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p}M
            </button>
          ))}
        </div>
      </div>

      {/* ── 4 KPI hero cards ─────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Collected */}
        <div className="rounded-2xl border border-sidebar-border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Collected</p>
            <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-primary" />
            </div>
          </div>
          <p className="text-3xl font-bold leading-none">{formatCurrency(totalCollected)}</p>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Collection rate</span>
              <span className="text-primary font-semibold">{avgCollectionRate}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: `${avgCollectionRate}%` }} />
            </div>
          </div>
        </div>

        {/* Expenses */}
        <div className="rounded-2xl border border-sidebar-border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Expenses</p>
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-rose-400" />
            </div>
          </div>
          <p className="text-3xl font-bold leading-none">{formatCurrency(totalExpenses)}</p>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Ops <span className="text-rose-400 font-semibold">{formatCurrency(totalOperating)}</span></span>
            <span>·</span>
            <span>Sal <span className="text-purple-400 font-semibold">{formatCurrency(totalSalaries)}</span></span>
          </div>
        </div>

        {/* Net Profit */}
        <div className={`rounded-2xl border p-5 space-y-3 ${totalProfit >= 0 ? "border-emerald-500/25 bg-emerald-500/[0.05]" : "border-rose-500/25 bg-rose-500/[0.05]"}`}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Net Profit</p>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${totalProfit >= 0 ? "bg-emerald-500/10 border-emerald-500/20" : "bg-rose-500/10 border-rose-500/20"}`}>
              {totalProfit >= 0
                ? <TrendingUp className="w-4 h-4 text-emerald-400" />
                : <TrendingDown className="w-4 h-4 text-rose-400" />}
            </div>
          </div>
          <p className={`text-3xl font-bold leading-none ${totalProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {totalProfit >= 0 ? "+" : ""}{formatCurrency(totalProfit)}
          </p>
          <p className={`text-xs font-semibold ${totalProfit >= 0 ? "text-emerald-400/70" : "text-rose-400/70"}`}>
            {profitMargin >= 0 ? "+" : ""}{profitMargin}% margin
          </p>
        </div>

        {/* Avg / Month */}
        <div className="rounded-2xl border border-sidebar-border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Avg / Month</p>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <Activity className="w-4 h-4 text-purple-400" />
            </div>
          </div>
          <p className="text-3xl font-bold leading-none">{formatCurrency(avgMonthly)}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {bestMonth && (
              <span className="text-emerald-400 font-medium">↑ {bestMonth.month}</span>
            )}
            {worstMonth && worstMonth.monthKey !== bestMonth?.monthKey && (
              <span className="text-rose-400 font-medium">↓ {worstMonth.month}</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Revenue chart (full width) ────────────────────── */}
      <div className="rounded-2xl border border-sidebar-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold">Revenue vs Expenses</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Collected fees vs total costs — {period} months</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 rounded-full bg-primary inline-block" />Collected</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 rounded-full bg-rose-400 inline-block" />Expenses</span>
          </div>
        </div>
        <RevenueChart data={months} />
      </div>

      {/* ── P&L Table ────────────────────────────────────── */}
      <div className="rounded-2xl border border-sidebar-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-sidebar-border">
          <div>
            <h2 className="text-sm font-semibold">Monthly P&amp;L</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Last {period} months breakdown</p>
          </div>
          {(bestMonth || worstMonth) && (
            <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
              {bestMonth && <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500/50" />{bestMonth.month} best</span>}
              {worstMonth && worstMonth.monthKey !== bestMonth?.monthKey && <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500/50" />{worstMonth.month} worst</span>}
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-sidebar-border">
                <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Month</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Collected</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Operating</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Salaries</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Members</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Net Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sidebar-border/50">
              {months.map((m) => {
                const isBest  = bestMonth?.monthKey === m.monthKey;
                const isWorst = worstMonth?.monthKey === m.monthKey && worstMonth.monthKey !== bestMonth?.monthKey;
                const barPct  = Math.round((m.collected / maxCollected) * 100);
                return (
                  <tr key={m.monthKey} className={`transition-colors ${isBest ? "bg-emerald-500/[0.04]" : isWorst ? "bg-rose-500/[0.04]" : "hover:bg-white/[0.02]"}`}>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="text-muted-foreground font-medium">{m.month}</span>
                        {isBest  && <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">Best</span>}
                        {isWorst && <span className="text-[10px] font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded-full">Worst</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <div className="hidden sm:block w-20 h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div className="h-full bg-primary/50 rounded-full" style={{ width: `${barPct}%` }} />
                        </div>
                        <span className="text-primary font-semibold tabular-nums">{formatCurrency(m.collected)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-rose-400 tabular-nums hidden md:table-cell">{formatCurrency(Math.max(0, m.expenses - m.salaries))}</td>
                    <td className="px-4 py-3 text-right text-purple-400 tabular-nums hidden md:table-cell">{formatCurrency(m.salaries)}</td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell">
                      <div className="flex items-center justify-end gap-2 text-xs">
                        {m.newMembers > 0 && <span className="text-emerald-400 font-medium">+{m.newMembers}</span>}
                        {m.cancelledMembers > 0 && <span className="text-rose-400 font-medium">-{m.cancelledMembers}</span>}
                        {m.newMembers === 0 && m.cancelledMembers === 0 && <span className="text-muted-foreground">—</span>}
                      </div>
                    </td>
                    <td className={`px-6 py-3 text-right font-bold tabular-nums ${m.profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {m.profit >= 0 ? "+" : ""}{formatCurrency(m.profit)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-sidebar-border">
                <td className="px-6 py-3 text-sm font-semibold text-muted-foreground">Total</td>
                <td className="px-4 py-3 text-right font-bold text-primary tabular-nums">{formatCurrency(totalCollected)}</td>
                <td className="px-4 py-3 text-right font-bold text-rose-400 tabular-nums hidden md:table-cell">{formatCurrency(totalOperating)}</td>
                <td className="px-4 py-3 text-right font-bold text-purple-400 tabular-nums hidden md:table-cell">{formatCurrency(totalSalaries)}</td>
                <td className="px-4 py-3 text-right hidden sm:table-cell">
                  <div className="flex items-center justify-end gap-2 text-xs font-semibold">
                    {totalNewMembers > 0 && <span className="text-emerald-400">+{totalNewMembers}</span>}
                    {totalCancelledMembers > 0 && <span className="text-rose-400">-{totalCancelledMembers}</span>}
                  </div>
                </td>
                <td className={`px-6 py-3 text-right font-bold tabular-nums ${totalProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {totalProfit >= 0 ? "+" : ""}{formatCurrency(totalProfit)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── Expense breakdown + Overdue Aging ────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Expense Breakdown chart */}
        <div className="rounded-2xl border border-sidebar-border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold">Expense Breakdown</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Operating vs salaries per month</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-rose-400 inline-block" />Operating</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-purple-400 inline-block" />Salaries</span>
            </div>
          </div>
          <ExpenseBreakdownChart data={months} />
        </div>

        {/* Overdue Aging */}
        <div className="rounded-2xl border border-sidebar-border bg-card p-6">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <h2 className="text-sm font-semibold">Overdue Aging</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-5">Pending payments by age bucket</p>
          {totalAgingCount === 0 ? (
            <div className="flex flex-col items-center justify-center h-[160px] gap-2 text-emerald-400">
              <TrendingUp className="w-8 h-8 opacity-40" />
              <p className="text-sm font-medium">No overdue payments</p>
            </div>
          ) : (
            <div className="space-y-4">
              {agingRows.map(({ label, bucket, color, text }) => {
                const pct = totalAgingCount > 0 ? Math.round((bucket.count / totalAgingCount) * 100) : 0;
                return (
                  <div key={label} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${color}`} />
                        <span className="text-muted-foreground">{label}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`font-semibold ${text}`}>{bucket.count} member{bucket.count !== 1 ? "s" : ""}</span>
                        <span className="text-foreground font-semibold w-24 text-right tabular-nums">{formatCurrency(bucket.amount)}</span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              <div className="pt-2 border-t border-sidebar-border flex items-center justify-between text-xs font-semibold">
                <span className="text-muted-foreground">Total overdue</span>
                <div className="flex items-center gap-3">
                  <span className="text-rose-400">{totalAgingCount} members</span>
                  <span className="text-rose-400 w-24 text-right tabular-nums">{formatCurrency(totalAgingAmount)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
