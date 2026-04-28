"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Menu, LogOut, ChevronDown, Building2, Check, Shield, Users, ClipboardList, UserCog, Zap, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createBranch } from "@/app/actions/owner-branches";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import type { Profile, Gym } from "@/types";

const ADMIN_LINKS = [
  { href: "/admin/users",     label: "User Management", icon: Users },
  { href: "/admin/gyms",      label: "Gyms",            icon: Building2 },
  { href: "/admin/prospects", label: "Gym Pipeline",    icon: UserCog },
  { href: "/admin/audit",     label: "Audit Log",       icon: ClipboardList },
];

interface NavbarProps {
  onMenuClick: () => void;
  profile: Profile | null;
  gym: Gym | null;
  gyms: Gym[];
  setActiveGym: (id: string) => void;
}

export function Navbar({ onMenuClick, profile, gym, gyms, setActiveGym }: NavbarProps) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [dropOpen, setDropOpen] = useState(false);
  const [gymDrop, setGymDrop] = useState(false);
  const [adminDrop, setAdminDrop] = useState(false);

  const initials = (profile?.full_name ?? profile?.email ?? "U")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const branchLimit = profile?.branch_limit ?? 1;
  const branchesUsed = gyms.length;
  const canAddBranch = branchesUsed < branchLimit;
  const showSwitcher = gyms.length > 1 || branchLimit > 1; // show dropdown if multi-branch capable

  // Add Branch dialog
  const [addOpen, setAddOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [branchForm, setBranchForm] = useState({ name: "", address: "", phone: "", email: "" });

  async function handleCreateBranch() {
    if (!branchForm.name.trim()) {
      toast({ title: "Branch name is required", variant: "destructive" });
      return;
    }
    setAdding(true);
    const res = await createBranch(branchForm);
    setAdding(false);
    if (res.error) {
      toast({ title: "Error", description: res.error, variant: "destructive" });
      return;
    }
    toast({ title: "Branch created" });
    setAddOpen(false);
    setBranchForm({ name: "", address: "", phone: "", email: "" });
    if (res.gymId) setActiveGym(res.gymId);
    router.refresh();
  }

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 px-4 sm:px-6 h-14 bg-sidebar/90 backdrop-blur-md border-b border-sidebar-border">
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Gym switcher */}
      <div className="flex items-center gap-2 min-w-0 relative">
        <div className="flex items-center justify-center w-6 h-6 rounded-md bg-primary/10 border border-primary/20 shrink-0">
          <Zap className="w-3.5 h-3.5 text-primary" />
        </div>

        {showSwitcher ? (
          <>
            <button
              onClick={() => setGymDrop((p) => !p)}
              className="flex items-center gap-1.5 font-semibold text-sm text-foreground hover:text-primary transition-colors"
            >
              <span className="truncate max-w-[140px]">{gym?.name ?? "My Gym"}</span>
              <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 shrink-0", gymDrop && "rotate-180")} />
            </button>

            {gymDrop && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setGymDrop(false)} />
                <div className="absolute left-0 top-full mt-2 w-64 z-20 rounded-xl border border-sidebar-border bg-sidebar shadow-2xl overflow-hidden animate-fade-up">
                  <div className="px-3 py-2.5 border-b border-sidebar-border flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Branches</p>
                    <span className="text-[10px] text-muted-foreground">{branchesUsed} / {branchLimit}</span>
                  </div>
                  <div className="p-1 max-h-64 overflow-y-auto">
                    {gyms.map((g) => (
                      <button
                        key={g.id}
                        onClick={() => { setActiveGym(g.id); setGymDrop(false); }}
                        className={cn(
                          "w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors text-left",
                          g.id === gym?.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                        )}
                      >
                        <div className="min-w-0 flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 shrink-0 opacity-60" />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{g.name}</p>
                            {g.total_capacity > 0 && <p className="text-xs opacity-60">{g.total_capacity} capacity</p>}
                          </div>
                        </div>
                        {g.id === gym?.id && <Check className="w-3.5 h-3.5 shrink-0" />}
                      </button>
                    ))}
                  </div>
                  <div className="p-1 border-t border-sidebar-border">
                    {canAddBranch ? (
                      <button
                        onClick={() => { setGymDrop(false); setAddOpen(true); }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-primary hover:bg-primary/10 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Branch
                      </button>
                    ) : (
                      <div className="px-3 py-2 text-[11px] text-muted-foreground/80 leading-snug">
                        Branch limit reached. Contact admin to add more.
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </>
        ) : (
          <span className="font-semibold text-sm truncate text-foreground">{gym?.name ?? "My Gym"}</span>
        )}
      </div>

      {/* Admin quick-access */}
      {profile?.is_admin && (
        <div className="relative ml-auto">
          <button
            onClick={() => setAdminDrop((p) => !p)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border",
              adminDrop
                ? "bg-primary/10 text-primary border-primary/30"
                : "text-muted-foreground border-sidebar-border hover:text-primary hover:bg-primary/5 hover:border-primary/20"
            )}
          >
            <Shield className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Admin</span>
          </button>

          {adminDrop && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setAdminDrop(false)} />
              <div className="absolute right-0 top-full mt-2 w-52 z-20 rounded-xl border border-sidebar-border bg-sidebar shadow-2xl overflow-hidden animate-fade-up">
                <div className="px-3 py-2.5 border-b border-sidebar-border">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wide flex items-center gap-1.5">
                    <Shield className="w-3 h-3" /> Admin Panel
                  </p>
                </div>
                <div className="p-1">
                  {ADMIN_LINKS.map(({ href, label, icon: Icon }) => (
                    <Link key={href} href={href} onClick={() => setAdminDrop(false)}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {label}
                    </Link>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <div className={cn("flex items-center gap-2 relative", !profile?.is_admin && "ml-auto")}>
        <button
          onClick={() => setDropOpen((p) => !p)}
          className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-white/5 transition-colors group"
        >
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/15 border border-primary/25 text-primary text-xs font-bold">
            {initials}
          </div>
          <span className="hidden sm:block text-sm text-muted-foreground group-hover:text-foreground transition-colors truncate max-w-[120px]">
            {profile?.full_name ?? profile?.email ?? "Owner"}
          </span>
          <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform duration-200", dropOpen && "rotate-180")} />
        </button>

        {dropOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setDropOpen(false)} />
            <div className="absolute right-0 top-full mt-2 w-52 z-20 rounded-xl border border-sidebar-border bg-sidebar shadow-2xl overflow-hidden animate-fade-up">
              <div className="px-4 py-3 border-b border-sidebar-border">
                <p className="text-xs font-medium text-foreground truncate">{profile?.full_name ?? "Owner"}</p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{profile?.email ?? ""}</p>
              </div>
              <div className="p-1">
                <button
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  {signingOut ? "Signing out…" : "Sign out"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Add Branch dialog */}
      <Dialog open={addOpen} onOpenChange={(o) => !o && setAddOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Branch</DialogTitle>
            <p className="text-xs text-muted-foreground">
              {branchesUsed + 1} of {branchLimit} branches after creation.
            </p>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Branch Name *</Label>
              <Input
                placeholder="e.g. Gulberg Branch"
                value={branchForm.name}
                onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input
                placeholder="Street, area, city"
                value={branchForm.address}
                onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input
                  placeholder="+92 300 0000000"
                  value={branchForm.phone}
                  onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="branch@gym.com"
                  value={branchForm.email}
                  onChange={(e) => setBranchForm({ ...branchForm, email: e.target.value })}
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              You can fill in capacity, hours and other details after creation in Settings.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateBranch} disabled={adding || !branchForm.name.trim()}>
              {adding ? "Creating…" : "Create Branch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
