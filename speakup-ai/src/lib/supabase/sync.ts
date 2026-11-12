"use client";
/**
 * Mirrors the local-first store to Supabase for signed-in learners.
 * - On sign-in: pull rows, merge with local guest data, then push.
 * - Afterwards: debounced upserts of collections that changed.
 * RLS guarantees every row is readable/writable only by its owner.
 * The user's own AI API key is NEVER synced.
 */
import { useEffect, useRef } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "./client";
import { useAuth } from "./auth";
import { getState, replaceState, subscribe } from "@/lib/store/store";
import type { AppState, Level, IeltsAttempt, InterviewSession, Mistake, MockTestResult, SpeakingSession } from "@/lib/store/types";
import { currentStreak, longestStreak, weeklyXp } from "@/lib/gamification";
import { avg, localDate, weekStart } from "@/lib/utils";

type Row = Record<string, unknown>;

function dailyRows(s: AppState, userId: string): Row[] {
  const byDay: Record<string, number[]> = {};
  for (const x of s.sessions) {
    const d = localDate(new Date(x.date));
    (byDay[d] ??= []).push(x.scores.overall);
  }
  return Object.entries(s.activity).map(([date, a]) => ({
    user_id: userId,
    date,
    score: byDay[date] ? Math.round(avg(byDay[date])) : null,
    minutes: a.minutes,
    sessions: a.sessions,
    xp: a.xp,
  }));
}

export function buildPayload(s: AppState, userId: string) {
  const wk = weekStart();
  return {
    user_profiles: s.profile
      ? [{
          id: userId,
          display_name: s.settings.displayName || s.profile.name,
          level: s.profile.level,
          first_language: s.profile.firstLanguage,
          goal: s.profile.goal,
          xp: s.xp,
          referral_code: s.referralCode,
          onboarded: s.profile.onboarded,
        }]
      : [],
    learning_preferences: s.profile
      ? [{
          user_id: userId,
          daily_minutes: s.profile.dailyMinutes,
          wants_ielts: s.profile.wantsIelts,
          ielts_module: s.profile.ieltsModule,
          target_band: s.profile.targetBand,
          preparing_interviews: s.profile.preparingInterviews,
          difficulty: s.profile.difficulty,
          explain_lang: s.profile.explainLang,
        }]
      : [],
    ielts_profiles: s.profile?.wantsIelts ? [{ user_id: userId, module: s.profile.ieltsModule, target_band: s.profile.targetBand }] : [],
    user_settings: [{
      user_id: userId,
      theme: s.settings.theme,
      ai_enabled: s.settings.aiEnabled,
      ai_consent: s.settings.aiConsent,
      speech_rate: s.settings.speechRate,
      recognition_lang: s.settings.recognitionLang,
      keep_recordings: s.settings.keepRecordings,
      leaderboard_opt_in: s.settings.leaderboardOptIn,
    }],
    speaking_sessions: s.sessions.slice(0, 300).map((x) => ({
      id: x.id, user_id: userId, created_at: x.date, module: x.module, prompt: x.prompt.slice(0, 1000), transcript: x.transcript.slice(0, 5000),
      input: x.input, duration_sec: Math.round(x.durationSec), overall: x.scores.overall, grammar: x.scores.grammar, fluency: x.scores.fluency,
      vocabulary: x.scores.vocabulary, pronunciation: x.scores.pronunciation, relevance: x.scores.relevance, wpm: x.scores.wpm,
    })),
    daily_scores: dailyRows(s, userId),
    grammar_mistakes: s.mistakes.map((m) => ({
      id: m.id, user_id: userId, original: m.original, corrected: m.corrected, category: m.category, reason: m.reason,
      created_at: m.createdAt, revised: m.revised, attempts: m.attempts,
    })),
    lesson_progress: Object.values(s.challenge).map((c) => ({
      user_id: userId, lesson_key: `challenge-day-${c.day}`, day: c.day, score: c.score, completed_at: c.completedAt, transcript: c.transcript.slice(0, 5000), details: c.scores,
    })),
    saved_vocabulary: Object.entries(s.vocab).map(([word_id, v]) => ({
      user_id: userId, word_id, box: v.box, due: v.due, correct: v.correct, wrong: v.wrong, saved_at: v.savedAt, learned: s.learnedWords.includes(word_id),
    })),
    ielts_attempts: s.ielts.map((a) => ({
      id: a.id, user_id: userId, created_at: a.date, module: a.module, variant: a.variant, test_id: a.testId, raw: a.raw ?? null, total: a.total ?? null, band: a.band, details: a.details ?? {}, mock: !!a.mock,
    })),
    ielts_mock_tests: s.mocks.map((m) => ({
      id: m.id, user_id: userId, created_at: m.date, variant: m.variant, listening: m.listening, reading: m.reading, writing: m.writing, speaking: m.speaking, overall: m.overall,
    })),
    interview_sessions: s.interviews.map((i) => ({
      id: i.id, user_id: userId, created_at: i.date, category: i.category, total: i.total, answers: i.answers,
    })),
    achievements: Object.entries(s.achievements).map(([achievement_id, unlocked_at]) => ({ user_id: userId, achievement_id, unlocked_at })),
    english_streaks: [{ user_id: userId, current_streak: currentStreak(s.activity), longest_streak: longestStreak(s.activity), last_active: Object.keys(s.activity).sort().pop() ?? null }],
    weekly_progress: [{
      user_id: userId, week_start: wk, xp: weeklyXp(s.activity),
      minutes: Object.entries(s.activity).filter(([d]) => d >= wk).reduce((t, [, a]) => t + a.minutes, 0),
      sessions: Object.entries(s.activity).filter(([d]) => d >= wk).reduce((t, [, a]) => t + a.sessions, 0),
    }],
    interview_reports: s.interviews.map((i) => ({
      session_id: i.id, user_id: userId, total: i.total, created_at: i.date,
      breakdown: Object.fromEntries((["communication", "grammar", "vocabulary", "relevance", "fluency", "pronunciation"] as const).map((k) => {
        const v = i.answers.map((a) => a.scores[k]).filter((x): x is number => x !== null);
        return [k, v.length ? Math.round(avg(v)) : null];
      })),
    })),
    leaderboard_entries: s.settings.leaderboardOptIn
      ? [{ user_id: userId, week_start: wk, xp: weeklyXp(s.activity), display_name: (s.settings.displayName || s.profile?.name || "Learner").slice(0, 40), streak: currentStreak(s.activity) }]
      : [],
  };
}

