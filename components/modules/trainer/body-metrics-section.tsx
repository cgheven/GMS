"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity, Plus, AlertTriangle, CheckCircle2, X, Clock, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { toast } from "@/hooks/use-toast";
import { formatDate, formatDateInput } from "@/lib/utils";
import { logBodyMetric, deleteBodyMetric, skipMetricWeek, undoMetricSkip } from "@/app/actions/trainer";
import type { BodyMetric, MetricSkip } from "@/types";

interface Props {
  memberId: string;
  metrics: BodyMetric[];
  skips: MetricSkip[];
}

// ── Common fields only — keep it simple ──────────────────────────────────────

type CommonKey = "weight_kg" | "body_fat_percentage" | "chest_cm" | "waist_cm" | "hips_cm" | "bicep_cm" | "thigh_l_cm";

const COMMON_FIELDS: { key: CommonKey; label: string; unit: string }[] = [
  { key: "weight_kg",            label: "Weight",   unit: "kg" },
  { key: "body_fat_percentage",  label: "Body Fat", unit: "%"  },
  { key: "chest_cm",             label: "Chest",    unit: "cm" },
  { key: "waist_cm",             label: "Waist",    unit: "cm" },
  { key: "hips_cm",              label: "Hips",     unit: "cm" },
  { key: "bicep_cm",             label: "Bicep",    unit: "cm" },
  { key: "thigh_l_cm",           label: "Thigh",    unit: "cm" },
];

// ── Week math ────────────────────────────────────────────────────────────────

function startOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const out = new Date(d);
  out.setDate(d.getDate() + diff);
  out.setHours(0, 0, 0, 0);
  return out;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(d.getDate() + n);
  return out;
}

function weeksBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (7 * 86400000));
}

type WeekStatus = "logged" | "missing" | "skipped" | "current" | "future";
interface WeekCell { weekStart: string; label: string; status: WeekStatus; metric?: BodyMetric; skip?: MetricSkip; }

function buildTimeline(metrics: BodyMetric[], skips: MetricSkip[], weeks = 12): WeekCell[] {
  if (metrics.length === 0) return [];
  const oldest = metrics[metrics.length - 1].measurement_date;
  const baseline = startOfWeek(new Date(oldest));
  const today = new Date();
  const currentWeekStart = startOfWeek(today);

  const totalWeeks = weeksBetween(baseline, currentWeekStart) + 1;
  const startIdx = Math.max(0, totalWeeks - weeks);

  const metricByWeek = new Map<string, BodyMetric>();
  for (const m of metrics) {
    const wk = formatDateInput(startOfWeek(new Date(m.measurement_date)));
    if (!metricByWeek.has(wk)) metricByWeek.set(wk, m);
  }
  const skipByWeek = new Map<string, MetricSkip>();
  for (const s of skips) skipByWeek.set(s.week_start, s);

  const cells: WeekCell[] = [];
  for (let i = startIdx; i < totalWeeks; i++) {
    const wkDate = addDays(baseline, i * 7);
    const wkKey = formatDateInput(wkDate);
    const isCurrent = wkKey === formatDateInput(currentWeekStart);
    const metric = metricByWeek.get(wkKey);
    const skip = skipByWeek.get(wkKey);

    let status: WeekStatus;
    if (metric)         status = "logged";
    else if (skip)      status = "skipped";
    else if (isCurrent) status = "current";
    else                status = "missing";

    const label = wkDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    cells.push({ weekStart: wkKey, label, status, metric, skip });
  }
  return cells;
}

// ── Sparkline ────────────────────────────────────────────────────────────────

