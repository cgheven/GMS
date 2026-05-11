import type { StaffRole } from "@/types";

/**
 * Granular permission catalog for Pulse RBAC.
 *
 * Permissions are an additive layer ON TOP of the existing role enum.
 * Owners bypass these checks entirely (handled via requireOwner /
 * getAuthContext). Trainers continue to use the legacy can_add_members
 * boolean + getTrainerContext flow; if a trainer has an empty
 * permissions array we fall back to existing behavior.
 *
 * Keep keys in dot.notation: <resource>.<action>.
 */
export const PERMISSIONS = {
  // Members
  "members.view_all":     "View all members in the gym",
  "members.add":          "Add new members",
  "members.edit":         "Edit member details",
  "members.delete":       "Delete members",
  "members.freeze":       "Freeze/unfreeze/hold members",

  // Leads
  "leads.view":           "View lead pipeline",
  "leads.add":            "Add new leads",
  "leads.update":         "Update lead status / convert to member",

  // Payments
  "payments.view":        "View payment history",
  "payments.create":      "Receive payments",
  "payments.refund":      "Refund / waive payments",

  // Check-ins
  "checkins.record":      "Record manual check-ins",

  // Reports / Financials
  "reports.view":         "View reports + analytics",
  "financials.view":      "View profit/loss / financial KPIs",
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

/**
 * Default permissions granted when a staff member is created with a
 * given role. UIs can use this as the starting checkbox state in the
 * staff editor; it is NOT enforced server-side (the source of truth
 * is whatever lives in pulse_staff.permissions).
 */
export const ROLE_DEFAULTS: Record<StaffRole, PermissionKey[]> = {
  trainer:   [],  // trainers use existing flow + can_add_members; no new perms by default
  manager:   [
    "members.view_all", "members.add", "members.edit", "members.delete", "members.freeze",
    "leads.view", "leads.add", "leads.update",
    "payments.view", "payments.create",
    "checkins.record",
    // NOTE: reports.view + financials.view intentionally NOT in defaults — those
    // pages are owner-only by design. Owner can grant manually if needed.
  ],
  frontdesk: [
    "members.view_all", "members.add", "members.edit",
    "leads.view", "leads.add", "leads.update",
    "payments.view", "payments.create",
    "checkins.record",
  ],
  cleaner:   ["checkins.record"],  // kiosk-style use only
  guard:     ["checkins.record"],
  cook:      [],
  other:     [],
};

/**
 * Grouping for the permission editor UI. Order of groups + keys here
 * determines display order.
 */
export const PERMISSION_GROUPS: { label: string; keys: PermissionKey[] }[] = [
  { label: "Members",   keys: ["members.view_all", "members.add", "members.edit", "members.delete", "members.freeze"] },
  { label: "Leads",     keys: ["leads.view", "leads.add", "leads.update"] },
  { label: "Payments",  keys: ["payments.view", "payments.create", "payments.refund"] },
  { label: "Check-ins", keys: ["checkins.record"] },
  { label: "Analytics", keys: ["reports.view", "financials.view"] },
];

/**
 * Pure check — does this permission array include the given key?
 */
export function hasPermission(perms: string[] | null | undefined, key: PermissionKey): boolean {
  return Array.isArray(perms) && perms.includes(key);
}

/**
 * Returns the default permission set for a given staff role.
 */
export function permissionsForRole(role: StaffRole): PermissionKey[] {
  return ROLE_DEFAULTS[role] ?? [];
}

// NOTE: the server-side `checkStaffPermission` helper now lives in
// `lib/permissions-server.ts` so this module stays free of next/headers
// imports (which would break client components that read PERMISSIONS).
