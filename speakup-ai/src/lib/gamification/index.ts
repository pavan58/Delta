import type { AppState } from "@/lib/store/types";
import { addDays, localDate, weekStart } from "@/lib/utils";

/** Consecutive days with real practice, ending today (or yesterday if today not yet practised). */
export function currentStreak(activity: AppState["activity"], today = localDate()): number {
  const active = (d: string) => (activity[d]?.sessions ?? 0) > 0;
  let day = active(today) ? today : addDays(today, -1);
  let n = 0;
  while (active(day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

export function longestStreak(activity: AppState["activity"]): number {
  const days = Object.keys(activity).filter((d) => activity[d].sessions > 0).sort();
  let best = 0;
  let cur = 0;
  let prev = "";
  for (const d of days) {
    cur = prev && addDays(prev, 1) === d ? cur + 1 : 1;
    best = Math.max(best, cur);
    prev = d;
  }
  return best;
}

export function weeklyXp(activity: AppState["activity"], today = localDate()): number {
  const start = weekStart(today);
  let xp = 0;
  for (let i = 0; i < 7; i++) xp += activity[addDays(start, i)]?.xp ?? 0;
  return xp;
}

export function level(xp: number) {
  // Each level needs 100 more XP than the previous one.
  let lvl = 1;
  let need = 100;
  let rest = xp;
  while (rest >= need) {
    rest -= need;
    lvl++;
    need += 100;
  }
  return { level: lvl, into: rest, need };
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  emoji: string;
  group: "streak" | "vocabulary" | "ielts" | "interview" | "challenge" | "speaking";
  check: (s: AppState) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first-words", title: "First Words", description: "Complete your first speaking session", emoji: "🎙️", group: "speaking", check: (s) => s.sessions.length >= 1 },
  { id: "chatterbox", title: "Chatterbox", description: "Complete 25 speaking sessions", emoji: "💬", group: "speaking", check: (s) => s.sessions.length >= 25 },
  { id: "streak-3", title: "Warming Up", description: "Practise 3 days in a row", emoji: "🔥", group: "streak", check: (s) => maxStreak(s) >= 3 },
  { id: "streak-7", title: "7-Day Streak", description: "Practise 7 days in a row", emoji: "🔥", group: "streak", check: (s) => maxStreak(s) >= 7 },
  { id: "streak-15", title: "15-Day Streak", description: "Practise 15 days in a row", emoji: "⚡", group: "streak", check: (s) => maxStreak(s) >= 15 },
  { id: "streak-30", title: "30-Day Streak", description: "Practise 30 days in a row", emoji: "🏆", group: "streak", check: (s) => maxStreak(s) >= 30 },
  { id: "vocab-10", title: "Word Collector", description: "Learn 10 words", emoji: "📘", group: "vocabulary", check: (s) => s.learnedWords.length >= 10 },
  { id: "vocab-50", title: "Word Master", description: "Learn 50 words", emoji: "📚", group: "vocabulary", check: (s) => s.learnedWords.length >= 50 },
  { id: "vocab-100", title: "Lexicon Legend", description: "Learn 100 words", emoji: "🧠", group: "vocabulary", check: (s) => s.learnedWords.length >= 100 },
  { id: "challenge-week1", title: "Foundation Built", description: "Complete Week 1 of the 30-day challenge", emoji: "🧱", group: "challenge", check: (s) => [1, 2, 3, 4, 5, 6, 7].every((d) => s.challenge[d]) },
  { id: "challenge-week2", title: "No More Hesitation", description: "Complete Week 2 of the challenge", emoji: "🗣️", group: "challenge", check: (s) => [8, 9, 10, 11, 12, 13, 14].every((d) => s.challenge[d]) },
  { id: "challenge-30", title: "Confidence Champion", description: "Complete all 30 challenge days", emoji: "🥇", group: "challenge", check: (s) => Object.keys(s.challenge).length >= 30 },
  { id: "ielts-first", title: "IELTS Starter", description: "Finish your first IELTS practice", emoji: "📝", group: "ielts", check: (s) => s.ielts.length >= 1 },
  { id: "ielts-all4", title: "All-Rounder", description: "Practise all four IELTS skills", emoji: "🎯", group: "ielts", check: (s) => new Set(s.ielts.map((a) => a.module)).size === 4 },
  { id: "ielts-mock", title: "Mock Test Finisher", description: "Complete a full IELTS mock test", emoji: "🏁", group: "ielts", check: (s) => s.mocks.some((m) => m.overall !== null) },
  { id: "ielts-7", title: "Band 7 Practice", description: "Estimated band 7+ in any practice", emoji: "🌟", group: "ielts", check: (s) => s.ielts.some((a) => a.band >= 7) },
  { id: "interview-first", title: "Interview Ready", description: "Complete your first mock interview", emoji: "💼", group: "interview", check: (s) => s.interviews.length >= 1 },
  { id: "interview-5", title: "Interview Pro", description: "Complete 5 mock interviews", emoji: "🤝", group: "interview", check: (s) => s.interviews.length >= 5 },
  { id: "interview-80", title: "Strong Candidate", description: "Score 80+ in a mock interview", emoji: "🚀", group: "interview", check: (s) => s.interviews.some((i) => i.total >= 80) },
];

function maxStreak(s: AppState) {
  return Math.max(currentStreak(s.activity), longestStreak(s.activity));
}

/** Returns ids of achievements newly unlocked by the given state. */
export function newlyUnlocked(s: AppState): Achievement[] {
  return ACHIEVEMENTS.filter((a) => !s.achievements[a.id] && a.check(s));
}

export const XP = {
  speaking: 20,
  grammarCheck: 5,
  challengeDay: 50,
  vocabReview: 2,
  vocabLearned: 5,
  ieltsPractice: 30,
  mockTest: 120,
  interview: 60,
  mistakeRevised: 5,
};
