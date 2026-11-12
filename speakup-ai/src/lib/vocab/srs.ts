/**
 * Leitner-style spaced repetition. Box n => review after INTERVALS[n] days.
 * A word is "learned" once it reaches box 3 (answered correctly on 3 spaced reviews).
 */
import type { AppState, VocabCard } from "@/lib/store/types";
import { addDays, localDate } from "@/lib/utils";

export const INTERVALS = [0, 1, 3, 7, 14, 30];
export const LEARNED_BOX = 3;

export function newCard(today = localDate()): VocabCard {
  return { box: 0, due: today, correct: 0, wrong: 0, savedAt: new Date().toISOString() };
}

export function review(card: VocabCard, correct: boolean, today = localDate()): VocabCard {
  const box = correct ? Math.min(card.box + 1, INTERVALS.length - 1) : 0;
  return {
    ...card,
    box,
    due: addDays(today, INTERVALS[box] || (correct ? 1 : 0)),
    correct: card.correct + (correct ? 1 : 0),
    wrong: card.wrong + (correct ? 0 : 1),
  };
}

export function dueIds(s: Pick<AppState, "vocab">, today = localDate()) {
  return Object.entries(s.vocab)
    .filter(([, c]) => c.due <= today)
    .sort((a, b) => a[1].box - b[1].box)
    .map(([id]) => id);
}

export function dueCount(s: Pick<AppState, "vocab">, today = localDate()) {
  return dueIds(s, today).length;
}

/** Deterministic "word of the day" set so every learner sees the same daily words. */
export function dailyWords<T>(all: T[], n = 5, date = localDate()): T[] {
  let seed = 0;
  for (const ch of date) seed = (seed * 31 + ch.charCodeAt(0)) % 233280;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const copy = [...all];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}
