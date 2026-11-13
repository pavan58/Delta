import { describe, it, expect } from "vitest";
import { currentStreak, longestStreak, level, newlyUnlocked } from "@/lib/gamification";
import { initialState } from "@/lib/store/store";
import { progressSummary } from "@/lib/scoring/progress";

const act = (days: string[]) => Object.fromEntries(days.map((d) => [d, { minutes: 5, xp: 20, sessions: 1 }]));

describe("streaks", () => {
  it("counts consecutive days ending today or yesterday", () => {
    expect(currentStreak(act(["2026-11-10", "2026-11-11", "2026-11-12"]), "2026-11-12")).toBe(3);
    expect(currentStreak(act(["2026-11-10", "2026-11-11"]), "2026-11-12")).toBe(2);
    expect(currentStreak(act(["2026-11-09", "2026-11-11"]), "2026-11-12")).toBe(1);
    expect(currentStreak(act(["2026-11-01"]), "2026-11-12")).toBe(0);
  });
  it("crosses month boundaries", () => {
    expect(currentStreak(act(["2026-10-30", "2026-10-31", "2026-11-01"]), "2026-11-01")).toBe(3);
    expect(longestStreak(act(["2026-01-01", "2026-01-02", "2026-01-05"]))).toBe(2);
  });
  it("levels up", () => {
    expect(level(0).level).toBe(1);
    expect(level(100).level).toBe(2);
    expect(level(299).level).toBe(2);
    expect(level(300).level).toBe(3);
  });
  it("unlocks achievements from real data only", () => {
    const s = initialState();
    expect(newlyUnlocked(s)).toHaveLength(0);
    s.activity = act(["2026-11-06", "2026-11-07", "2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12"]);
    const ids = newlyUnlocked(s).map((a) => a.id);
    expect(ids).toContain("streak-7");
    expect(ids).not.toContain("streak-15");
  });
});

describe("progress summary", () => {
  it("computes today, previous and weekly averages", () => {
    const s = initialState();
    const mk = (date: string, overall: number) => ({ id: date + overall, date: date + "T10:00:00", module: "speak" as const, prompt: "", transcript: "", input: "text" as const, durationSec: 60, scores: { overall, grammar: overall, fluency: 50, vocabulary: 50, pronunciation: null, relevance: 50, durationSec: 60, wpm: null } });
    s.sessions = [mk("2026-11-12", 80), mk("2026-11-12", 70), mk("2026-11-10", 60)];
    s.activity = act(["2026-11-10", "2026-11-12"]);
    const p = progressSummary(s, "2026-11-12");
    expect(p.todayScore).toBe(75);
    expect(p.previousScore).toBe(60);
    expect(p.weeklyAverage).toBe(68);
    expect(p.totalMinutes).toBe(10);
  });
});

import { newCard, review, dueIds, dailyWords } from "@/lib/vocab/srs";
describe("spaced repetition", () => {
  it("moves cards through boxes", () => {
    let c = newCard("2026-11-12");
    c = review(c, true, "2026-11-12");
    expect(c.box).toBe(1);
    expect(c.due).toBe("2026-11-13");
    c = review(c, true, "2026-11-13");
    expect(c.due).toBe("2026-11-16");
    c = review(c, false, "2026-11-16");
    expect(c.box).toBe(0);
    expect(dueIds({ vocab: { a: c, b: { ...c, due: "2026-12-01" } } }, "2026-11-16")).toEqual(["a"]);
  });
  it("daily words are stable per day", () => {
    const all = Array.from({ length: 50 }, (_, i) => i);
    expect(dailyWords(all, 5, "2026-11-12")).toEqual(dailyWords(all, 5, "2026-11-12"));
    expect(dailyWords(all, 5, "2026-11-12")).not.toEqual(dailyWords(all, 5, "2026-11-13"));
  });
});

import { ensureDailyPlan, markLearned, pickDailyIds } from "@/lib/vocab/daily";
import { DAILY_WORDS, DAILY_CATEGORIES } from "@/content/vocabulary/daily-needs";
describe("daily needs vocabulary", () => {
  it("has a large bank across topics with unique ids, Hindi and examples", () => {
    expect(DAILY_WORDS.length).toBeGreaterThanOrEqual(550);
    expect(new Set(DAILY_WORDS.map((w) => w.id)).size).toBe(DAILY_WORDS.length);
    for (const c of ["animals", "fruits", "plants", "vegetables", "flowers", "birds"]) expect(DAILY_WORDS.filter((w) => w.category === c).length).toBeGreaterThanOrEqual(15);
    for (const w of DAILY_WORDS) {
      expect(w.hi, w.word).toMatch(/[ऀ-ॿ]/);
      expect(w.example, w.word).toMatch(/^[A-Z].*[.?!]$/);
      expect(w.example.toLowerCase(), w.word).toContain(w.word.toLowerCase());
    }
    expect(DAILY_CATEGORIES.length).toBeGreaterThanOrEqual(20);
  });
  it("picks 50 new words a day, mixed across topics, never repeating learned words", () => {
    const ids = pickDailyIds(new Set(), 50, [], "2026-11-13");
    expect(ids).toHaveLength(50);
    expect(new Set(ids.map((id) => id.split("-")[1])).size).toBeGreaterThanOrEqual(20);
    const next = pickDailyIds(new Set(ids), 50, [], "2026-11-14");
    expect(next.some((id) => ids.includes(id))).toBe(false);
  });
  it("respects chosen topics", () => {
    const ids = pickDailyIds(new Set(), 50, ["animals", "fruits", "plants"], "2026-11-13");
    expect(ids).toHaveLength(50);
    expect(ids.every((id) => /^dn-(animals|fruits|plants)-/.test(id))).toBe(true);
  });
  it("marks words learned with a spaced review card, and keeps learned words when the goal changes", () => {
    let s = initialState();
    s.dailyWords = ensureDailyPlan(s, "2026-11-13");
    expect(s.dailyWords!.ids).toHaveLength(50);
    const first = s.dailyWords!.ids[0];
    s = markLearned(s, first, "2026-11-13");
    expect(s.learnedWords).toContain(first);
    expect(s.vocab[first].due).toBe("2026-11-14");
    s.settings = { ...s.settings, dailyGoal: 10 };
    const plan = ensureDailyPlan(s, "2026-11-13")!;
    expect(plan.ids).toHaveLength(10);
    expect(plan.ids).toContain(first);
    // New day → new words, previous learned excluded.
    const tomorrow = ensureDailyPlan(s, "2026-11-14")!;
    expect(tomorrow.ids).not.toContain(first);
    expect(tomorrow.learned).toHaveLength(0);
  });
});
