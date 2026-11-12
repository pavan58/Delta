import { NextResponse } from "next/server";
import { z } from "zod";
import { adminClient, userFromRequest } from "@/lib/supabase/server";
import { checkRate } from "@/lib/ai/limits";

export const runtime = "nodejs";

const Body = z.object({ message: z.string().trim().min(3).max(2000), rating: z.number().int().min(1).max(5).optional(), page: z.string().max(100).optional() });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please write a short message (3–2000 characters)." }, { status: 400 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  if (!checkRate(`fb:${ip}`, 3)) return NextResponse.json({ error: "Too many messages. Try again in a minute." }, { status: 429 });
  const db = adminClient();
  if (!db) return NextResponse.json({ error: "Feedback storage is not configured on this installation." }, { status: 503 });
  const user = await userFromRequest(req);
  const { error } = await db.from("app_feedback").insert({ ...parsed.data, user_id: user?.id ?? null });
  if (error) return NextResponse.json({ error: "Could not save feedback." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  const { requireAdmin } = await import("@/lib/supabase/server");
  const a = await requireAdmin(req);
  if ("error" in a) return NextResponse.json({ error: a.error }, { status: a.status });
  const body = z.object({ id: z.string().uuid(), status: z.enum(["new", "reviewed", "resolved"]) }).safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid." }, { status: 400 });
  const { error } = await a.db.from("app_feedback").update({ status: body.data.status }).eq("id", body.data.id);
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ ok: true });
}
