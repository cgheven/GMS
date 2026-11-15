"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Loader2, Eye, EyeOff, AlertCircle } from "lucide-react";
import { verifyAndProvision } from "@/app/actions/signup";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const inputClass =
  "h-10 pr-10 bg-background/50 border-sidebar-border focus-visible:ring-primary/40 focus-visible:border-primary/50";
const labelClass = "text-xs font-medium text-muted-foreground uppercase tracking-wider";

export function VerifyForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    setLoading(true);
    try {
      const res = await verifyAndProvision({ token, password });
      if (!res.success) {
        setError(res.error);
        setLoading(false);
        return;
      }
      // Account provisioned — sign them straight into their new trial.
      const supabase = createClient();
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: res.email,
        password,
      });
      if (signInErr) {
        router.push("/login");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="w-full max-w-sm relative animate-fade-up">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 overflow-hidden shrink-0">
            <Image src="/logo-mark.jpg" alt="Pulse" width={48} height={48} priority className="w-full h-full object-cover" />
          </div>
          <div>
            <p className="text-foreground font-bold text-lg tracking-tight leading-none">Pulse</p>
            <p className="text-primary/70 text-[10px] mt-1 font-semibold tracking-[0.15em] uppercase">Pulse of your gym</p>
          </div>
        </div>

        <div className="rounded-2xl border border-sidebar-border bg-card p-8 shadow-2xl">
          {!token ? (
            <div className="text-center py-4 space-y-4">
              <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
              <h2 className="text-xl font-semibold text-foreground">Invalid link</h2>
              <p className="text-sm text-muted-foreground">
                This verification link is missing or malformed. Please sign up again to get a fresh link.
              </p>
              <Link href="/signup" className="inline-block text-sm text-primary hover:underline">Back to sign up</Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                  Gym Management System
                </p>
                <h2 className="text-xl font-semibold text-foreground mt-2">Set your password</h2>
                <p className="text-sm text-muted-foreground mt-1">One last step to start your 14-day free trial.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="password" className={labelClass}>Password</Label>
                  <div className="relative">
                    <Input id="password" type={show ? "text" : "password"} value={password}
                      onChange={(e) => { setPassword(e.target.value); setError(""); }}
                      placeholder="At least 8 characters" required autoComplete="new-password" disabled={loading} className={inputClass} />
                    <button type="button" onClick={() => setShow(!show)} tabIndex={-1}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm" className={labelClass}>Confirm password</Label>
                  <Input id="confirm" type={show ? "text" : "password"} value={confirm}
                    onChange={(e) => { setConfirm(e.target.value); setError(""); }}
                    placeholder="Re-enter your password" required autoComplete="new-password" disabled={loading}
                    className="h-10 bg-background/50 border-sidebar-border focus-visible:ring-primary/40 focus-visible:border-primary/50" />
                </div>

                {error && <p className="text-xs text-destructive">{error}</p>}

                <Button type="submit" disabled={loading}
                  className="w-full h-10 mt-2 bg-primary text-white font-semibold hover:bg-primary/90 transition-all duration-200 glow-amber">
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Creating your account…</> : "Create account & start trial"}
                </Button>
              </form>

              <p className="text-center text-sm text-muted-foreground mt-6">
                Already verified? <Link href="/login" className="text-primary hover:underline">Sign in</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