const CONFLICT: Record<string, string> = {
  user_profiles: "id", learning_preferences: "user_id", ielts_profiles: "user_id", interview_reports: "session_id", user_settings: "user_id", daily_scores: "user_id,date",
  lesson_progress: "user_id,lesson_key", saved_vocabulary: "user_id,word_id", achievements: "user_id,achievement_id",
  english_streaks: "user_id", weekly_progress: "user_id,week_start", leaderboard_entries: "user_id,week_start",
};

export async function pushAll(sb: SupabaseClient, s: AppState, userId: string, last?: Map<string, string>) {
  const payload = buildPayload(s, userId);
  const errors: string[] = [];
  for (const [table, rows] of Object.entries(payload)) {
    const hash = JSON.stringify(rows);
    if (last?.get(table) === hash) continue;
    if (table === "leaderboard_entries" && !s.settings.leaderboardOptIn) {
      await sb.from(table).delete().eq("user_id", userId);
      last?.set(table, hash);
      continue;
    }
    if (!rows.length) continue;
    const { error } = await sb.from(table).upsert(rows as Row[], { onConflict: CONFLICT[table] ?? "id" });
    if (error) errors.push(`${table}: ${error.message}`);
    else last?.set(table, hash);
  }
  return errors;
}

function mergeById<T extends { id: string }>(a: T[], b: T[]) {
  const map = new Map<string, T>();
  for (const x of [...b, ...a]) map.set(x.id, x);
  return [...map.values()];
}

