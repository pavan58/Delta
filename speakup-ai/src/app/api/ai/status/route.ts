import { NextResponse } from "next/server";
import { serverProvider } from "@/lib/ai/providers";
import { getAppSettings } from "@/lib/ai/limits";

export const runtime = "nodejs";

/** Tells the client whether server-side AI is available (never returns keys). */
export async function GET() {
  const cfg = serverProvider();
  const s = await getAppSettings();
  return NextResponse.json({
    serverAi: Boolean(cfg) && s.ai_enabled,
    provider: cfg?.provider ?? null,
    model: cfg?.model ?? null,
    aiEnabled: s.ai_enabled,
    limits: { guest: s.ai_daily_limit_guest, user: s.ai_daily_limit_user },
    features: s.features,
  });
}
