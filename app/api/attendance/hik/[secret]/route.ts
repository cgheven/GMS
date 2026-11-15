import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseHikEvent, isStaleEvent } from "@/lib/attendance";

export const dynamic = "force-dynamic";

/**
 * Inbound access events from a HikVision terminal ("HTTP Listening" push).
 *
 * PUBLIC by necessity: the terminal lives on the gym LAN and posts
 * server-to-server with no session, and the HikVision listening form carries no
 * auth field. The ONLY credential is the 32-hex secret in this route's path,
 * which names exactly one gym. A forged/guessed secret can at most write events
 * for that one gym — it reads nothing and reaches no other table. `/api/*` is on
 * the public middleware allowlist, so the device isn't 302'd to /login.
 *
 * ALWAYS answers 200 — a non-200 makes the device retry in a tight loop and can
 * disable its listener. Idempotency (serial-based upsert) makes retries harmless.
 *
 * A matched scan becomes a pulse_check_ins row (method "device"); an unmatched
 * employeeNo becomes a pulse_unlinked_punches row for staff to bind to a member —
 * identical to the ZKTeco device, so the check-ins page's paid/unpaid recovery
 * view covers HikVision too.
 */

const SECRET_RE = /^[0-9a-f]{32}$/;
const INT4_MAX = 2_147_483_647;

/** Extract the HikVision JSON envelope from JSON or multipart (JSON part beside
 *  the JPEG when "Save Picture When Auth" is on). null on anything unparseable. */
async function readEnvelope(req: NextRequest): Promise<unknown | null> {
  const ct = req.headers.get("content-type") ?? "";
  try {
    if (ct.includes("application/json")) return await req.json();
    if (ct.includes("multipart/form-data") || ct.includes("application/x-www-form-urlencoded")) {
      const form = await req.formData();
      for (const value of form.values()) {
        let text: string | null = null;
        if (typeof value === "string") text = value;
        else if (value && typeof (value as Blob).text === "function") {
          try { text = await (value as Blob).text(); } catch { text = null; }
        }
        if (!text) continue;
        try {
          const obj = JSON.parse(text);
          if (obj && typeof obj === "object") return obj;
        } catch {
          // Not the JSON part (e.g. image bytes) — keep scanning.
        }
      }
      return null;
    }
    const text = await req.text(); // some firmwares omit the content-type
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ secret: string }> },
) {
  try {
    const { secret } = await params;
    // Shape-check before any DB work — a junk path costs nothing and the 200 is
    // the same as success, so the endpoint is not an oracle for live secrets.
    if (!SECRET_RE.test(secret)) return NextResponse.json({ received: true });

    const admin = createAdminClient();

    // Rate limit per secret — a terminal pushes a handful/min; 240/min is generous
    // and caps forged-event flooding. Fail OPEN so a limiter hiccup never drops a
    // real device's scans.
    const { data: rlOk } = await admin.rpc("pulse_rate_hit", {
      p_bucket: `hik:${secret}`,
      p_limit: 240,
      p_window_seconds: 60,
    });
    if (rlOk === false) return NextResponse.json({ received: true });

    const { data: gym } = await admin
      .from("pulse_gyms")
      .select("id")
      .eq("hik_push_secret", secret)
      .maybeSingle();
    if (!gym) return NextResponse.json({ received: true });

    // Every POST (event or heartbeat) proves the terminal is alive. Fire-and-
    // forget, but a Supabase builder is lazy — wrap in Promise.resolve(...) so it
    // actually executes (bare `void builder` never sends the request).
    void Promise.resolve(
      admin.from("pulse_gyms").update({ hik_last_event_at: new Date().toISOString() }).eq("id", gym.id),
    ).catch((err: unknown) => console.error("[hik] last_event stamp failed:", (err as Error)?.message));

    const parsed = parseHikEvent(await readEnvelope(req));

    // Heartbeat / door-state / stranger scan: liveness stamped above, nothing stored.
    if (!parsed || !parsed.isPersonAuth) return NextResponse.json({ received: true });
    // Backlog flushed with a wrong clock — ack so the device drains, don't store.
    if (isStaleEvent(parsed.happenedAt)) return NextResponse.json({ received: true });

    // Resolve the device's enrolled id to a member (same identity as ZKTeco).
    const { data: member } = await admin
      .from("pulse_members")
      .select("id")
      .eq("gym_id", gym.id)
      .eq("device_user_id", parsed.employeeNo)
      .maybeSingle();

    if (!member) {
      // Unknown person — queue for staff to bind on the check-ins page.
      await admin.from("pulse_unlinked_punches").upsert(
        { gym_id: gym.id, device_serial: "hikvision", device_user_id: parsed.employeeNo, punched_at: parsed.happenedAt },
        { onConflict: "gym_id,device_user_id", ignoreDuplicates: false },
      );
      return NextResponse.json({ received: true });
    }

    const logSn = parsed.serialNo !== null && parsed.serialNo <= INT4_MAX ? parsed.serialNo : null;
    const { error } = await admin.from("pulse_check_ins").upsert(
      {
        gym_id: gym.id,
        member_id: member.id,
        checked_in_at: parsed.happenedAt,
        check_in_method: "device",
        device_log_sn: logSn,
      },
      { onConflict: "gym_id,device_log_sn", ignoreDuplicates: true },
    );
    if (error && error.code !== "23505") {
      console.error("[hik] check-in insert failed:", error.message);
    }
  } catch (err) {
    console.error("[hik] failed to process payload:", err);
  }

  return NextResponse.json({ received: true });
}
