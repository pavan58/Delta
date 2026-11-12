import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Public weekly leaderboard: only learners who opted in, only display name + XP + streak. */
export async function GET(req: Request) {
  const week = new URL(req.url).searchParams.get("week") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) return NextResponse.json({ error: "week=yyyy-mm-dd required" }, { status: 400 });
  const db = adminClient();
  if (!db) return NextResponse.json({ configured: false, entries: [] });
  const { data, error } = await db.from("leaderboard_entries").select("display_name, xp, streak").eq("week_start", week).order("xp", { ascending: false }).limit(50);
  if (error) return NextResponse.json({ configured: true, entries: [], error: "Could not load leaderboard." }, { status: 500 });
  return NextResponse.json({ configured: true, entries: data ?? [] }, { headers: { "Cache-Control": "public, max-age=60" } });
}
