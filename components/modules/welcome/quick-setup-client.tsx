"use client";
import Link from "next/link";
import {
  Building2, CreditCard, Banknote, MessageSquare, UserCog, Users, Receipt,
  Check, ArrowRight, Sparkles, PartyPopper,
} from "lucide-react";
import type { QuickSetupStep } from "@/lib/data";
import { cn } from "@/lib/utils";

type StepKey = QuickSetupStep["key"];

const META: Record<StepKey, { icon: typeof Building2; title: string; desc: string; href: string; cta: string }> = {
  details: {
    icon: Building2, title: "Complete your gym details",
    desc: "Add your capacity, address and contact so your branch profile is complete.",
    href: "/settings", cta: "Open settings",
  },
  plans: {
    icon: CreditCard, title: "Create membership plans & pricing",
    desc: "Set up your plans (monthly, quarterly, annual…) with prices — the backbone of billing.",
    href: "/plans", cta: "Add plans",
  },
  paymethods: {
    icon: Banknote, title: "Add your payment methods",
    desc: "Bank / JazzCash / EasyPaisa details — these appear in the reminders members receive.",
    href: "/settings", cta: "Add methods",
  },
  reminder: {
    icon: MessageSquare, title: "Set your WhatsApp reminder",
    desc: "Customise the message members get when a payment is due.",
    href: "/settings", cta: "Edit message",
  },
  staff: {
    icon: UserCog, title: "Add your staff & trainers",
    desc: "Add your team, give them logins, and set trainer commission rules.",
    href: "/staff", cta: "Add staff",
  },
  member: {
    icon: Users, title: "Add your first member",
    desc: "Register a member — or bulk-import the ones you already have.",
    href: "/members", cta: "Add members",
  },
  payment: {
    icon: Receipt, title: "Record a payment",
    desc: "Collect a fee to complete the cycle — it flows straight into your reports.",
    href: "/payments", cta: "Record payment",
  },
};

export function QuickSetupClient({
  status,
}: {
  status: { gymName: string; steps: QuickSetupStep[]; doneCount: number; total: number };
}) {
  const { gymName, steps, doneCount, total } = status;
  const pct = Math.round((doneCount / total) * 100);
  const allDone = doneCount === total;
  // The first not-yet-done step is the "next" one we nudge them toward.
  const nextKey = steps.find((s) => !s.done)?.key;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 text-primary">
          <Sparkles className="w-5 h-5" />
          <span className="text-xs font-bold uppercase tracking-widest">Quick Setup</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Let&apos;s get {gymName || "your gym"} ready
        </h1>
        <p className="text-sm text-muted-foreground">
          Follow these steps in order — most take under a minute. They tick off automatically as you go.
        </p>
      </div>

      {/* Progress */}
      <div className="rounded-xl border border-sidebar-border bg-card p-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="font-medium text-foreground">
            {allDone ? "All set! 🎉" : `${doneCount} of ${total} done`}
          </span>
          <span className="text-muted-foreground">{pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {allDone && (
        <div className="rounded-xl border border-success/30 bg-success/10 p-4 flex items-start gap-3">
          <PartyPopper className="w-5 h-5 text-success shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-foreground">Your branch is fully set up.</p>
            <p className="text-muted-foreground mt-0.5">
              Head to your <Link href="/dashboard" className="text-primary hover:underline">dashboard</Link> to run the day-to-day.
            </p>
          </div>
        </div>
      )}

      {/* Steps */}
      <ol className="space-y-3">
        {steps.map((s, i) => {
          const m = META[s.key];
          const Icon = m.icon;
          const isNext = s.key === nextKey;
          return (
            <li
              key={s.key}
              className={cn(
                "rounded-xl border p-4 flex items-start gap-4 transition-colors",
                s.done
                  ? "border-sidebar-border bg-card/60"
                  : isNext
                    ? "border-primary/40 bg-primary/[0.04]"
                    : "border-sidebar-border bg-card",
              )}
            >
              {/* Status / number */}
              <div
                className={cn(
                  "flex items-center justify-center w-9 h-9 rounded-full shrink-0 border",
                  s.done
                    ? "bg-success/15 border-success/30 text-success"
                    : isNext
                      ? "bg-primary/15 border-primary/30 text-primary"
                      : "bg-muted border-border text-muted-foreground",
                )}
              >
                {s.done ? <Check className="w-4 h-4" /> : <span className="text-sm font-semibold">{i + 1}</span>}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Icon className={cn("w-4 h-4 shrink-0", s.done ? "text-muted-foreground" : "text-primary")} />
                  <h3 className={cn("text-sm font-semibold", s.done ? "text-muted-foreground line-through decoration-muted-foreground/40" : "text-foreground")}>
                    {m.title}
                  </h3>
                  {isNext && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded">Next</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{m.desc}</p>
              </div>

              <Link
                href={m.href}
                className={cn(
                  "shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap",
                  s.done
                    ? "text-muted-foreground hover:text-foreground hover:bg-white/5"
                    : "bg-primary text-white hover:bg-primary/90",
                )}
              >
                {s.done ? "Review" : m.cta}
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
