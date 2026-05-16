"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Zap } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  async function handleDemoLogin() {
    setDemoLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: "demo@musabkhan.me",
      password: "PulseDemo2024!",
    });
    if (error) {
      toast({ title: "Demo login failed", description: error.message, variant: "destructive" });
      setDemoLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast({ title: "Login failed", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    const { data: profile } = await supabase
      .from("pulse_profiles")
      .select("is_admin, role")
      .eq("id", data.user.id)
      .single();
    const dest = profile?.is_admin ? "/admin/gyms" : profile?.role === "trainer" ? "/trainer" : profile?.role === "referrer" ? "/referrer" : profile?.role === "compliance" ? "/compliance-portal" : "/dashboard";
    router.push(dest);
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      {/* Subtle ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="w-full max-w-sm relative animate-fade-up">
        {/* Logo mark */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 mb-5">
            <Zap className="w-6 h-6 text-primary" />
          </div>
          <h1 className="font-serif text-3xl text-foreground tracking-tight">Pulse</h1>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary/70">Pulse of your gym</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-sidebar-border bg-card p-8 shadow-2xl">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-foreground">Welcome back</h2>
            <p className="text-sm text-muted-foreground mt-1">Sign in to your account</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={loading}
                className="h-10 bg-background/50 border-sidebar-border focus-visible:ring-primary/40 focus-visible:border-primary/50"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  disabled={loading}
                  className="h-10 pr-10 bg-background/50 border-sidebar-border focus-visible:ring-primary/40 focus-visible:border-primary/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-10 mt-2 bg-primary text-white font-semibold hover:bg-primary/90 transition-all duration-200 glow-amber"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Signing in…</>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          <div className="mt-4 pt-4 border-t border-sidebar-border">
            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={demoLoading || loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-primary/25 bg-primary/5 text-xs font-semibold text-primary hover:bg-primary/10 transition-all disabled:opacity-60 whitespace-nowrap"
            >
              {demoLoading ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <Zap className="w-4 h-4 shrink-0" />}
              TRY DEMO — NO ACCOUNT NEEDED
            </button>
          </div>

          <p className="text-center text-xs text-muted-foreground/60 mt-4 leading-relaxed">
            Access restricted to authorized users only.
            <br />
            Contact your administrator for access.
          </p>
        </div>

        {/* WhatsApp CTA */}
        <div className="mt-5 text-center space-y-2">
          <p className="text-xs text-muted-foreground/50">Interested in Pulse for your gym?</p>
          <a
            href={`https://wa.me/923336673553?text=${encodeURIComponent("Hi, I'm interested in Pulse GMS for my gym. How do I get started?")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#25D366]/10 border border-[#25D366]/25 text-[#25D366] text-xs font-semibold hover:bg-[#25D366]/20 transition-all"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current shrink-0" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Chat on WhatsApp
          </a>
          <div>
            <Link href="/pricing" className="text-xs text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors underline underline-offset-2">
              View pricing
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
