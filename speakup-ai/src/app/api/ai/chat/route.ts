import { NextResponse } from "next/server";
import { z } from "zod";
import { SYSTEM_PROMPTS, type AiTask } from "@/lib/ai/prompts";
import { AiError, complete, estimateCost, serverProvider, userProvider } from "@/lib/ai/providers";
import { checkDaily, checkRate, getAppSettings, noteUsage } from "@/lib/ai/limits";
import { adminClient, userFromRequest } from "@/lib/supabase/server";

export const runtime = "nodejs";

const Body = z.object({
  task: z.enum(["teacher", "grammar", "interview", "ielts-writing", "ielts-speaking"]),
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(6000) })).min(1).max(16),
  consent: z.literal(true),
  userKey: z.object({ provider: z.string().max(20), apiKey: z.string().max(300), model: z.string().max(80).optional() }).optional(),
});

const MAX_TOKENS: Record<AiTask, number> = { teacher: 300, grammar: 400, interview: 600, "ielts-writing": 900, "ielts-speaking": 600 };

export async function POST(req: Request) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request. AI requests need explicit consent and a valid message." }, { status: 400 });
  }
  if (body.messages[0].role !== "user") return NextResponse.json({ error: "First message must be from the learner." }, { status: 400 });

  const settings = await getAppSettings();
  if (!settings.ai_enabled) return NextResponse.json({ error: "AI features are turned off by the administrator.", fallback: true }, { status: 503 });

  const cfg = body.userKey ? userProvider(body.userKey.provider, body.userKey.apiKey, body.userKey.model) : serverProvider();
  if (!cfg) return NextResponse.json({ error: "No AI provider is configured. Free mode is active.", fallback: true }, { status: 503 });

  const user = await userFromRequest(req);
  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  const key = user ? `u:${user.id}` : `ip:${ip}`;
  if (!checkRate(key)) return NextResponse.json({ error: "Too many AI requests. Please wait a minute.", fallback: true }, { status: 429 });

  // The learner's own key is billed to them, so only the per-minute limit applies.
  if (!body.userKey) {
    const limit = user ? settings.ai_daily_limit_user : settings.ai_daily_limit_guest;
    const daily = await checkDaily(key, user?.id ?? null, limit, settings.ai_global_daily_limit);
    if (!daily.ok) return NextResponse.json({ error: `Daily AI limit reached (${limit}/day). Free-mode feedback still works.`, fallback: true }, { status: 429 });
  }

  try {
    const result = await complete(cfg, { system: SYSTEM_PROMPTS[body.task], messages: body.messages, maxTokens: MAX_TOKENS[body.task] });
    noteUsage(key);
    const db = adminClient();
    if (db) {
      await db.from("ai_usage_logs").insert({
        user_id: user?.id ?? null, task: body.task, provider: result.provider, model: result.model, input_tokens: result.inputTokens,
        output_tokens: result.outputTokens, est_cost_usd: body.userKey ? 0 : estimateCost(result.model, result.inputTokens, result.outputTokens), user_key: !!body.userKey,
      });
    }
    return NextResponse.json({ text: result.text, provider: result.provider, model: result.model });
  } catch (e) {
    const err = e instanceof AiError ? e : new AiError("AI request failed.");
    return NextResponse.json({ error: err.message, fallback: true }, { status: err.status });
  }
}
