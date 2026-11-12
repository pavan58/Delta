import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/server";
import { SETTINGS_SCHEMA } from "@/lib/admin/schemas";
import { clearSettingsCache, getAppSettings } from "@/lib/ai/limits";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const a = await requireAdmin(req);
  if ("error" in a) return NextResponse.json({ error: a.error }, { status: a.status });
  clearSettingsCache();
  return NextResponse.json({ settings: await getAppSettings() });
}

export async function PUT(req: Request) {
  const a = await requireAdmin(req);
  if ("error" in a) return NextResponse.json({ error: a.error }, { status: a.status });
  const parsed = SETTINGS_SCHEMA.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid settings." }, { status: 400 });
  const { error } = await a.db.from("app_settings").upsert({ key: "global", value: parsed.data, updated_by: a.user.id, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  clearSettingsCache();
  return NextResponse.json({ ok: true });
}
