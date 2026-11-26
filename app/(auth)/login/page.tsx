"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Zap } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
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
        {/* Logo lockup — same horizontal brand lockup as the sidebar, centred
            above the card so the brand, the form and the button share one axis. */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 overflow-hidden shrink-0">
            <Image src="/logo-mark.jpg" alt="Pulse" width={48} height={48} priority className="w-full h-full object-cover" />
          </div>
          <div>
            <p className="text-foreground font-bold text-lg tracking-tight leading-none">Pulse</p>
            <p className="text-primary/70 text-[10px] mt-1 font-semibold tracking-[0.15em] uppercase">Pulse of your gym</p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-sidebar-border bg-card p-8 shadow-2xl">
          <div className="mb-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Gym Management System
            </p>
            <h2 className="text-xl font-semibold text-foreground mt-2">Welcome back</h2>
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

          <p className="text-center text-sm text-muted-foreground mt-6">
            New to Pulse? <Link href="/signup" className="text-primary hover:underline">Create an account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
