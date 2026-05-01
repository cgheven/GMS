"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { MessageCircle, CheckCircle2, AlertCircle, Send, Sparkles, ArrowRight } from "lucide-react";
import { submitResearchResponse } from "@/app/actions/research";

// ─── Form state ─────────────────────────────────────────────────────────────

interface FormState {
  owner_name: string;
  gym_name: string;
  city: string;
  phone: string;
  email: string;

  members_count: string;
  trainers_count: string;
  years_running: string;

  payment_method: string;
  payment_tracking: string;
  reminder_method: string;
  trainer_tracking: string;

  hours_chasing: string;
  unpaid_amount: string;
  commission_cost: string;
  trainer_quit_loss: string;

  proof_dispute: string;
  gave_up_problem: string;
  magic_number: string;

  dream_tool: string;
  extra: string;
  pricing_tier: string;

  honeypot: string;
}

const empty: FormState = {
  owner_name: "", gym_name: "", city: "", phone: "", email: "",
  members_count: "", trainers_count: "", years_running: "",
  payment_method: "", payment_tracking: "", reminder_method: "", trainer_tracking: "",
  hours_chasing: "", unpaid_amount: "", commission_cost: "", trainer_quit_loss: "",
  proof_dispute: "", gave_up_problem: "", magic_number: "",
  dream_tool: "", extra: "", pricing_tier: "",
  honeypot: "",
};

// ─── Chip group (multi-choice button) ──────────────────────────────────────

interface ChipGroupProps {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}

