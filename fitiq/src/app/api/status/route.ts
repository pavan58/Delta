import { NextResponse } from "next/server";
import { aiStatus } from "@/lib/ai";
import { isDemoMode } from "@/lib/server/catalog";

export function GET() {
  return NextResponse.json({ demo: isDemoMode(), ai: aiStatus(), weather: Boolean(process.env.WEATHER_API_KEY) });
}
