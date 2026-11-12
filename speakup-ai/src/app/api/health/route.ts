import { NextResponse } from "next/server";
export function GET() {
  return NextResponse.json({ ok: true, app: "speakup-ai", time: new Date().toISOString() });
}
