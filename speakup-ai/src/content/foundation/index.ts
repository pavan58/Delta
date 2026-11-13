import type { FoundationLesson, FoundationUnit } from "./types";
import { UNIT1, UNIT2, UNIT3 } from "./lessons-a";
import { UNIT4, UNIT5 } from "./lessons-b";

export const FOUNDATION_UNITS: FoundationUnit[] = [
  { id: 1, title: "Building blocks", description: "Sentence order, nouns, pronouns and articles.", emoji: "🧱" },
  { id: 2, title: "Verbs", description: "Be, have, do, verb forms (V1–V5) and modal verbs.", emoji: "⚙️" },
  { id: 3, title: "Describing words", description: "Adjectives, comparatives and adverbs.", emoji: "🎨" },
  { id: 4, title: "Tenses", description: "All 12 tenses for speaking about past, present and future.", emoji: "⏳" },
  { id: 5, title: "Sentence skills", description: "Prepositions, linking words, questions, negatives, passive and conditionals.", emoji: "🔗" },
];

export const FOUNDATION_LESSONS: FoundationLesson[] = [...UNIT1, ...UNIT2, ...UNIT3, ...UNIT4, ...UNIT5];

export function getFoundationLesson(id: string) {
  return FOUNDATION_LESSONS.find((l) => l.id === id);
}

export function nextFoundationLesson(id: string) {
  const i = FOUNDATION_LESSONS.findIndex((l) => l.id === id);
  return i >= 0 ? FOUNDATION_LESSONS[i + 1] : undefined;
}

export * from "./types";
