import { ResearchForm } from "./research-form";

const WA_NUMBER = "923193454321";
const WA_MESSAGE = encodeURIComponent(
  "Hi, I run a gym and saw your research page. Happy to share what works and what doesn't.",
);
const WA_URL = `https://wa.me/${WA_NUMBER}?text=${WA_MESSAGE}`;

const FOUNDER_NAME = "Musab Khan";

export const metadata = {
  title: "Research — Listening to gym owners in Pakistan",
  description: "Tell us how you run your gym. 8 honest questions, take 5 minutes.",
};

// System-font stack so the page renders instantly without waiting for Inter to download.
const SYSTEM_FONT = `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;

export default function ResearchPage() {
  return (
    <div
      className="min-h-screen bg-[#0a0a0a] text-foreground"
      style={{ fontFamily: SYSTEM_FONT }}
    >
      <main className="mx-auto max-w-2xl px-5 sm:px-7 py-10 sm:py-14 space-y-8">

        {/* ── Hero (compact) ────────────────────────────────────────── */}
        <section className="space-y-3">
          <p className="text-xs text-amber-300/90 font-semibold uppercase tracking-wider">
            Research · Pakistan
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-tight">
            What&apos;s the worst part of running your gym?
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            8 honest questions. Answer as many as you want — even one sentence helps. Takes ~5 minutes. <span className="text-emerald-300 font-semibold">3 months free for your gym</span> if you help.
          </p>
        </section>

        {/* ── Form ─────────────────────────────────────────────────── */}
        <ResearchForm whatsappUrl={WA_URL} />

        {/* ── Footer ──────────────────────────────────────────────── */}
        <footer className="pt-6 border-t border-sidebar-border/50">
          <p className="text-sm text-muted-foreground">
            — <span className="text-foreground/80 font-medium">{FOUNDER_NAME}</span>
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Researching gym operations across Pakistan. Answers stay confidential.
          </p>
        </footer>

      </main>
    </div>
  );
}
