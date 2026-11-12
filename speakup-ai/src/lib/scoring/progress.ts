import type { AppState } from "@/lib/store/types";
import { addDays, avg, localDate } from "@/lib/utils";
import { overallBand } from "./ielts";
import { currentStreak, longestStreak, weeklyXp } from "@/lib/gamification";

export function dayScores(s: AppState) {
  const map: Record<string, number[]> = {};
  for (const x of s.sessions) (map[localDate(new Date(x.date))] ??= []).push(x.scores.overall);
  return Object.fromEntries(Object.entries(map).map(([d, v]) => [d, Math.round(avg(v))]));
}

export function progressSummary(s: AppState, today = localDate()) {
  const ds = dayScores(s);
  const days = Object.keys(ds).sort();
  const todayScore = ds[today] ?? null;
  const prevDay = days.filter((d) => d < today).pop();
  const previousScore = prevDay ? ds[prevDay] : null;
  const last7 = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const weekVals = last7.map((d) => ds[d]).filter((v): v is number => v !== undefined);
  const weeklyAverage = weekVals.length ? Math.round(avg(weekVals)) : null;
  const thisMonth = days.filter((d) => d > addDays(today, -30)).map((d) => ds[d]);
  const prevMonth = days.filter((d) => d <= addDays(today, -30) && d > addDays(today, -60)).map((d) => ds[d]);
  // Monthly improvement: compare this 30-day window with the previous one; fall back to first-vs-latest week.
  let monthlyImprovement: number | null = null;
  if (thisMonth.length && prevMonth.length) monthlyImprovement = Math.round(avg(thisMonth) - avg(prevMonth));
  else if (thisMonth.length >= 4) monthlyImprovement = Math.round(avg(thisMonth.slice(-3)) - avg(thisMonth.slice(0, 3)));
  const totalMinutes = Math.round(Object.values(s.activity).reduce((t, a) => t + a.minutes, 0));
  const grammarSeries = [...s.sessions].reverse().map((x) => x.scores.grammar);
  const grammarImprovement = grammarSeries.length >= 4 ? Math.round(avg(grammarSeries.slice(-3)) - avg(grammarSeries.slice(0, 3))) : null;

  const interviewReadiness = s.interviews.length ? Math.round(avg(s.interviews.slice(0, 3).map((i) => i.total))) : null;
  const latest = (m: string) => s.ielts.find((a) => a.module === m)?.band;
  const skillBands = ["listening", "reading", "writing", "speaking"].map((m) => latest(m)).filter((b): b is number => typeof b === "number");
  const ieltsEstimate = skillBands.length === 4 ? overallBand(skillBands) : skillBands.length ? overallBand(skillBands) : null;

  const weeklyActivity = last7.map((d) => ({
    date: d,
    label: new Date(d + "T00:00").toLocaleDateString("en-IN", { weekday: "short" }),
    minutes: +(s.activity[d]?.minutes ?? 0).toFixed(1),
    xp: s.activity[d]?.xp ?? 0,
    score: ds[d] ?? null,
  }));

  const completedDays = Object.keys(s.challenge).map(Number).sort((a, b) => a - b);
  const nextDay = Array.from({ length: 30 }, (_, i) => i + 1).find((d) => !s.challenge[d]) ?? null;

  const vals = s.sessions.slice(0, 20).map((x) => x.scores.overall);
  const overallProgress = vals.length ? Math.round(avg(vals)) : null;

  return {
    todayScore, previousScore, weeklyAverage, monthlyImprovement, totalMinutes, grammarImprovement, interviewReadiness,
    ieltsEstimate, ieltsSkillsDone: skillBands.length, weeklyActivity, completedDays, nextDay, overallProgress,
    streak: currentStreak(s.activity, today), longest: longestStreak(s.activity), weeklyXp: weeklyXp(s.activity, today),
    vocabLearned: s.learnedWords.length, sessions: s.sessions.length, dayScores: ds,
  };
}

export function latestScores(s: AppState) {
  const todays = s.sessions.filter((x) => localDate(new Date(x.date)) === localDate());
  const src = todays.length ? todays : s.sessions.slice(0, 5);
  if (!src.length) return null;
  const pr = src.map((x) => x.scores.pronunciation).filter((v): v is number => v !== null);
  return {
    overall: Math.round(avg(src.map((x) => x.scores.overall))),
    grammar: Math.round(avg(src.map((x) => x.scores.grammar))),
    fluency: Math.round(avg(src.map((x) => x.scores.fluency))),
    vocabulary: Math.round(avg(src.map((x) => x.scores.vocabulary))),
    pronunciation: pr.length ? Math.round(avg(pr)) : null,
    isToday: todays.length > 0,
  };
}
