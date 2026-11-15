"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Loader2, CheckCircle2 } from "lucide-react";
import { requestSignup } from "@/app/actions/signup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const HEARD_FROM: { value: string; label: string }[] = [
  { value: "referral", label: "Referral" },
  { value: "instagram", label: "Instagram" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "google", label: "Google" },
  { value: "facebook", label: "Facebook" },
  { value: "other", label: "Other" },
];

const inputClass =
  "h-10 bg-background/50 border-sidebar-border focus-visible:ring-primary/40 focus-visible:border-primary/50";
const labelClass =
  "text-xs font-medium text-muted-foreground uppercase tracking-wider";

export function SignupForm() {
  const [gymName, setGymName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [heardFrom, setHeardFrom] = useState("");
  const [contactRef2, setContactRef2] = useState(""); // honeypot
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!gymName.trim()) return setError("Enter your gym's name.");
    if (!ownerName.trim()) return setError("Enter your name.");
    if (!EMAIL_RE.test(email.trim())) return setError("Enter a valid email address.");
    if (!phone.trim()) return setError("Enter your mobile number.");
    if (!city.trim()) return setError("Enter your city.");

    setLoading(true);
    try {
      const res = await requestSignup({
        gymName: gymName.trim(),
        ownerName: ownerName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        city: city.trim(),
        heardFrom: heardFrom || undefined,
        contactRef2,
      });
      if (res.success) {
        setSent(true);
      } else {
        setError(res.error);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      {/* Subtle ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="w-full max-w-sm relative animate-fade-up">
        {/* Logo lockup — same horizontal brand lockup as the sidebar + login. */}
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
          {sent ? (
            <div className="text-center py-4 space-y-4">
              <CheckCircle2 className="w-12 h-12 text-success mx-auto" />
              <h2 className="text-xl font-semibold text-foreground">You&apos;re on the list</h2>
              <p className="text-sm text-muted-foreground">
                Thanks{ownerName.trim() ? `, ${ownerName.trim()}` : ""}! We&apos;ve got your details for{" "}
                <span className="font-medium text-foreground">{gymName.trim() || "your gym"}</span> and
                sent a confirmation to <span className="font-medium text-foreground">{email.trim()}</span>.
                Our team will reach out on WhatsApp to get you set up.
              </p>
              <a
                href={`https://wa.me/923336673553?text=${encodeURIComponent(
                  `Hi, I just signed up for Pulse for ${gymName.trim() || "my gym"}. How do I get started?`,
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#25D366]/10 border border-[#25D366]/25 text-[#25D366] text-xs font-semibold hover:bg-[#25D366]/20 transition-all"
              >
                Chat on WhatsApp now
              </a>
              <div>
                <Link href="/login" className="inline-block text-sm text-primary hover:underline">Back to sign in</Link>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                  Gym Management System
                </p>
                <h2 className="text-xl font-semibold text-foreground mt-2">Create your account</h2>
                <p className="text-sm text-muted-foreground mt-1">Tell us about your gym — we&apos;ll get you set up.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="gym" className={labelClass}>Gym name</Label>
                  <Input id="gym" value={gymName} onChange={(e) => { setGymName(e.target.value); setError(""); }}
                    placeholder="e.g. Iron Fitness" required disabled={loading} className={inputClass} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="owner" className={labelClass}>Your name</Label>
                  <Input id="owner" value={ownerName} onChange={(e) => { setOwnerName(e.target.value); setError(""); }}
                    placeholder="Your full name" required disabled={loading} className={inputClass} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email" className={labelClass}>Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }}
                    placeholder="you@example.com" required autoComplete="email" disabled={loading} className={inputClass} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone" className={labelClass}>Mobile number</Label>
                  <Input id="phone" type="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setError(""); }}
                    placeholder="03XXXXXXXXX" required autoComplete="tel" disabled={loading} className={inputClass} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="city" className={labelClass}>City</Label>
                  <Input id="city" value={city} onChange={(e) => { setCity(e.target.value); setError(""); }}
                    placeholder="e.g. Karachi" required disabled={loading} className={inputClass} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="heard" className={labelClass}>
                    How did you hear about us? <span className="normal-case font-normal">(optional)</span>
                  </Label>
                  <Select value={heardFrom} onValueChange={setHeardFrom} disabled={loading}>
                    <SelectTrigger id="heard" className="h-10 bg-background/50 border-sidebar-border focus:ring-primary/40 focus:border-primary/50">
                      <SelectValue placeholder="Select an option" />
                    </SelectTrigger>
                    <SelectContent>
                      {HEARD_FROM.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Honeypot: off-screen, not tab-reachable, ignored by humans. */}
                <div aria-hidden className="absolute -left-[9999px] top-0 h-0 w-0 overflow-hidden">
                  <label htmlFor="contactRef2">Leave this field empty</label>
                  <input id="contactRef2" name="contactRef2" tabIndex={-1} autoComplete="off"
                    value={contactRef2} onChange={(e) => setContactRef2(e.target.value)} />
                </div>

                {error && <p className="text-xs text-destructive">{error}</p>}

                <Button type="submit" disabled={loading}
                  className="w-full h-10 mt-2 bg-primary text-white font-semibold hover:bg-primary/90 transition-all duration-200 glow-amber">
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Creating…</> : "Create account"}
                </Button>
              </form>

              <p className="text-center text-sm text-muted-foreground mt-6">
                Already have an account? <Link href="/login" className="text-primary hover:underline">Sign in</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
