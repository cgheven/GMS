"use client";
import { useState } from "react";
import Link from "next/link";
import { Zap } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { Navbar } from "@/components/layout/navbar";
import { useGymContext } from "@/contexts/gym-context";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { profile, gym, gyms, isDemo, setActiveGym } = useGymContext();

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {isDemo && (
        <div className="flex items-center justify-center gap-3 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-amber-400 text-xs font-medium shrink-0 w-full">
          <Zap className="w-3.5 h-3.5 shrink-0" />
          <span>You&apos;re in demo mode — data is read-only.</span>
          <Link href="/pricing" className="underline underline-offset-2 hover:text-amber-300 transition-colors">
            Sign up to save changes →
          </Link>
        </div>
      )}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <Navbar
            onMenuClick={() => setSidebarOpen(true)}
            profile={profile}
            gym={gym}
            gyms={gyms}
            setActiveGym={setActiveGym}
          />
          <main className="flex-1 overflow-y-auto">
            <div className="container mx-auto px-4 sm:px-6 py-6 max-w-7xl">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
