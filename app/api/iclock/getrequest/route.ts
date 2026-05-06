import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Max SN length matches real ZKTeco device serials (longest observed: ~20 chars; 64 is generous)
const SN_MAX_LEN = 64;

// Device polls this for pending commands — return config so device knows sync settings
export async function GET(req: NextRequest) {
  const rawSn = req.nextUrl.searchParams.get("SN") ?? "";
  // Sanitise: strip non-alphanumeric characters, cap length
  const sn = rawSn.replace(/[^A-Za-z0-9\-_]/g, "").slice(0, SN_MAX_LEN);

  // Fire-and-forget: update device_last_seen without blocking the response
  if (sn) {
    const admin = createAdminClient();
    void Promise.resolve(
      admin
        .from("pulse_gyms")
        .update({ device_last_seen: new Date().toISOString() })
        .eq("device_serial", sn)
    ).catch((err: unknown) => console.error("[ADMS] device_last_seen update failed:", (err as Error)?.message));
  }

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
