import "server-only";

/**
 * Parsing for the inbound HikVision access-control event (DS-K1T "HTTP
 * Listening" push). The device POSTs an `AccessControllerEvent` envelope per
 * scan; this turns it into the flat shape /api/attendance/hik/<secret> stores.
 *
 * No I/O here (extracting the JSON from JSON-or-multipart is the route's job),
 * so this is pure and easy to reason about.
 */

export interface ParsedHikEvent {
  /** The device's enrolled person id (employeeNoString). "" for a door/heartbeat event. */
  employeeNo: string;
  /** Name the device enrolled for that person, if any. */
  personName: string | null;
  /** Device's monotonic event serial, for idempotency. null if absent. */
  serialNo: number | null;
  /** ISO timestamp of the scan, from the envelope's dateTime (device clock). */
  happenedAt: string;
  /** Human label for the verification method (display only). */
  eventType: string;
  /** True only when a real enrolled person was recognised (not a heartbeat / stranger). */
  isPersonAuth: boolean;
}

// HikVision minor (sub) event codes a DS-K1T emits on a person scan. Not
// exhaustive (varies by firmware); unmapped falls back to a generic label.
const SUB_EVENT_LABELS: Record<number, string> = {
  1: "Card", 38: "Fingerprint", 75: "Face", 76: "Face", 21: "Face",
};

function labelFromVerifyMode(mode: unknown): string | null {
  if (typeof mode !== "string" || !mode.trim()) return null;
  const m = mode.toLowerCase();
  if (m.includes("face")) return "Face";
  if (m.includes("fp") || m.includes("finger")) return "Fingerprint";
  if (m.includes("card")) return "Card";
  return null;
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

/**
 * Interpret a parsed HikVision envelope. null when it isn't an access-control
 * event; otherwise a flat ParsedHikEvent — heartbeat/door events come back with
 * isPersonAuth=false so the route can still stamp device liveness without storing
 * a scan.
 */
export function parseHikEvent(payload: unknown): ParsedHikEvent | null {
  if (!payload || typeof payload !== "object") return null;
  const env = payload as Record<string, unknown>;
  const ace = (env.AccessControllerEvent ?? {}) as Record<string, unknown>;

  const rawEmp = ace.employeeNoString ?? ace.employeeNo;
  const employeeNo =
    typeof rawEmp === "string" ? rawEmp.trim()
    : typeof rawEmp === "number" ? String(rawEmp)
    : "";

  const rawName = ace.name;
  const personName = typeof rawName === "string" && rawName.trim() ? rawName.trim() : null;
  const serialNo = asNumber(ace.serialNo ?? env.serialNo);

  const rawTime = env.dateTime ?? env.date_time;
  const parsedTime = typeof rawTime === "string" ? new Date(rawTime) : null;
  const happenedAt = parsedTime && !Number.isNaN(parsedTime.getTime())
    ? parsedTime.toISOString()
    : new Date().toISOString();

  const subEvent = asNumber(ace.subEventType);
  const eventType =
    labelFromVerifyMode(ace.currentVerifyMode) ??
    (subEvent !== null ? SUB_EVENT_LABELS[subEvent] : undefined) ??
    "Access";

  // "0" / "" is HikVision's "no match / stranger" marker — not an enrolled person.
  const isPersonAuth = employeeNo !== "" && employeeNo !== "0";

  return { employeeNo, personName, serialNo, happenedAt, eventType, isPersonAuth };
}

// A live door scan is stamped ~now by the device clock. An event dated far from
// now is a stored backlog flushed with a wrong clock — acknowledge (200, so the
// device drains its queue) but don't store it as today's attendance.
export const MAX_EVENT_AGE_MS = 2 * 24 * 60 * 60 * 1000;   // 2 days behind
export const MAX_EVENT_FUTURE_MS = 24 * 60 * 60 * 1000;    // 1 day ahead

export function isStaleEvent(happenedAtIso: string, now: Date = new Date()): boolean {
  const t = new Date(happenedAtIso).getTime();
  if (Number.isNaN(t)) return false; // unparseable already fell back to now upstream
  const delta = t - now.getTime();
  return delta < -MAX_EVENT_AGE_MS || delta > MAX_EVENT_FUTURE_MS;
}
