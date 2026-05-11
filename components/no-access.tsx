"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * Friendly landing for a staff session that has NO permissions yet.
 *
 * Without this, an empty-perms staff (e.g. fresh cook/other, or staff whose
 * owner hasn't configured RBAC checkboxes) would hit a redirect loop:
 *   /dashboard → /members (Forbidden) → user stuck.
 *
 * Rendering this page instead breaks the loop and gives the user a clear
 * next step (contact owner / sign out).
 */
export function NoAccess({ fullName, gymName }: { fullName?: string; gymName?: string }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="px-4 py-12 sm:py-16 flex flex-col items-center gap-4 text-center max-w-md mx-auto">
      <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
        <Lock className="w-7 h-7 text-primary" />
      </div>
      <p className="text-lg sm:text-xl font-bold">No access yet</p>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {fullName ? `Hi ${fullName.split(" ")[0]} — ` : ""}your gym owner
        {gymName ? ` at ${gymName}` : ""} hasn&apos;t given you any permissions yet.
        Please contact them to enable access, or sign out below.
      </p>
      <button
        onClick={handleSignOut}
        disabled={signingOut}
        className="inline-flex items-center justify-center min-h-[40px] px-5 py-2 mt-2 rounded-lg border border-sidebar-border bg-card text-sm font-medium hover:bg-white/5 transition-colors disabled:opacity-50"
      >
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