function ChipGroup({ label, options, value, onChange }: ChipGroupProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm text-foreground/85 font-medium leading-snug">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const selected = value === o;
          return (
            <button
              key={o}
              type="button"
              onClick={() => onChange(selected ? "" : o)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                selected
                  ? "bg-amber-500/15 border-amber-500/40 text-amber-200"
                  : "bg-card/40 border-sidebar-border text-muted-foreground hover:border-amber-500/25 hover:text-foreground"
              }`}
            >
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main form ─────────────────────────────────────────────────────────────

interface ResearchFormProps {
  whatsappUrl: string;
}

export function ResearchForm({ whatsappUrl }: ResearchFormProps) {
  const [form, setForm] = useState<FormState>(empty);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [pending, startTransition] = useTransition();

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await submitResearchResponse(form);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSubmitted(true);
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // ── Thank-you state with soft pitch ─────────────────────────────────────
  if (submitted) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.05] p-7 sm:p-9 space-y-4">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-7 h-7 text-emerald-400 shrink-0" />
          <h2 className="text-2xl font-semibold tracking-tight">Thank you.</h2>
        </div>
        <p className="text-base text-foreground/90 leading-relaxed">
          I&apos;ll WhatsApp you within <span className="text-emerald-300 font-semibold">2 days</span> with what other gym owners are saying — and show you a tool we&apos;ve been building based on these exact conversations.
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-1 text-sm text-amber-200">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span><span className="font-semibold">3 months free</span> unlocked for your gym — as a thank-you for helping.</span>
        </div>
        <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
          <Link
            href="/research/built"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 text-emerald-950 font-semibold hover:bg-emerald-400 transition-colors text-sm"
          >
            See what we&apos;ve built <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-sidebar-border hover:border-emerald-500/30 transition-colors text-sm text-foreground/90"
          >
            <MessageCircle className="w-4 h-4" /> Or WhatsApp now
          </Link>
        </div>
      </div>
    );
  }

  // ── Common input styles ─────────────────────────────────────────────────
  const inputCls =
    "w-full px-3 py-2.5 rounded-lg bg-card/60 border border-sidebar-border focus:border-amber-500/50 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-sm text-foreground placeholder:text-muted-foreground transition-colors";
  const taCls = inputCls + " resize-none leading-relaxed";
  const sectionCls = "rounded-2xl border border-sidebar-border bg-card/40 p-5 sm:p-6 space-y-5";

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {/* honeypot */}
      <input
        type="text"
        name="website"
        autoComplete="off"
        tabIndex={-1}
        aria-hidden="true"
        value={form.honeypot}
        onChange={(e) => update("honeypot", e.target.value)}
        className="absolute left-[-9999px] w-px h-px opacity-0 pointer-events-none"
      />

      {/* ── Contact ──────────────────────────────────────────────────── */}
      <section className={sectionCls}>
        <div>
          <h2 className="text-base font-semibold text-foreground">Quick intro</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Only phone is required. The rest is optional.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Your name</label>
            <input className={inputCls} placeholder="e.g. Ahmed Khan" value={form.owner_name} onChange={(e) => update("owner_name", e.target.value)} autoComplete="name" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Gym name</label>
            <input className={inputCls} placeholder="e.g. Fit City Gym" value={form.gym_name} onChange={(e) => update("gym_name", e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">City</label>
            <input className={inputCls} placeholder="Karachi, Lahore…" value={form.city} onChange={(e) => update("city", e.target.value)} autoComplete="address-level2" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">
              WhatsApp / Phone <span className="text-rose-400">*</span>
            </label>
            <input className={inputCls} placeholder="0300 1234567" value={form.phone} onChange={(e) => update("phone", e.target.value)} inputMode="tel" autoComplete="tel" required />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs text-muted-foreground">Email (optional)</label>
            <input className={inputCls} placeholder="you@gym.com" value={form.email} onChange={(e) => update("email", e.target.value)} type="email" autoComplete="email" />
          </div>
        </div>
      </section>

      {/* ── About your gym ───────────────────────────────────────────── */}
      <section className={sectionCls}>
        <div>
          <h2 className="text-base font-semibold text-foreground">About your gym</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Just to understand context. Tap one in each row.</p>
        </div>
        <ChipGroup
          label="How many members do you have?"
          options={["<50", "50–150", "150–500", "500+"]}
          value={form.members_count}
          onChange={(v) => update("members_count", v)}
        />
        <ChipGroup
          label="How many trainers work for you?"
          options={["1–2", "3–5", "5–10", "10+"]}
          value={form.trainers_count}
          onChange={(v) => update("trainers_count", v)}
        />
        <ChipGroup
          label="How long has your gym been running?"
          options={["<1 year", "1–3 years", "3–10 years", "10+ years"]}
          value={form.years_running}
          onChange={(v) => update("years_running", v)}
        />
      </section>

      {/* ── How you run things today ─────────────────────────────────── */}
      <section className={sectionCls}>
        <div>
          <h2 className="text-base font-semibold text-foreground">How you run things today</h2>
          <p className="text-xs text-muted-foreground mt-0.5">No judgement. Most gyms run on Excel and WhatsApp.</p>
        </div>
        <ChipGroup
          label="How do members usually pay you?"
          options={["Cash", "JazzCash", "Bank transfer", "Mix of all"]}
          value={form.payment_method}
          onChange={(v) => update("payment_method", v)}
        />
        <ChipGroup
          label="How do you track member payments?"
          options={["Paper register", "Excel sheet", "An app", "Don't really track"]}
          value={form.payment_tracking}
          onChange={(v) => update("payment_tracking", v)}
        />
        <ChipGroup
          label="How do you remind members who are late on dues?"
          options={["WhatsApp manually", "Phone calls", "Don't bother", "Other"]}
          value={form.reminder_method}
          onChange={(v) => update("reminder_method", v)}
        />
        <ChipGroup
          label="How do you track which trainer handles which member?"
          options={["From memory", "Excel", "Whiteboard", "Don't track"]}
          value={form.trainer_tracking}
          onChange={(v) => update("trainer_tracking", v)}
        />
      </section>

      {/* ── The real cost (quantified) ───────────────────────────────── */}
      <section className={sectionCls}>
        <div>
          <h2 className="text-base font-semibold text-foreground">The real cost</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Estimates are fine. Numbers help us understand the real impact.</p>
        </div>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm text-foreground/85 font-medium leading-snug">
              Roughly how many <span className="text-amber-300">hours per week</span> do you spend chasing dues on WhatsApp / calls?
            </label>
            <input className={inputCls} placeholder="e.g. 5 hours" value={form.hours_chasing} onChange={(e) => update("hours_chasing", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-foreground/85 font-medium leading-snug">
              Right now, how much money is <span className="text-amber-300">unpaid</span> by your members? (Rs estimate)
            </label>
            <input className={inputCls} placeholder="e.g. Rs 80,000" value={form.unpaid_amount} onChange={(e) => update("unpaid_amount", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-foreground/85 font-medium leading-snug">
              In the last year, how much have <span className="text-amber-300">trainer commission disputes</span> cost you? (in time, payouts, turnover)
            </label>
            <input className={inputCls} placeholder="e.g. Rs 30,000 + 2 trainers left" value={form.commission_cost} onChange={(e) => update("commission_cost", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-foreground/85 font-medium leading-snug">
              If your top trainer quit tomorrow, what&apos;s your <span className="text-amber-300">3-month revenue loss</span> estimate?
            </label>
            <input className={inputCls} placeholder="e.g. Rs 200,000" value={form.trainer_quit_loss} onChange={(e) => update("trainer_quit_loss", e.target.value)} />
          </div>
        </div>
      </section>

      {/* ── What's broken ────────────────────────────────────────────── */}
      <section className={sectionCls}>
        <div>
          <h2 className="text-base font-semibold text-foreground">What&apos;s broken</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Skip any you don&apos;t want to answer. Even one line is gold.</p>
        </div>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm text-foreground/85 font-medium leading-snug">
              When a member says &ldquo;I already paid you&rdquo; and you can&apos;t prove otherwise — what do you do?
            </label>
            <textarea className={taCls} rows={2} placeholder="Argue / give in / refund / something else…" value={form.proof_dispute} onChange={(e) => update("proof_dispute", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-foreground/85 font-medium leading-snug">
              What&apos;s a problem at your gym you&apos;ve <span className="text-amber-300">stopped trying to fix</span>?
            </label>
            <textarea className={taCls} rows={3} placeholder="You've tried things, nothing worked, you've accepted it…" value={form.gave_up_problem} onChange={(e) => update("gave_up_problem", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-foreground/85 font-medium leading-snug">
              If you had a magic dashboard showing <span className="text-amber-300">one number every morning</span>, what would it be?
            </label>
            <textarea className={taCls} rows={2} placeholder="Cash collected, members about to expire, attendance, anything…" value={form.magic_number} onChange={(e) => update("magic_number", e.target.value)} />
          </div>
        </div>
      </section>

      {/* ── The dream ────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.05] p-5 sm:p-6 space-y-3">
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-foreground leading-snug">
            If a tool could handle <span className="text-amber-300">anything</span> for your gym automatically, what would you have it do first?
          </h2>
          <p className="text-xs text-muted-foreground mt-1.5">Be wild. Be specific. The wilder the better.</p>
        </div>
        <textarea className={taCls} rows={4} placeholder="Auto-collect payments, send reminders, track trainers, stop members from leaving…" value={form.dream_tool} onChange={(e) => update("dream_tool", e.target.value)} />
      </section>

      {/* ── Wishlist (extra) ─────────────────────────────────────────── */}
      <section className={sectionCls}>
        <div>
          <h2 className="text-base font-semibold text-foreground">Anything else you want to share?</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Specific requirements, integrations, frustrations — anything.</p>
        </div>
        <textarea className={taCls} rows={4} placeholder="Write freely. No idea is too small or too big." value={form.extra} onChange={(e) => update("extra", e.target.value)} />
      </section>

      {/* ── Pricing tease (optional) ─────────────────────────────────── */}
      <section className={sectionCls}>
        <div>
          <h2 className="text-base font-semibold text-foreground">One last thing <span className="text-xs text-muted-foreground font-normal">(optional)</span></h2>
          <p className="text-xs text-muted-foreground mt-0.5">Helps us understand what&apos;s realistic. No commitment.</p>
        </div>
        <ChipGroup
          label="What's the most you'd pay monthly for a tool that solves your top 3 headaches?"
          options={["Less than Rs 10,000", "Rs 10,000 – 25,000", "Rs 25,000 – 50,000", "Rs 50,000+", "Need to see it first"]}
          value={form.pricing_tier}
          onChange={(v) => update("pricing_tier", v)}
        />
      </section>

      {/* ── Error / submit ───────────────────────────────────────────── */}
      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/[0.05] p-3 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <p className="text-sm text-rose-300">{error}</p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 text-emerald-950 font-semibold hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed transition-colors text-sm"
        >
          {pending ? "Sending…" : (<><Send className="w-4 h-4" /> Submit answers</>)}
        </button>
        <Link
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:text-emerald-400 transition-colors inline-flex items-center gap-1.5"
        >
          <MessageCircle className="w-3.5 h-3.5" /> Or WhatsApp me directly
        </Link>
      </div>
    </form>
  );
}
