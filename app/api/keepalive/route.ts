import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = createAdminClient();
  await supabase.from("pulse_gyms").select("id").limit(1);

  return NextResponse.json({ timestamp: new Date().toISOString() }, { status: 200 });
}
