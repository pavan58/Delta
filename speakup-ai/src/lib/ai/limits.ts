import "server-only";
import { adminClient } from "@/lib/supabase/server";

export interface AppSettings {
  ai_enabled: boolean;
  ai_daily_limit_guest: number;
  ai_daily_limit_user: number;
  ai_global_daily_limit: number;
  features: Record<string, boolean>;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  ai_enabled: true,
  ai_daily_limit_guest: Number(process.env.AI_DAILY_LIMIT_GUEST ?? 10),
  ai_daily_limit_user: Number(process.env.AI_DAILY_LIMIT_USER ?? 30),
  ai_global_daily_limit: Number(process.env.AI_GLOBAL_DAILY_LIMIT ?? 2000),
  features: { foundation: true, speak: true, grammar: true, challenge: true, ielts: true, interview: true, vocabulary: true, community: true },
};

let cache: { at: number; value: AppSettings } | null = null;

export async function getAppSettings(): Promise<AppSettings> {
  if (cache && Date.now() - cache.at < 60_000) return cache.value;
  const db = adminClient();
  let value = DEFAULT_APP_SETTINGS;
  if (db) {
    const { data } = await db.from("app_settings").select("value").eq("key", "global").maybeSingle();
    if (data?.value) value = { ...DEFAULT_APP_SETTINGS, ...(data.value as Partial<AppSettings>), features: { ...DEFAULT_APP_SETTINGS.features, ...((data.value as Partial<AppSettings>).features ?? {}) } };
  }
  cache = { at: Date.now(), value };
  return value;
}

export function clearSettingsCache() {
  cache = null;
}

/* In-memory sliding window + daily counters. Best effort per server instance; durable counts come from ai_usage_logs when Supabase is configured. */
const minuteHits = new Map<string, number[]>();
const dayHits = new Map<string, { day: string; n: number }>();
let globalDay = { day: "", n: 0 };

export function checkRate(key: string, perMinute = 6): boolean {
  const now = Date.now();
  const arr = (minuteHits.get(key) ?? []).filter((t) => now - t < 60_000);
  if (arr.length >= perMinute) {
    minuteHits.set(key, arr);
    return false;
  }
  arr.push(now);
  minuteHits.set(key, arr);
  if (minuteHits.size > 5000) minuteHits.clear();
  return true;
}

export async function checkDaily(key: string, userId: string | null, limit: number, globalLimit: number): Promise<{ ok: boolean; used: number }> {
  const today = new Date().toISOString().slice(0, 10);
  if (globalDay.day !== today) globalDay = { day: today, n: 0 };
  if (globalDay.n >= globalLimit) return { ok: false, used: globalDay.n };
  let used = 0;
  const db = adminClient();
  if (db && userId) {
    const { count } = await db.from("ai_usage_logs").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", today);
    used = count ?? 0;
  } else {
    const cur = dayHits.get(key);
    used = cur && cur.day === today ? cur.n : 0;
  }
  return { ok: used < limit, used };
}

export function noteUsage(key: string) {
  const today = new Date().toISOString().slice(0, 10);
  const cur = dayHits.get(key);
  dayHits.set(key, { day: today, n: cur && cur.day === today ? cur.n + 1 : 1 });
  globalDay.n++;
}
