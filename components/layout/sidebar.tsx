"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, CreditCard, FileText, Settings, X,
  Shield, Building2, Globe, LogIn,
  BarChart3, UserCog, Dumbbell, CalendarDays,
  Wrench, Receipt, ClipboardList, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsAdmin } from "@/hooks/use-is-admin";

const navGroups = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Members",
    items: [
      { href: "/members",   label: "Members",     icon: Users },
      { href: "/check-ins", label: "Check-ins",   icon: LogIn },
      { href: "/plans",     label: "Plans",        icon: Zap },
      { href: "/payments",  label: "Transactions", icon: CreditCard },
    ],
  },
  {
    label: "Training",
    items: [
      { href: "/classes", label: "Classes",  icon: CalendarDays },
      { href: "/staff",   label: "Trainers", icon: Dumbbell },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/expenses",      label: "Expenses",      icon: Receipt },
      { href: "/bills",         label: "Bills",          icon: FileText },
      { href: "/equipment",     label: "Equipment",      icon: Wrench },
    ],
  },
  {
    label: "Analytics",
    items: [
      { href: "/reports", label: "Reports", icon: BarChart3 },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/settings", label: "Settings",    icon: Settings },
      { href: "/find",     label: "Gym Directory", icon: Globe },
    ],
  },
];

interface SidebarProps { open: boolean; onClose: () => void; }

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { isAdmin } = useIsAdmin();

  function NavLink({ href, label, icon: Icon }: { href: string; label: string; icon: typeof LayoutDashboard }) {
    const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
    return (
      <Link
        href={href}
        onClick={onClose}
        className={cn(
          "relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 group",
          active
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
        )}
      >
        {active && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-primary" />
        )}
        <Icon className={cn("w-4 h-4 shrink-0 transition-colors", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
        <span>{label}</span>
      </Link>
    );
  }

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden" onClick={onClose} />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 lg:z-auto",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-sidebar-border">
          <Link href="/dashboard" className="flex items-center gap-2.5 group" onClick={onClose}>
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/15 border border-primary/25 transition-all group-hover:bg-primary/20">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-foreground font-bold text-sm tracking-tight leading-none">Pulse</p>
              <p className="text-muted-foreground text-[11px] mt-0.5 font-medium tracking-wide uppercase">Gym Management</p>
            </div>
          </Link>
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-3 scrollbar-hide">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-widest px-3 mb-1">{group.label}</p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink key={item.href} {...item} />
                ))}
              </div>
            </div>
          ))}

          {isAdmin && (
            <div>
              <div className="flex items-center gap-1.5 px-3 mb-1">
                <Shield className="w-3 h-3 text-primary/60" />
                <p className="text-[10px] font-semibold text-primary/60 uppercase tracking-widest">Admin</p>
              </div>
              <div className="space-y-0.5 rounded-lg border border-primary/10 bg-primary/[0.04] p-1">
                <NavLink href="/admin/users"     label="User Management"  icon={Shield} />
                <NavLink href="/admin/gyms"      label="Gyms"             icon={Building2} />
                <NavLink href="/admin/prospects" label="Gym Pipeline"     icon={UserCog} />
                <NavLink href="/admin/audit"     label="Audit Log"        icon={ClipboardList} />
              </div>
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-sidebar-border">
          <div className="flex items-center gap-2 px-1">
            <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            <p className="text-xs text-muted-foreground">Pulse is online</p>
          </div>
        </div>
      </aside>
    </>
  );
}