export async function pullAndMerge(sb: SupabaseClient, userId: string): Promise<AppState> {
  const local = getState();
  const q = (t: string, col = "user_id") => sb.from(t).select("*").eq(col, userId);
  const [prof, prefs, sessions, daily, mistakes, lessons, vocab, ielts, mocks, interviews, ach] = await Promise.all([
    q("user_profiles", "id").maybeSingle(), q("learning_preferences").maybeSingle(), q("speaking_sessions").order("created_at", { ascending: false }).limit(300),
    q("daily_scores"), q("grammar_mistakes").limit(500), q("lesson_progress"), q("saved_vocabulary"), q("ielts_attempts"), q("ielts_mock_tests"), q("interview_sessions"), q("achievements"),
  ]);
  const s: AppState = { ...local };
  const p = prof.data as Row | null;
  const lp = prefs.data as Row | null;
  if (p && !local.profile?.onboarded && p.onboarded) {
    s.profile = {
      name: String(p.display_name ?? ""), level: String(p.level ?? "beginner") as Level, firstLanguage: String(p.first_language ?? ""), goal: String(p.goal ?? ""),
      dailyMinutes: Number(lp?.daily_minutes ?? 15), wantsIelts: Boolean(lp?.wants_ielts), ieltsModule: (lp?.ielts_module as "academic" | "general") ?? "academic",
      targetBand: Number(lp?.target_band ?? 6.5), preparingInterviews: Boolean(lp?.preparing_interviews), difficulty: String(lp?.difficulty ?? ""),
      explainLang: (lp?.explain_lang as "en" | "hi" | "both") ?? "en", onboarded: true, createdAt: new Date().toISOString(),
    };
  }
  if (p?.xp) s.xp = Math.max(local.xp, Number(p.xp));
  for (const d of (daily.data ?? []) as Row[]) {
    const cur = s.activity[String(d.date)];
    if (!cur || cur.xp < Number(d.xp)) s.activity = { ...s.activity, [String(d.date)]: { minutes: Number(d.minutes), xp: Number(d.xp), sessions: Number(d.sessions) } };
  }
  s.sessions = mergeById(local.sessions, ((sessions.data ?? []) as Row[]).map((r): SpeakingSession => ({
    id: String(r.id), date: String(r.created_at), module: r.module as SpeakingSession["module"], prompt: String(r.prompt ?? ""), transcript: String(r.transcript ?? ""),
    input: r.input as "voice" | "text", durationSec: Number(r.duration_sec),
    scores: { overall: Number(r.overall), grammar: Number(r.grammar), fluency: Number(r.fluency), vocabulary: Number(r.vocabulary), pronunciation: r.pronunciation === null ? null : Number(r.pronunciation), relevance: Number(r.relevance), durationSec: Number(r.duration_sec), wpm: r.wpm === null ? null : Number(r.wpm) },
  }))).sort((a, b) => b.date.localeCompare(a.date));
  s.mistakes = mergeById(local.mistakes, ((mistakes.data ?? []) as Row[]).map((r): Mistake => ({
    id: String(r.id), original: String(r.original), corrected: String(r.corrected), category: r.category as Mistake["category"], reason: String(r.reason ?? ""), createdAt: String(r.created_at), revised: Boolean(r.revised), attempts: Number(r.attempts ?? 0),
  })));
  for (const r of (lessons.data ?? []) as Row[]) {
    const day = Number(r.day);
    if (!s.challenge[day]) s.challenge = { ...s.challenge, [day]: { day, completedAt: String(r.completed_at), score: Number(r.score), transcript: String(r.transcript ?? ""), scores: r.details as never } };
  }
  for (const r of (vocab.data ?? []) as Row[]) {
    const id = String(r.word_id);
    if (!s.vocab[id]) s.vocab = { ...s.vocab, [id]: { box: Number(r.box), due: String(r.due), correct: Number(r.correct), wrong: Number(r.wrong), savedAt: String(r.saved_at) } };
    if (r.learned && !s.learnedWords.includes(id)) s.learnedWords = [...s.learnedWords, id];
  }
  s.ielts = mergeById(local.ielts, ((ielts.data ?? []) as Row[]).map((r): IeltsAttempt => ({
    id: String(r.id), date: String(r.created_at), module: r.module as IeltsAttempt["module"], variant: r.variant as "academic" | "general", testId: String(r.test_id), raw: r.raw as number | undefined, total: r.total as number | undefined, band: Number(r.band), details: r.details as Record<string, unknown>, mock: Boolean(r.mock),
  })));
  s.mocks = mergeById(local.mocks, ((mocks.data ?? []) as Row[]).map((r): MockTestResult => ({
    id: String(r.id), date: String(r.created_at), variant: r.variant as "academic" | "general", listening: r.listening as number | null, reading: r.reading as number | null, writing: r.writing as number | null, speaking: r.speaking as number | null, overall: r.overall as number | null,
  })));
  s.interviews = mergeById(local.interviews, ((interviews.data ?? []) as Row[]).map((r): InterviewSession => ({
    id: String(r.id), date: String(r.created_at), category: String(r.category), total: Number(r.total), answers: (r.answers ?? []) as InterviewSession["answers"],
  })));
  for (const r of (ach.data ?? []) as Row[]) if (!s.achievements[String(r.achievement_id)]) s.achievements = { ...s.achievements, [String(r.achievement_id)]: String(r.unlocked_at) };
  return s;
}

async function recordReferral(sb: SupabaseClient, s: AppState, userId: string) {
  if (!s.referredBy) return;
  await sb.from("referrals").upsert({ referred_user_id: userId, referrer_code: s.referredBy }, { onConflict: "referred_user_id" });
}

/** Hook used by the app shell. No-op in guest/free mode. */
export function useCloudSync() {
  const { user } = useAuth();
  const last = useRef(new Map<string, string>());
  useEffect(() => {
    const sb = getSupabase();
    if (!sb || !user) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ready = false;
    let cancelled = false;
    (async () => {
      try {
        const merged = await pullAndMerge(sb, user.id);
        if (cancelled) return;
        replaceState(merged);
        await recordReferral(sb, merged, user.id);
        await pushAll(sb, merged, user.id, last.current);
      } catch (e) {
        console.warn("Cloud sync failed; continuing with local data.", e);
      }
      ready = true;
    })();
    const unsub = subscribe(() => {
      if (!ready) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        pushAll(sb, getState(), user.id, last.current).then((errs) => errs.length && console.warn("Sync errors:", errs));
      }, 2500);
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      unsub();
    };
  }, [user]);
}
