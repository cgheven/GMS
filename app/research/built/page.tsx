import Link from "next/link";
import {
  MessageCircle, ArrowLeft, Wallet, Target,
  Users, FileText, LayoutDashboard, Sparkles,
} from "lucide-react";

const WA_NUMBER = "923193454321";
const WA_MESSAGE = encodeURIComponent(
  "Hi, I filled out the research form and want to talk about what you're building.",
);
const WA_URL = `https://wa.me/${WA_NUMBER}?text=${WA_MESSAGE}`;

export const metadata = {
  title: "What we've built — based on real conversations with gym owners",
  description: "A look at the tool we've been building based on conversations with gym owners across Pakistan.",
};

const SYSTEM_FONT = `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;

interface Section {
  icon: typeof Wallet;
  iconClass: string;
  title: string;
  problem: string;
  solution: string;
  preview: string;
}

const SECTIONS: Section[] = [
  {
    icon: Wallet,
    iconClass: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25",
    title: "Money in faster",
    problem: "Chasing late dues on WhatsApp every day. Typing the same reminder, copy-pasting bank details, hoping someone replies.",
    solution: "One tap sends the reminder with your JazzCash/bank details already filled in. Members 3 days overdue get a rose badge so nobody slips. Mark paid in seconds — the reminder cycle ends.",
    preview: "[Payments page — Members tab with overdue badges and one-tap WhatsApp reminder buttons]",
  },
  {
    icon: Target,
    iconClass: "text-amber-400 bg-amber-500/10 border-amber-500/25",
    title: "Members who stay",
    problem: "Members quietly disappear. You only notice when they stop showing up — and by then it's too late to win them back.",
    solution: "Track each member's goal (lose 5kg, gain muscle, recover from injury) with weekly body metrics. Trainer logs progress. Leaderboard celebrates wins publicly. Members feel seen — they stay.",
    preview: "[Trainer dashboard — member goal card with sparkline progress + weekly body metrics timeline]",
  },
  {
    icon: Users,
    iconClass: "text-sky-400 bg-sky-500/10 border-sky-500/25",
    title: "Trainer fairness, settled",
    problem: "Trainer leaves with 30 clients' history in his head. Commission disputes turn into shouting matches because nobody has records.",
    solution: "Every payment locks the trainer who owned the member that month. Future transfers don't rewrite history. When a trainer resigns, move all 30 clients to another trainer in one click — goals, body metrics, payment history all stay with each client.",
    preview: "[Trainers page — Transfer Clients dialog showing destination dropdown + 'also transfer goals' option]",
  },
  {
    icon: FileText,
    iconClass: "text-rose-400 bg-rose-500/10 border-rose-500/25",
    title: "Records when you need them",
    problem: "FBR season = two weekends digging through Excel and receipts. A member says 'I paid you last month' and you can't prove otherwise.",
    solution: "Tax-ready PDF with NTN, period filter, and selectable member columns — generated in 30 seconds. Every payment, refund, waiver tied to a timestamped audit trail you can show anyone.",
    preview: "[Compliance report preview — header with gym info, NTN, period, member rows table]",
  },
  {
    icon: LayoutDashboard,
    iconClass: "text-purple-400 bg-purple-500/10 border-purple-500/25",
    title: "One screen, 30 seconds",
    problem: "You walk into the gym and don't know what to look at first. By the time you've checked Excel, the day is half gone.",
    solution: "Dashboard shows three numbers up top — Collected, Outstanding, Net Profit. Below that: who's expiring this week, who owes money, which bills are overdue. Decide what to do today in under a minute.",
    preview: "[Dashboard — 3 hero stat cards + 'Needs Attention' list with expiring members and overdue payments]",
  },
];

export default function BuiltPage() {
  return (
    <div
      className="min-h-screen bg-[#0a0a0a] text-foreground"
      style={{ fontFamily: SYSTEM_FONT }}
    >
      <main className="mx-auto max-w-3xl px-5 sm:px-7 py-10 sm:py-14 space-y-12">

        {/* ── Back link ─────────────────────────────────────────────── */}
        <Link
          href="/research"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to the research form
        </Link>

        {/* ── Hero ──────────────────────────────────────────────────── */}
        <section className="space-y-3">
          <p className="text-xs text-amber-300/90 font-semibold uppercase tracking-wider inline-flex items-center gap-1.5">
            <Sparkles className="w-3 h-3" /> What we&apos;ve built
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-tight">
            Built from real conversations with Pakistani gym owners.
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-xl">
            Not features for the sake of features. Each section below maps to a problem owners told us cost them money, time, or trust. Skim it in 90 seconds.
          </p>
        </section>

        {/* ── Outcome sections ──────────────────────────────────────── */}
        <div className="space-y-10">
          {SECTIONS.map((s, i) => {
            const Icon = s.icon;
            return (
              <section key={s.title} className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${s.iconClass}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-mono tabular-nums">0{i + 1}</p>
                    <h2 className="text-xl sm:text-2xl font-semibold tracking-tight leading-tight">{s.title}</h2>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-0 sm:pl-13">
                  <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.04] p-4">
                    <p className="text-[10px] font-semibold text-rose-300/80 uppercase tracking-wider mb-1.5">The problem</p>
                    <p className="text-sm text-foreground/85 leading-relaxed">{s.problem}</p>
                  </div>
                  <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.04] p-4">
                    <p className="text-[10px] font-semibold text-emerald-300/80 uppercase tracking-wider mb-1.5">What we built</p>
                    <p className="text-sm text-foreground/85 leading-relaxed">{s.solution}</p>
                  </div>
                </div>

                {/* Screenshot placeholder — to be replaced with real screenshots */}
                <div className="rounded-2xl border border-dashed border-sidebar-border bg-card/30 p-5 text-center">
                  <p className="text-[11px] font-mono text-muted-foreground/70">{s.preview}</p>
                </div>
              </section>
            );
          })}
        </div>

        {/* ── CTA ───────────────────────────────────────────────────── */}
        <section className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.04] p-6 sm:p-8 space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Want a closer look?</h2>
          <p className="text-sm sm:text-base text-foreground/85 leading-relaxed">
            Quick WhatsApp call. I&apos;ll walk you through the parts that matter for your gym, share what other owners are using, and answer anything.
          </p>
          <p className="text-xs text-muted-foreground">
            Pricing tailored to your gym size — we&apos;ll discuss on the call. <span className="text-emerald-300 font-semibold">3 months free for your gym</span> if you helped with the research.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <Link
              href={WA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 text-emerald-950 font-semibold hover:bg-emerald-400 transition-colors text-sm"
            >
              <MessageCircle className="w-4 h-4" /> WhatsApp me
            </Link>
            <Link
              href="/research"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-sidebar-border hover:border-amber-500/30 hover:text-amber-200 transition-colors text-sm text-foreground/90"
            >
              Or fill the research form first
            </Link>
          </div>
        </section>

        {/* ── Footer ────────────────────────────────────────────────── */}
        <footer className="pt-4 border-t border-sidebar-border/50">
          <p className="text-xs text-muted-foreground/70">
            Built from conversations across Karachi & Lahore. Iterating with every owner we talk to.
          </p>
        </footer>

      </main>
    </div>
  );
}
