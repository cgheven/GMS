"use client";
import { useState, useMemo } from "react";
import { RefreshCw, Search, ShieldCheck, User, Building2, LogIn } from "lucide-react";
import { listAuditLogs, listLoginLogs } from "@/app/actions/admin-audit";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import type { AuditLog, LoginLog } from "@/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (s < 60)    return "just now";
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function describeAction(log: AuditLog): string {
  const m = log.meta ?? {};
  switch (log.action) {
    case "user.create": return `Created user ${m.email ?? log.entity_id ?? ""}`;
    case "user.invite": return `Invited ${m.email ?? log.entity_id ?? ""}`;
    case "user.update": return `Updated user ${log.entity_id ?? ""}`;
    case "user.delete": return `Deleted user ${log.entity_id ?? ""}`;
    case "gym.create": return `Created gym "${m.name ?? log.entity_id ?? ""}"`;
    case "gym.update": return `Updated gym ${log.entity_id ?? ""}`;
    case "gym.delete": return `Deleted gym "${m.name ?? log.entity_id ?? ""}"`;
    default: return `${log.action} on ${log.entity}`;
  }
}

function actionBadge(action: string): { label: string; cls: string } {
  if (action.includes("delete")) return { label: "Delete", cls: "bg-rose-500/10 text-rose-400 border-rose-500/20" };
  if (action.includes("update")) return { label: "Update", cls: "bg-blue-500/10 text-blue-400 border-blue-500/20" };
  if (action.includes("invite")) return { label: "Invite", cls: "bg-purple-500/10 text-purple-400 border-purple-500/20" };
  return { label: "Create", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" };
}

function entityIcon(entity: string) {
  if (entity === "gym") return <Building2 className="w-3.5 h-3.5 text-muted-foreground" />;
  return <User className="w-3.5 h-3.5 text-muted-foreground" />;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  initialLogs: AuditLog[];
  initialLoginLogs: LoginLog[];
}

type Tab = "actions" | "logins";

export function AuditClient({ initialLogs, initialLoginLogs }: Props) {
  const [tab, setTab]           = useState<Tab>("actions");
  const [logs, setLogs]         = useState<AuditLog[]>(initialLogs);
  const [loginLogs, setLoginLogs] = useState<LoginLog[]>(initialLoginLogs);
  const [search, setSearch]     = useState("");
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    if (tab === "actions") {
      const { logs: fresh, error } = await listAuditLogs();
      if (error) toast({ title: "Failed to refresh", description: error, variant: "destructive" });
      else setLogs(fresh ?? []);
    } else {
      const { logs: fresh, error } = await listLoginLogs();
      if (error) toast({ title: "Failed to refresh", description: error, variant: "destructive" });
      else setLoginLogs(fresh ?? []);
    }
    setRefreshing(false);
  }

  const filteredActions = useMemo(() => {
    if (!search) return logs;
    const q = search.toLowerCase();
    return logs.filter((l) =>
      l.actor_email.toLowerCase().includes(q) ||
      l.action.toLowerCase().includes(q) ||
      describeAction(l).toLowerCase().includes(q)
    );
  }, [logs, search]);

  const filteredLogins = useMemo(() => {
    if (!search) return loginLogs;
    const q = search.toLowerCase();
    return loginLogs.filter((l) => l.email.toLowerCase().includes(q));
  }, [loginLogs, search]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-normal tracking-tight">Audit Log</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {tab === "actions"
              ? `Admin actions — ${logs.length} events recorded`
              : `Login history — ${loginLogs.length} sessions recorded`}
          </p>
        </div>
        <Button variant="outline" onClick={refresh} disabled={refreshing} className="gap-2 w-full sm:w-auto">
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-white/[0.03] border border-sidebar-border rounded-xl w-fit">
        <button
          onClick={() => { setTab("actions"); setSearch(""); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "actions"
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          Admin Actions
        </button>
        <button
          onClick={() => { setTab("logins"); setSearch(""); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "logins"
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <LogIn className="w-3.5 h-3.5" />
          Login History
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder={tab === "actions" ? "Search by admin, action…" : "Search by email…"}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Admin Actions Table */}
      {tab === "actions" && (
        <div className="rounded-2xl border border-sidebar-border bg-card overflow-hidden">
          {filteredActions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <ShieldCheck className="w-10 h-10 opacity-20" />
              <p className="text-sm font-medium">{search ? "No matching events" : "No audit events yet"}</p>
              <p className="text-xs">Actions will appear here after admins create, update, or delete records.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-sidebar-border bg-white/[0.02]">
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Time</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Admin</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Action</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Description</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 hidden lg:table-cell">Entity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sidebar-border">
                  {filteredActions.map((log) => {
                    const badge = actionBadge(log.action);
                    return (
                      <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3 shrink-0">
                          <span className="text-xs text-muted-foreground whitespace-nowrap" title={new Date(log.created_at).toLocaleString()}>
                            {timeAgo(log.created_at)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-foreground/80 font-mono truncate max-w-[160px] block">
                            {log.actor_email}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground/90 max-w-xs">
                          {describeAction(log)}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <div className="flex items-center gap-1.5">
                            {entityIcon(log.entity)}
                            <span className="text-xs text-muted-foreground capitalize">{log.entity}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Login History Table */}
      {tab === "logins" && (
        <div className="rounded-2xl border border-sidebar-border bg-card overflow-hidden">
          {filteredLogins.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <LogIn className="w-10 h-10 opacity-20" />
              <p className="text-sm font-medium">{search ? "No matching logins" : "No login events yet"}</p>
              <p className="text-xs">Login events are recorded automatically when users sign in.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-sidebar-border bg-white/[0.02]">
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Time</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">User</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Signed In At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sidebar-border">
                  {filteredLogins.map((log) => (
                    <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 shrink-0">
                        <span className="text-xs text-muted-foreground whitespace-nowrap" title={new Date(log.created_at).toLocaleString()}>
                          {timeAgo(log.created_at)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                            <User className="w-3 h-3 text-primary" />
                          </div>
                          <span className="text-xs text-foreground/80 font-mono truncate max-w-[200px]">
                            {log.email}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(log.logged_in_at).toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
