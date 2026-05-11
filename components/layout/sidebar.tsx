"use client";
import { memo, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, CreditCard, FileText, Settings, X,
  Shield, Building2, Globe, LogIn, Trophy, Target,
  BarChart3, UserCog, Dumbbell, CalendarDays,
  Receipt, ClipboardList, Zap, HandCoins, Instagram, TrendingUp, Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsAdmin } from "@/hooks/use-is-admin";
import type { PermissionKey } from "@/lib/permissions";

// prefetch=true on the 5 most-used routes (kills the 17-link prefetch storm).
// The rest fall back to Next.js' on-hover prefetch behavior — fast nav still works.

// Each nav item can require ANY ONE of a list of permissions to show.
// Items without `requires` are owner/admin-only routes (filtered out
// for staff sessions entirely). The Dashboard is always visible.
type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  prefetch: boolean;
  // If `requires` is omitted, this item is owner-only — hidden from any
  // non-null `permissions` prop. If `requires` is an empty array, the
  // item is always visible (e.g. Dashboard).
  requires?: PermissionKey[];
};

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [
      // Dashboard is owner-only (financial KPIs). Staff land on /members instead.
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, prefetch: true /* owner only */ },
    ],
  },
  {
    label: "Members",
    items: [
      { href: "/members",   label: "Members",   icon: Users,      prefetch: true,  requires: ["members.view_all", "members.add"] },
      { href: "/check-ins", label: "Check-ins", icon: LogIn,      prefetch: true,  requires: ["checkins.record"] },
      { href: "/plans",     label: "Plans",     icon: Zap,        prefetch: false /* owner only */ },
      { href: "/payments",  label: "Payments",  icon: CreditCard, prefetch: true,  requires: ["payments.view", "payments.create"] },
    ],
  },
  {
    label: "Growth",
    items: [
      { href: "/leads",        label: "Leads",           icon: Target,     prefetch: true,  requires: ["leads.view"] },
      { href: "/smart-earn",   label: "Profit Insights", icon: TrendingUp, prefetch: false, requires: ["financials.view"] },
      { href: "/referrers",    label: "Partners",        icon: HandCoins,  prefetch: false /* owner only */ },
      { href: "/social-media", label: "Social Media",    icon: Instagram,  prefetch: false /* owner only */ },
    ],
  },
  {
    label: "Training",
    items: [
      { href: "/classes",  label: "Classes",  icon: CalendarDays, prefetch: false /* owner only */ },
      { href: "/trainers", label: "Trainers", icon: Dumbbell,     prefetch: false /* owner only */ },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/staff",     label: "Staff",     icon: UserCog,  prefetch: false /* owner only */ },
      { href: "/inventory", label: "Inventory", icon: Package,  prefetch: false /* owner only */ },
      { href: "/expenses",  label: "Expenses",  icon: Receipt,  prefetch: false, requires: ["financials.view"] },
      { href: "/bills",     label: "Bills",     icon: FileText, prefetch: false, requires: ["financials.view"] },
    ],
  },
  {
    label: "Analytics",
    items: [
      // All Analytics pages are owner-only. Page guards reject staff with
      // "Owner-only page" so the sidebar must hide them too for consistency.
      { href: "/reports",            label: "Reports",     icon: BarChart3, prefetch: false /* owner only */ },
      { href: "/reports/compliance", label: "Compliance",  icon: FileText,  prefetch: false /* owner only */ },
      { href: "/leaderboard",        label: "Leaderboard", icon: Trophy,    prefetch: false /* owner only */ },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/settings", label: "Settings",      icon: Settings, prefetch: false /* owner only */ },
      { href: "/find",     label: "Gym Directory", icon: Globe,    prefetch: false /* owner only */ },
    ],
  },
];

interface NavLinkProps { href: string; label: string; icon: typeof LayoutDashboard; pathname: string; onClose: () => void; prefetch?: boolean; }

const NavLink = memo(function NavLink({ href, label, icon: Icon, pathname, onClose, prefetch = false }: NavLinkProps) {
  const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
  return (
    <Link
      href={href}
      onClick={onClose}
      prefetch={prefetch}
      className={cn(
        "relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 group",
        active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-primary" />
      )}
      <Icon className={cn("w-4 h-4 shrink-0 transition-colors", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
      <span>{label}</span>
    </Link>
  );
});

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  /**
   * RBAC permission set for the current session.
   * - `null`/`undefined` → owner mode, show every item (legacy behavior).
   * - `string[]` → staff mode, filter items based on `requires`.
   *   Items without `requires` (owner-only) are hidden.
   *   Items with empty `requires` are always shown.
   */
  permissions?: string[] | null;
}

export function Sidebar({ open, onClose, permissions }: SidebarProps) {
  const pathname = usePathname();
  const { isAdmin } = useIsAdmin();

  const visibleGroups = useMemo(() => {
    // Owner mode — no filtering.
    if (permissions == null) return navGroups;

    const perms = permissions;
    return navGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          // Item without `requires` = owner-only, hide from staff.
          if (!item.requires) return false;
          // Empty requires = always visible (e.g. Dashboard).
          if (item.requires.length === 0) return true;
          // Show if staff has ANY of the required permissions.
          return item.requires.some((p) => perms.includes(p));
        }),
      }))
      // Hide groups that ended up empty after filtering.
      .filter((group) => group.items.length > 0);
  }, [permissions]);

  // Staff sessions never see the admin section.
  const showAdminSection = permissions == null && isAdmin;

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
        <div className="flex items-center justify-between px-4 h-14 border-b border-sidebar-border">
          <Link href="/dashboard" className="flex items-center gap-2.5 group" onClick={onClose}>
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/15 border border-primary/25 transition-all group-hover:bg-primary/20">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-foreground font-bold text-sm tracking-tight leading-none">Pulse</p>
              <p className="text-primary/60 text-[10px] mt-0.5 font-semibold tracking-[0.15em] uppercase">Pulse of your gym</p>
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
          {visibleGroups.map((group) => (
            <div key={group.label}>
              <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest px-3 mb-1 mt-1">{group.label}</p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink key={item.href} {...item} pathname={pathname} onClose={onClose} />
                ))}
              </div>
            </div>
          ))}

          {showAdminSection && (
            <div>
              <div className="flex items-center gap-1.5 px-3 mb-1">
                <Shield className="w-3 h-3 text-primary/60" />
                <p className="text-[10px] font-semibold text-primary/60 uppercase tracking-widest">Admin</p>
              </div>
              <div className="space-y-0.5 rounded-lg border border-primary/10 bg-primary/[0.04] p-1">
                <NavLink href="/admin/users"     label="User Management"  icon={Shield}         pathname={pathname} onClose={onClose} />
                <NavLink href="/admin/gyms"      label="Gyms"             icon={Building2}      pathname={pathname} onClose={onClose} />
                <NavLink href="/admin/prospects" label="Gym Pipeline"     icon={UserCog}        pathname={pathname} onClose={onClose} />
                <NavLink href="/admin/audit"     label="Audit Log"        icon={ClipboardList}  pathname={pathname} onClose={onClose} />
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
