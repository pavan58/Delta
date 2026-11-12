import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const a = await requireAdmin(req);
  if ("error" in a) return NextResponse.json({ error: a.error }, { status: a.status });
  const db = a.db;
  const today = new Date().toISOString().slice(0, 10);
  const week = new Date(Date.now() - 7 * 864e5).toISOString();
  const count = async (t: string, filter?: { col: string; op: "gte" | "eq"; val: string }) => {
    let q = db.from(t).select("*", { count: "exact", head: true });
    if (filter) q = filter.op === "gte" ? q.gte(filter.col, filter.val) : q.eq(filter.col, filter.val);
    const { count: c } = await q;
    return c ?? 0;
  };
  const [users, sessions, sessionsWeek, interviews, ielts, activeToday] = await Promise.all([
    count("user_profiles"), count("speaking_sessions"), count("speaking_sessions", { col: "created_at", op: "gte", val: week }),
    count("interview_sessions"), count("ielts_attempts"), count("daily_scores", { col: "date", op: "eq", val: today }),
  ]);
  const { data: usage } = await db.from("ai_usage_logs").select("created_at, task, model, input_tokens, output_tokens, est_cost_usd, user_key").gte("created_at", week).limit(5000);
  const u = usage ?? [];
  const todayUsage = u.filter((x) => String(x.created_at) >= today);
  const sum = (xs: typeof u, k: "est_cost_usd" | "input_tokens" | "output_tokens") => xs.reduce((s, x) => s + Number(x[k] ?? 0), 0);
  const byTask: Record<string, number> = {};
  for (const x of u) byTask[String(x.task)] = (byTask[String(x.task)] ?? 0) + 1;
  const { data: feedback } = await db.from("app_feedback").select("id, created_at, message, rating, page, status").order("created_at", { ascending: false }).limit(50);
  return NextResponse.json({
    users, sessions, sessionsWeek, interviews, ielts, activeToday,
    ai: {
      requestsToday: todayUsage.length, requestsWeek: u.length, costToday: sum(todayUsage, "est_cost_usd"), costWeek: sum(u, "est_cost_usd"),
      tokensWeek: sum(u, "input_tokens") + sum(u, "output_tokens"), userKeyShare: u.length ? u.filter((x) => x.user_key).length / u.length : 0, byTask,
    },
    feedback: feedback ?? [],
  });
}
