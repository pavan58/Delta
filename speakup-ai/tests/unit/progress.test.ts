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
