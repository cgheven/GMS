import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ timestamp: new Date().toISOString() }, { status: 200 });
}
