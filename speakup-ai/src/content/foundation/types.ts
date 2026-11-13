/** Spoken English Foundation Course — content model. */

export type Exercise =
  | { type: "mcq"; q: string; options: string[]; answer: number; why?: string }
  /** Sentence with "___"; answer may list alternatives separated by "|". */
  | { type: "fill"; q: string; answer: string; hint?: string; why?: string }
  /** Correct the wrong sentence; accepted answers separated by "|". */
  | { type: "fix"; q: string; answer: string; why?: string }
  /** Put the words in order; the answer is the full correct sentence. */
  | { type: "order"; answer: string; why?: string };

export interface FoundationLesson {
  id: string;
  unit: number;
  title: string;
  objective: string;
  explain: string[];
  hi: string;
  table?: { headers: string[]; rows: string[][] };
  examples: Array<{ en: string; note?: string }>;
  mistakes: Array<{ wrong: string; right: string; why: string }>;
  exercises: Exercise[];
  speaking: { prompt: string; keywords: string[]; minSeconds: number; example: string };
}

export interface FoundationUnit {
  id: number;
  title: string;
  description: string;
  emoji: string;
}
