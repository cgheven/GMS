import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Max SN length matches real ZKTeco device serials (longest observed: ~20 chars; 64 is generous)
const SN_MAX_LEN = 64;
// Max body size for attendance push: 10 KB is ample for a batch of punch records
const BODY_MAX_BYTES = 10_240;

/** Return true if the string is a valid ISO-like or ZKTeco timestamp. */
function safeIso(ts: string): string | null {
  const d = new Date(ts);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// ZKTeco ADMS — device registration
// Device calls this on boot to get its sync config
export async function GET(req: NextRequest) {
  const rawSn = req.nextUrl.searchParams.get("SN") ?? "";
  // Sanitise: strip non-alphanumeric characters, cap length
  const sn = rawSn.replace(/[^A-Za-z0-9\-_]/g, "").slice(0, SN_MAX_LEN);

  console.log("[ADMS] Device registration:", sn);

  // Respond with sync config — device uses this to know how often to push
  const config = [
    `GET OPTION FROM: ${sn}`,
    "ATTLOGStamp=0",
    "OPERLOGStamp=0",
    "ATTPHOTOStamp=0",
    "ErrorDelay=30",
    "Delay=10",
    "TransTimes=00:00;23:59",
    "TransInterval=1",
    "TransFlag=TransData AttLog",
    "TimeZone=5",
    "Realtime=1",
    "Encrypt=0",
  ].join("\r\n");

  return new NextResponse(config, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

// ZKTeco ADMS — attendance push
// Device calls this every time someone scans a fingerprint/face
export async function POST(req: NextRequest) {
  const rawSn  = req.nextUrl.searchParams.get("SN")    ?? "";
  const table  = req.nextUrl.searchParams.get("table") ?? "";

  // Sanitise SN: strip non-alphanumeric characters, cap length
  const sn = rawSn.replace(/[^A-Za-z0-9\-_]/g, "").slice(0, SN_MAX_LEN);

  // Only handle attendance logs
  if (table !== "ATTLOG") {
    return new NextResponse("OK", { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  // Enforce body size limit before reading to prevent memory exhaustion
  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > BODY_MAX_BYTES) {
    console.warn("[ADMS] Oversized body rejected from SN:", sn, "size:", contentLength);
    return new NextResponse("OK", { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  const body = await req.text();

  // Double-check actual body size after reading
  if (Buffer.byteLength(body, "utf8") > BODY_MAX_BYTES) {
    console.warn("[ADMS] Oversized body (post-read) rejected from SN:", sn);
    return new NextResponse("OK", { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  // Log only the SN and line count — never the raw body (contains biometric user IDs / PII)
  const lineCount = body.trim().split("\n").filter((l) => l.trim()).length;
  console.log("[ADMS] Attendance push from", sn, "—", lineCount, "line(s)");

  // Reject empty SN — cannot look up a gym without it
  if (!sn) {
    console.warn("[ADMS] Missing SN, ignoring push");
    return new NextResponse("OK", { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  const admin = createAdminClient();

  // Look up gym by device serial number
  const { data: gym } = await admin
    .from("pulse_gyms")
    .select("id")
    .eq("device_serial", sn)
    .maybeSingle();

  if (!gym) {
    console.warn("[ADMS] Unknown device serial:", sn);
    // Still return OK so device doesn't retry endlessly
    return new NextResponse("OK", { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  // Fire-and-forget: update device_last_seen without blocking the response
  void Promise.resolve(
    admin
      .from("pulse_gyms")
      .update({ device_last_seen: new Date().toISOString() })
      .eq("id", gym.id)
  ).catch((err: unknown) => console.error("[ADMS] device_last_seen update failed:", (err as Error)?.message));

  // Parse attendance lines
  // Format per line: user_id\ttimestamp\tverify_type\tin_out_status\t\twork_code\t0
  const lines = body.trim().split("\n").filter((l) => l.trim());
  const rows: {
    gym_id: string;
    member_id: string;
    checked_in_at: string;
    check_in_method: string;
    device_log_sn: number | null;
  }[] = [];

  // Load all device-mapped members for this gym once
  const { data: members } = await admin
    .from("pulse_members")
    .select("id, device_user_id")
    .eq("gym_id", gym.id)
    .not("device_user_id", "is", null);

  const memberMap = new Map<string, string>(
    (members ?? []).map((m: { id: string; device_user_id: string }) => [m.device_user_id, m.id])
  );

  for (const line of lines) {
    const parts = line.split("\t");
    const userId    = parts[0]?.trim();
    const timestamp = parts[1]?.trim();
    const snStr     = parts[4]?.trim();

    if (!userId || !timestamp) continue;

    // Validate timestamp — skip the line rather than crashing if the device sends garbage
    const checkedInAt = safeIso(timestamp);
    if (!checkedInAt) {
      console.warn("[ADMS] Invalid timestamp in line, skipping:", timestamp?.slice(0, 30));
      continue;
    }

    const memberId = memberMap.get(userId);
    // device_log_sn is an INT4 column (max 2,147,483,647). Use null when absent;
    // the unique constraint covers (gym_id, device_log_sn) so null rows are always inserted.
    const logSn = snStr && !isNaN(Number(snStr)) && Number(snStr) <= 2_147_483_647
      ? Number(snStr)
      : null;

    if (!memberId) {
      // Unknown device user — save for staff to complete registration
      await admin
        .from("pulse_unlinked_punches")
        .upsert(
          { gym_id: gym.id, device_serial: sn, device_user_id: userId, punched_at: checkedInAt },
          { onConflict: "gym_id,device_user_id", ignoreDuplicates: false }
        );
      console.log("[ADMS] Unlinked punch saved for device user:", userId);
      continue;
    }

    rows.push({
      gym_id:          gym.id,
      member_id:       memberId,
      checked_in_at:   checkedInAt,
      check_in_method: "device",
      device_log_sn:   logSn,
    });
  }

  if (rows.length > 0) {
    const { error } = await admin
      .from("pulse_check_ins")
      .upsert(rows, { onConflict: "gym_id,device_log_sn", ignoreDuplicates: true });

    if (error) console.error("[ADMS] Insert error:", error.message);
    else console.log(`[ADMS] Saved ${rows.length} check-in(s) for gym ${gym.id}`);
  }

  // Device expects plain "OK" — anything else causes it to retry
  return new NextResponse("OK", { status: 200, headers: { "Content-Type": "text/plain" } });
}
