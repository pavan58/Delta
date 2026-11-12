import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/server";
import { CONTENT_SCHEMAS, CONTENT_TABLES, type ContentTable } from "@/lib/admin/schemas";

export const runtime = "nodejs";

function tableFrom(req: Request): ContentTable | null {
  const t = new URL(req.url).searchParams.get("table");
  return t && (CONTENT_TABLES as string[]).includes(t) ? (t as ContentTable) : null;
}

export async function GET(req: Request) {
  const a = await requireAdmin(req);
  if ("error" in a) return NextResponse.json({ error: a.error }, { status: a.status });
  const table = tableFrom(req);
  if (!table) return NextResponse.json({ error: "Unknown table." }, { status: 400 });
  const { data, error } = await a.db.from(table).select("*").order("created_at", { ascending: false }).limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data });
}

export async function POST(req: Request) {
  const a = await requireAdmin(req);
  if ("error" in a) return NextResponse.json({ error: a.error }, { status: a.status });
  const table = tableFrom(req);
  if (!table) return NextResponse.json({ error: "Unknown table." }, { status: 400 });
  const parsed = CONTENT_SCHEMAS[table].safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid data: " + parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ") }, { status: 400 });
  const row: Record<string, unknown> = { ...parsed.data, created_by: a.user.id };
  const q = table === "daily_lessons" ? a.db.from(table).upsert(row, { onConflict: "day" }) : a.db.from(table).insert(row);
  const { data, error } = await q.select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ row: data });
}

export async function DELETE(req: Request) {
  const a = await requireAdmin(req);
  if ("error" in a) return NextResponse.json({ error: a.error }, { status: a.status });
  const table = tableFrom(req);
  const id = new URL(req.url).searchParams.get("id");
  if (!table || !id || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "table and id required." }, { status: 400 });
  const { error } = await a.db.from(table).delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
