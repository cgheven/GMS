"use client";
import { useMemo } from "react";
import { Users, Clock, CheckCircle2, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Referrer, Referral } from "@/types";

interface Props {
  referrer: Referrer & { gym?: { name: string } | null };
  referrals: (Referral & { member?: { full_name: string; phone: string | null; join_date: string } | null })[];
}

export function ReferrerClient({ referrer, referrals }: Props) {
  const stats = useMemo(() => {
    const total = referrals.length;
    const pending = referrals.filter((r) => r.status === "pending").reduce((s, r) => s + r.commission_amount, 0);
    const paid = referrals.filter((r) => r.status === "paid").reduce((s, r) => s + r.commission_amount, 0);
    return { total, pending, paid, totalEarned: pending + paid };
  }, [referrals]);

  const commissionLabel = referrer.commission_type === "flat"
    ? `${formatCurrency(referrer.commission_value)} flat per referral`
    : `${referrer.commission_value}% of monthly fee`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Referrals</h1>
        <p className="text-sm text-muted-foreground mt-1">Commission rate: {commissionLabel}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Referrals", value: stats.total, icon: Users, raw: true },
          { label: "Total Earned", value: formatCurrency(stats.totalEarned), icon: TrendingUp, raw: false },
          { label: "Pending Payout", value: formatCurrency(stats.pending), icon: Clock, raw: false },
          { label: "Paid Out", value: formatCurrency(stats.paid), icon: CheckCircle2, raw: false },
        ].map((s) => (
          <Card key={s.label} className="border-sidebar-border bg-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <s.icon className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <p className="text-xl font-bold text-foreground">{s.raw ? s.value : s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Referrals list */}
      <Card className="border-sidebar-border bg-card">
        <CardContent className="p-0">
          {referrals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="w-10 h-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No referrals yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Referred members will appear here</p>
            </div>
          ) : (
            <div className="divide-y divide-sidebar-border">
              {referrals.map((r) => (
                <div key={r.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{r.member?.full_name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Joined {r.member?.join_date ? formatDate(r.member.join_date) : "—"}
                      {r.member?.phone ? ` · ${r.member.phone}` : ""}
                    </p>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{formatCurrency(r.commission_amount)}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(r.created_at)}</p>
                    </div>
                    <Badge variant={r.status === "paid" ? "default" : "secondary"} className={r.status === "paid" ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"}>
                      {r.status === "paid" ? "Paid" : "Pending"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
