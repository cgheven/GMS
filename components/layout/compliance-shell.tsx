"use client";
import { Shield, LogOut, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Props {
  children: React.ReactNode;
  gymName: string;
  fullName: string;
}

export function ComplianceShell({ children, gymName, fullName }: Props) {
  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 flex items-center justify-between px-4 h-14 border-b border-sidebar-border bg-sidebar/80 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/15 border border-primary/25">
            <Zap className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground leading-none">{gymName}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide font-medium">Compliance Portal</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center text-xs font-bold text-primary">
              {fullName[0]?.toUpperCase()}
            </div>
            <div className="hidden sm:block">
              <p className="text-xs font-medium text-foreground leading-none">{fullName}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                <Shield className="w-2.5 h-2.5" /> Compliance Officer
              </p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors border border-sidebar-border"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
