import "server-only";
import { getStaffSession } from "@/lib/data";
import { hasPermission, type PermissionKey } from "@/lib/permissions";

/**
 * Server-side permission gate for non-owner staff.
 *
 * Owners DO NOT pass through this — they bypass permission checks
 * entirely (use requireOwner / getAuthContext for owner flows).
 *
 * Returns ok=false if there is no logged-in staff session OR the
 * session lacks the requested permission. Callers should branch on
 * `ok` and respond with the appropriate error/redirect.
 */
export async function checkStaffPermission(
  key: PermissionKey,
): Promise<{ ok: boolean; staffId?: string; gymId?: string }> {
  const session = await getStaffSession();
  if (!session) return { ok: false };
  if (!hasPermission(session.permissions, key)) return { ok: false };
  return { ok: true, staffId: session.staffId, gymId: session.gymId };
}
