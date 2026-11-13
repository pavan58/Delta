/**
 * Daily Needs vocabulary plan: a daily target (default 50) of NEW words,
 * picked from words the learner has not learned yet, mixed across the
 * selected topics. Learned words get a spaced-repetition card for review.
 */
import { DAILY_CATEGORIES, DAILY_WORDS } from "@/content/vocabulary/daily-needs";
import type { AppState } from "@/lib/store/types";
import { addDays, localDate } from "@/lib/utils";

export const DAILY_GOALS = [10, 20, 30, 50, 100];

export function pickDailyIds(learned: Set<string>, goal: number, categories: string[], date: string, keep: string[] = []): string[] {
  const cats = (categories.length ? DAILY_CATEGORIES.filter((c) => categories.includes(c.id)) : DAILY_CATEGORIES).map((c) => c.id);
  // Rotate the topic order every day so each day starts with a different topic.
  const dayNo = Math.floor(new Date(date + "T00:00:00").getTime() / 864e5);
  const order = cats.map((_, i) => cats[(i + dayNo) % cats.length]);
  const pools = order.map((c) => DAILY_WORDS.filter((w) => w.category === c && !learned.has(w.id) && !keep.includes(w.id)).map((w) => w.id));
  const out = [...keep];
  let added = true;
  while (out.length < goal && added) {
    added = false;
    for (const pool of pools) {
      if (out.length >= goal) break;
      const next = pool.shift();
      if (next) {
        out.push(next);
        added = true;
      }
    }
  }
  return out;
}

/** Returns today's plan, creating or refreshing it when the day, goal or topics changed. */
export function ensureDailyPlan(s: AppState, today = localDate()): AppState["dailyWords"] {
  const goal = s.settings.dailyGoal || 50;
  const learned = new Set(s.learnedWords);
  const cur = s.dailyWords;
  if (cur && cur.date === today) {
    // Keep what was learned today; top up or trim to the current goal.
    const kept = cur.ids.filter((id) => cur.learned.includes(id) || cur.ids.indexOf(id) < goal);
    if (kept.length === goal || (kept.length >= goal && cur.learned.length >= goal)) return { ...cur, ids: kept };
    const ids = pickDailyIds(learned, Math.max(goal, cur.learned.length), s.settings.dailyCategories, today, kept.slice(0, Math.max(goal, cur.learned.length)));
    return { ...cur, ids };
  }
  return { date: today, ids: pickDailyIds(learned, goal, s.settings.dailyCategories, today), learned: [] };
}

export function remainingNewWords(s: Pick<AppState, "learnedWords">) {
  const learned = new Set(s.learnedWords);
  return DAILY_WORDS.filter((w) => !learned.has(w.id)).length;
}

export function markLearned(s: AppState, id: string, today = localDate()): AppState {
  const plan = s.dailyWords && s.dailyWords.date === today ? s.dailyWords : ensureDailyPlan(s, today)!;
  if (plan.learned.includes(id)) return s;
  return {
    ...s,
    dailyWords: { ...plan, learned: [...plan.learned, id] },
    learnedWords: s.learnedWords.includes(id) ? s.learnedWords : [...s.learnedWords, id],
    // First spaced review tomorrow.
    vocab: s.vocab[id] ? s.vocab[id].box ? s.vocab : { ...s.vocab, [id]: { ...s.vocab[id], box: 1, due: addDays(today, 1) } } : { ...s.vocab, [id]: { box: 1, due: addDays(today, 1), correct: 1, wrong: 0, savedAt: new Date().toISOString() } },
  };
}