function MiniSpark({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const w = 60, h = 16;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-4 stroke-primary/70" preserveAspectRatio="none">
    <polyline fill="none" strokeWidth="1.5" points={points} />
  </svg>;
}

function getValue(m: BodyMetric, key: string): number | null {
  if (key in m) {
    const v = (m as unknown as Record<string, unknown>)[key];
    return typeof v === "number" ? v : null;
  }
  const c = m.custom_metrics;
  if (c && typeof c === "object" && key in c) {
    const v = c[key];
    return typeof v === "number" ? v : null;
  }
  return null;
}

// ── Main section ─────────────────────────────────────────────────────────────

export function BodyMetricsSection({ memberId, metrics, skips }: Props) {
  const router = useRouter();
  const [logOpen, setLogOpen] = useState(false);
  const [skipTarget, setSkipTarget] = useState<string | null>(null);
  const [actionMenuFor, setActionMenuFor] = useState<string | null>(null);

  const timeline = useMemo(() => buildTimeline(metrics, skips), [metrics, skips]);
  const latest = metrics[0];

  const lastDays = latest ? Math.floor((Date.now() - new Date(latest.measurement_date).getTime()) / 86400000) : null;
  const stale = lastDays != null && lastDays > 7;

  const missingCount = timeline.filter((c) => c.status === "missing").length;

  // All custom metric keys ever recorded (so we render cards for them too)
  const customKeys = useMemo(() => {
    const set = new Set<string>();
    for (const m of metrics) {
      if (m.custom_metrics) for (const k of Object.keys(m.custom_metrics)) set.add(k);
    }
    return Array.from(set);
  }, [metrics]);

  function refresh() { router.refresh(); }

  async function handleSkip(weekStart: string, reason?: string) {
    const res = await skipMetricWeek(memberId, weekStart, reason);
    if (res.error) toast({ title: "Error", description: res.error, variant: "destructive" });
    else { toast({ title: "Week marked as skipped" }); setActionMenuFor(null); setSkipTarget(null); refresh(); }
  }

  async function handleUndoSkip(weekStart: string) {
    const res = await undoMetricSkip(memberId, weekStart);
    if (res.error) toast({ title: "Error", description: res.error, variant: "destructive" });
    else { toast({ title: "Skip removed" }); refresh(); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Body Metrics</h3>
          {missingCount > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <AlertTriangle className="w-2.5 h-2.5" /> {missingCount} missing
            </span>
          )}
        </div>
        <Button size="sm" onClick={() => setLogOpen(true)} className="gap-1.5 h-8">
          <Plus className="w-3.5 h-3.5" /> Log
        </Button>
      </div>

      {stale && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.04] px-3 py-2">
          <Clock className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-400">Last measurement was {lastDays} days ago — log a new entry to keep tracking on schedule.</p>
        </div>
      )}

      {metrics.length === 0 ? (
        <div className="rounded-xl border border-dashed border-sidebar-border bg-card/50 py-8 flex flex-col items-center gap-2 text-muted-foreground">
          <Activity className="w-7 h-7 opacity-30" />
          <p className="text-sm">No measurements logged yet</p>
          <p className="text-xs">Log baseline to start weekly tracking</p>
          <Button size="sm" variant="outline" onClick={() => setLogOpen(true)} className="mt-1 gap-1.5">
            <Plus className="w-3.5 h-3.5" /> First Measurement
          </Button>
        </div>
      ) : (
        <>
          {/* Weekly timeline */}
          <div className="rounded-xl border border-sidebar-border bg-card p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Weekly Tracking</p>
              <p className="text-[11px] text-muted-foreground">
                {timeline.filter((c) => c.status === "logged").length} logged · {missingCount} missed · {timeline.filter((c) => c.status === "skipped").length} skipped
              </p>
            </div>
            <div className="flex gap-1 overflow-x-auto pb-1">
              {timeline.map((c) => {
                const cls = c.status === "logged"  ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25"
                          : c.status === "missing" ? "bg-rose-500/10 border-rose-500/25 text-rose-400 hover:bg-rose-500/20"
                          : c.status === "skipped" ? "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"
                          : c.status === "current" ? "bg-primary/10 border-primary/30 text-primary hover:bg-primary/20"
                          : "bg-transparent border-sidebar-border/40 text-muted-foreground/40";
                return (
                  <div key={c.weekStart} className="relative">
                    <button
                      type="button"
                      onClick={() => setActionMenuFor(actionMenuFor === c.weekStart ? null : c.weekStart)}
                      title={`Week of ${c.label}${c.skip?.reason ? ` — ${c.skip.reason}` : ""}`}
                      className={`flex flex-col items-center justify-center px-2.5 py-2 rounded-lg border text-[10px] font-medium transition-colors min-w-[58px] ${cls}`}
                    >
                      <span className="text-[10px] opacity-80">{c.label}</span>
                      <span className="text-xs mt-0.5">
                        {c.status === "logged"  ? "✓"  :
                         c.status === "missing" ? "·"  :
                         c.status === "skipped" ? "—"  :
                         c.status === "current" ? "•"  : ""}
                      </span>
                    </button>
                    {actionMenuFor === c.weekStart && (
                      <div className="absolute z-50 top-full mt-1 left-1/2 -translate-x-1/2 rounded-lg border border-sidebar-border bg-popover shadow-xl py-1 min-w-[140px]">
                        {c.status === "missing" && (
                          <>
                            <button onClick={() => { setLogOpen(true); setActionMenuFor(null); }}
                              className="w-full px-3 py-1.5 text-xs text-left hover:bg-white/5 flex items-center gap-2">
                              <Plus className="w-3 h-3" /> Log now
                            </button>
                            <button onClick={() => setSkipTarget(c.weekStart)}
                              className="w-full px-3 py-1.5 text-xs text-left hover:bg-white/5 flex items-center gap-2">
                              <X className="w-3 h-3" /> Mark as skipped
                            </button>
                          </>
                        )}
                        {c.status === "skipped" && (
                          <button onClick={() => handleUndoSkip(c.weekStart)}
                            className="w-full px-3 py-1.5 text-xs text-left hover:bg-white/5 flex items-center gap-2">
                            <CheckCircle2 className="w-3 h-3" /> Undo skip
                          </button>
                        )}
                        {c.status === "logged" && c.metric && (
                          <button onClick={async () => {
                            if (!confirm("Delete this measurement?")) return;
                            const res = await deleteBodyMetric(c.metric!.id, memberId);
                            if (res.error) toast({ title: "Error", description: res.error, variant: "destructive" });
                            else { toast({ title: "Measurement deleted" }); refresh(); }
                            setActionMenuFor(null);
                          }}
                            className="w-full px-3 py-1.5 text-xs text-left hover:bg-white/5 text-rose-400 flex items-center gap-2">
                            <Trash2 className="w-3 h-3" /> Delete entry
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              <span className="text-emerald-400">●</span> Logged · <span className="text-rose-400">●</span> Missed · <span className="text-muted-foreground">●</span> Skipped · <span className="text-primary">●</span> This week
            </p>
          </div>

          {/* Latest values + per-metric trends — common + custom */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {COMMON_FIELDS.filter((m) => metrics.some((x) => getValue(x, m.key) != null)).map((m) => (
              <MetricCard key={m.key} label={m.label} unit={m.unit} field={m.key} metrics={metrics} />
            ))}
            {customKeys.map((k) => (
              <MetricCard key={k} label={k} unit="" field={k} metrics={metrics} custom />
            ))}
          </div>
        </>
      )}

      {logOpen && (
        <LogMeasurementDialog
          memberId={memberId}
          latest={latest}
          onClose={() => setLogOpen(false)}
          onSaved={() => { setLogOpen(false); refresh(); }}
        />
      )}

      {skipTarget && (
        <SkipReasonDialog
          weekStart={skipTarget}
          onConfirm={(reason) => handleSkip(skipTarget, reason)}
          onClose={() => setSkipTarget(null)}
        />
      )}
    </div>
  );
}

// ── Metric card ──────────────────────────────────────────────────────────────

function MetricCard({ label, unit, field, metrics, custom }: { label: string; unit: string; field: string; metrics: BodyMetric[]; custom?: boolean }) {
  const series = metrics.map((m) => getValue(m, field)).filter((v): v is number => typeof v === "number").reverse();
  if (series.length === 0) return null;
  const current = series[series.length - 1];
  const baseline = series[0];
  const delta = current - baseline;
  const deltaSign = delta > 0 ? "+" : "";
  return (
    <div className={`rounded-lg border p-2.5 ${custom ? "border-primary/15 bg-primary/[0.03]" : "border-sidebar-border bg-card/50"}`}>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider truncate">{label}</p>
      <p className="text-base font-bold text-foreground mt-0.5">
        {current} <span className="text-[10px] font-normal text-muted-foreground">{unit}</span>
      </p>
      {delta !== 0 && (
        <p className={`text-[10px] font-medium ${delta < 0 ? "text-emerald-400" : "text-amber-400"}`}>
          {deltaSign}{delta.toFixed(1)} {unit} since first
        </p>
      )}
      <div className="mt-1"><MiniSpark values={series} /></div>
    </div>
  );
}

// ── Log measurement dialog (simple) ──────────────────────────────────────────

function LogMeasurementDialog({ memberId, latest, onClose, onSaved }: {
  memberId: string;
  latest?: BodyMetric;
  onClose: () => void;
  onSaved: () => void;
}) {
  const today = formatDateInput(new Date());
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    if (latest) {
      for (const f of COMMON_FIELDS) {
        const v = getValue(latest, f.key);
        if (v != null) out[f.key] = String(v);
      }
    }
    return out;
  });

  // Custom fields the trainer is adding now
  const [customFields, setCustomFields] = useState<{ name: string; value: string }[]>(() => {
    if (!latest?.custom_metrics) return [];
    return Object.entries(latest.custom_metrics).map(([name, value]) => ({
      name,
      value: typeof value === "number" ? String(value) : "",
    }));
  });

  function setField(key: string, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  function addCustom() {
    setCustomFields((prev) => [...prev, { name: "", value: "" }]);
  }

  function updateCustom(idx: number, field: "name" | "value", v: string) {
    setCustomFields((prev) => prev.map((c, i) => i === idx ? { ...c, [field]: v } : c));
  }

  function removeCustom(idx: number) {
    setCustomFields((prev) => prev.filter((_, i) => i !== idx));
  }

  async function save() {
    setSaving(true);

    const payload: Parameters<typeof logBodyMetric>[1] = { measurement_date: date };
    for (const f of COMMON_FIELDS) {
      const raw = values[f.key];
      const num = raw && !isNaN(parseFloat(raw)) ? parseFloat(raw) : null;
      (payload as Record<string, unknown>)[f.key] = num;
    }

    const customMap: Record<string, number> = {};
    for (const c of customFields) {
      const name = c.name.trim();
      const num = c.value && !isNaN(parseFloat(c.value)) ? parseFloat(c.value) : null;
      if (name && num != null) customMap[name] = num;
    }
    payload.custom_metrics = customMap;
    if (notes) payload.notes = notes;

    const res = await logBodyMetric(memberId, payload);
    setSaving(false);
    if (res.error) {
      toast({ title: "Error", description: res.error, variant: "destructive" });
      return;
    }
    toast({ title: "Measurement logged" });
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Log Measurements</DialogTitle>
          <p className="text-xs text-muted-foreground">Fill what you measured today. Empty fields are skipped.</p>
        </DialogHeader>
        <div className="py-2 max-h-[65vh] overflow-y-auto pr-1 space-y-4">
          <div className="space-y-1.5 max-w-xs">
            <Label>Date</Label>
            <DatePicker value={date} onChange={setDate} maxDate={new Date()} />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {COMMON_FIELDS.map((f) => (
              <div key={f.key} className="space-y-1">
                <Label className="text-[11px]">{f.label} {f.unit && <span className="text-muted-foreground/60 font-normal">({f.unit})</span>}</Label>
                <Input type="number" inputMode="decimal" placeholder="—" value={values[f.key] ?? ""}
                  onChange={(e) => setField(f.key, e.target.value)} className="h-9" />
              </div>
            ))}
          </div>

          {/* Custom fields */}
          <div className="space-y-2 pt-1 border-t border-sidebar-border/60">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Custom</p>
              <button type="button" onClick={addCustom}
                className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
                <Plus className="w-3 h-3" /> Add field
              </button>
            </div>
            {customFields.length === 0 && (
              <p className="text-[11px] text-muted-foreground/70">e.g. Right Calf, Forearm, Resting HR — anything not in the list above</p>
            )}
            {customFields.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input placeholder="Name (e.g. Right Calf)" value={c.name}
                  onChange={(e) => updateCustom(i, "name", e.target.value)} className="h-9 flex-1" />
                <Input type="number" inputMode="decimal" placeholder="Value" value={c.value}
                  onChange={(e) => updateCustom(i, "value", e.target.value)} className="h-9 w-24" />
                <button type="button" onClick={() => removeCustom(i)}
                  className="p-1.5 rounded text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input placeholder="Optional" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Skip reason dialog ───────────────────────────────────────────────────────

const SKIP_PRESETS = ["Vacation", "Illness", "Member unavailable", "Holiday", "Other"];

function SkipReasonDialog({ weekStart, onConfirm, onClose }: { weekStart: string; onConfirm: (reason?: string) => void; onClose: () => void }) {
  const [reason, setReason] = useState("");

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Mark Week as Skipped</DialogTitle>
          <p className="text-xs text-muted-foreground">Week of {formatDate(weekStart)}</p>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="flex flex-wrap gap-1.5">
            {SKIP_PRESETS.map((p) => (
              <button key={p} type="button" onClick={() => setReason(p)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  reason === p
                    ? "bg-primary/15 border-primary/30 text-primary"
                    : "bg-white/[0.03] border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"
                }`}>{p}</button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label>Reason (optional)</Label>
            <Input placeholder="Custom reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onConfirm(reason || undefined)}>Mark Skipped</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
