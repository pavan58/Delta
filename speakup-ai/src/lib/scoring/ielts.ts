/**
 * IELTS-style band estimation. Conversion tables follow the commonly published
 * approximate raw-score→band ranges. Practice tests here are shorter than 40
 * questions, so raw scores are scaled to /40 first. Everything is an ESTIMATE.
 */
import { analyse, wordsOf } from "@/lib/grammar/engine";
import { lexicalStats } from "./speaking";
import { clamp } from "@/lib/utils";

type Table = Array<[minRaw: number, band: number]>;

const LISTENING: Table = [[39, 9], [37, 8.5], [35, 8], [32, 7.5], [30, 7], [26, 6.5], [23, 6], [18, 5.5], [16, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5], [2, 2], [1, 1]];
const READING_ACADEMIC: Table = [[39, 9], [37, 8.5], [35, 8], [33, 7.5], [30, 7], [27, 6.5], [23, 6], [19, 5.5], [15, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5], [2, 2], [1, 1]];
const READING_GENERAL: Table = [[40, 9], [39, 8.5], [37, 8], [36, 7.5], [34, 7], [32, 6.5], [30, 6], [27, 5.5], [23, 5], [19, 4.5], [15, 4], [12, 3.5], [9, 3], [6, 2.5], [3, 2], [1, 1]];

function lookup(table: Table, raw40: number) {
  for (const [min, band] of table) if (raw40 >= min) return band;
  return 0;
}

export function scaleTo40(raw: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((raw / total) * 40);
}

export function listeningBand(raw: number, total = 40) {
  return lookup(LISTENING, scaleTo40(raw, total));
}

export function readingBand(raw: number, total = 40, variant: "academic" | "general" = "academic") {
  return lookup(variant === "academic" ? READING_ACADEMIC : READING_GENERAL, scaleTo40(raw, total));
}

/**
 * Overall band: mean of the four skills rounded to the nearest half band;
 * .25 rounds up to .5 and .75 rounds up to the next whole band.
 */
export function overallBand(scores: number[]) {
  if (!scores.length) return 0;
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const whole = Math.floor(mean);
  const frac = +(mean - whole).toFixed(4);
  if (frac < 0.25) return whole;
  if (frac < 0.75) return whole + 0.5;
  return whole + 1;
}

/** Criteria bands are whole numbers in the public descriptors; the average is rounded down to the nearest half for Writing/Speaking. */
export function criteriaAverage(bands: number[]) {
  const mean = bands.reduce((a, b) => a + b, 0) / bands.length;
  return Math.floor(mean * 2) / 2;
}

const toBand = (score100: number) => clamp(Math.round(((score100 / 100) * 6 + 3) * 1) , 3, 9);

/* ----------------------------- Answer checking ---------------------------- */

export function normaliseAnswer(s: string) {
  return s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[.,;:!?"()]/g, "")
    .replace(/\b(the|a|an)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Accepts any of the alternatives separated by "|" in `correct`. Numbers may be written as digits or words. */
export function isCorrectAnswer(given: string, correct: string | string[]) {
  const alts = (Array.isArray(correct) ? correct : correct.split("|")).map(normaliseAnswer);
  const g = normaliseAnswer(numberWords(given));
  return g.length > 0 && alts.some((a) => normaliseAnswer(numberWords(a)) === g);
}

const NUM: Record<string, string> = { one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10", eleven: "11", twelve: "12", fifteen: "15", twenty: "20", thirty: "30", forty: "40", fifty: "50", hundred: "100" };
function numberWords(s: string) {
  return s.replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|hundred)\b/gi, (w) => NUM[w.toLowerCase()]);
}

/* ------------------------------- Writing --------------------------------- */

export interface WritingCriteria {
  task: number;
  coherence: number;
  lexical: number;
  grammar: number;
}

export interface WritingEvaluation {
  band: number;
  criteria: WritingCriteria;
  wordCount: number;
  paragraphs: number;
  linkers: string[];
  feedback: Record<keyof WritingCriteria, string[]>;
  corrections: ReturnType<typeof analyse>["issues"];
  correctedText: string;
  vocabularySuggestions: Array<{ from: string; to: string }>;
  paragraphTips: string[];
}

const LINKERS = ["however", "moreover", "furthermore", "in addition", "therefore", "consequently", "as a result", "for example", "for instance", "on the other hand", "in contrast", "although", "whereas", "while", "firstly", "secondly", "finally", "in conclusion", "to conclude", "overall", "nevertheless", "similarly", "in particular", "because", "since", "thus", "meanwhile", "subsequently", "to sum up", "not only"];
const COMPLEX = /\b(although|which|who|whose|whereas|while|if|unless|because|since|despite|so that|in order to|which means)\b/gi;

const BASIC_TO_BETTER: Array<[RegExp, string, string]> = [
  [/\bgood\b/gi, "good", "beneficial / favourable"],
  [/\bbad\b/gi, "bad", "detrimental / harmful"],
  [/\bbig\b/gi, "big", "substantial / significant"],
  [/\bvery\b/gi, "very", "extremely / remarkably (or a stronger adjective)"],
  [/\bthings?\b/gi, "thing", "aspect / factor / issue"],
  [/\ba lot of\b/gi, "a lot of", "a considerable number of / a great deal of"],
  [/\bget\b/gi, "get", "obtain / acquire / receive"],
  [/\bshow(s|ed)?\b/gi, "show", "illustrate / demonstrate / depict"],
  [/\bgo(es)? up\b/gi, "go up", "rise / increase / climb"],
  [/\bgo(es)? down\b/gi, "go down", "fall / decline / drop"],
  [/\bimportant\b/gi, "important", "crucial / vital / essential"],
  [/\bpeople\b/gi, "people", "individuals / citizens / the public (vary it)"],
  [/\bkids\b/gi, "kids", "children"],
];

export function evaluateWriting(text: string, task: "task1-academic" | "task1-general" | "task2", keywords: string[] = []): WritingEvaluation {
  const minWords = task === "task2" ? 250 : 150;
  const words = wordsOf(text);
  const wc = words.length;
  const paragraphs = text.split(/\n\s*\n|\n/).map((p) => p.trim()).filter((p) => p.split(/\s+/).length >= 8).length;
  const lower = text.toLowerCase();
  const linkers = LINKERS.filter((l) => lower.includes(l));
  const g = analyse(text, { source: "text" });
  const lex = lexicalStats(text);
  const complex = (text.match(COMPLEX) ?? []).length;
  const sentences = Math.max(1, g.sentences.length);
  const kwHits = keywords.filter((k) => lower.includes(k.toLowerCase()));

  const feedback: WritingEvaluation["feedback"] = { task: [], coherence: [], lexical: [], grammar: [] };

  // Task achievement / response
  let task100 = clamp((wc / minWords) * 70);
  if (keywords.length) task100 += clamp((kwHits.length / Math.min(4, keywords.length)) * 20, 0, 20);
  else task100 += 10;
  if (task === "task1-academic") {
    if (/\b(overall|in general|it is clear|it is evident)\b/i.test(text)) task100 += 10;
    else feedback.task.push("Add an overview sentence (e.g. 'Overall, …') that summarises the main trends — it is essential for Task 1.");
    if (!/\d/.test(text)) feedback.task.push("Support your description with specific figures from the chart.");
  } else if (task === "task1-general") {
    if (/^(dear|hi|hello)\b/im.test(text)) task100 += 5;
    else feedback.task.push("Start with an appropriate greeting (Dear Mr Khan, / Dear Sir or Madam, / Hi Sam,).");
    if (/\b(yours (sincerely|faithfully)|best regards|kind regards|best wishes|regards)\b/i.test(text)) task100 += 5;
    else feedback.task.push("Finish with a suitable sign-off (Yours sincerely, / Yours faithfully, / Best wishes,).");
    feedback.task.push("Make sure you cover all three bullet points in the task.");
  } else {
    if (/\b(i (strongly )?(believe|agree|disagree|think)|in my (opinion|view)|this essay (will|argues))\b/i.test(text)) task100 += 6;
    else feedback.task.push("State your position clearly in the introduction (e.g. 'I strongly believe that…').");
    if (/\b(in conclusion|to conclude|to sum up)\b/i.test(text)) task100 += 4;
    else feedback.task.push("Finish with a clear conclusion paragraph.");
  }
  if (wc < minWords) feedback.task.unshift(`Your response has ${wc} words. Write at least ${minWords} words — short answers lose marks.`);

  // Coherence & cohesion
  const idealParas = task === "task2" ? 4 : task === "task1-general" ? 4 : 3;
  let coh100 = clamp(40 + Math.min(paragraphs, idealParas) * (40 / idealParas) + Math.min(linkers.length, 6) * 4);
  if (paragraphs < idealParas - 1) feedback.coherence.push(`Organise your answer into about ${idealParas} paragraphs, each with one main idea.`);
  if (linkers.length < 3) feedback.coherence.push("Use more linking words: however, moreover, as a result, for example, in contrast.");
  if (linkers.length > 10 && wc < 300) feedback.coherence.push("Don't overuse linking words — use them where they show a real relationship.");
  if (!feedback.coherence.length) feedback.coherence.push("Good paragraphing and linking. Make sure each paragraph starts with a clear topic sentence.");

  // Lexical resource
  const div = clamp(((lex.guiraud - 4) / 5) * 100);
  const adv = clamp((lex.advanced.length / Math.max(1, wc)) * 100 * 5);
  const lex100 = clamp(div * 0.6 + adv * 0.4 - g.issues.filter((i) => i.category === "spelling" || i.category === "vocabulary").length * 5);
  const vocabularySuggestions: Array<{ from: string; to: string }> = [];
  for (const [re, from, to] of BASIC_TO_BETTER) {
    const count = (text.match(re) ?? []).length;
    if (count >= (from === "people" ? 4 : 1)) vocabularySuggestions.push({ from, to });
  }
  if (vocabularySuggestions.length) feedback.lexical.push("Replace some basic words with more precise vocabulary (see suggestions).");
  if (lex.guiraud < 5.5) feedback.lexical.push("Avoid repeating the same words — use synonyms and paraphrase the question.");
  if (!feedback.lexical.length) feedback.lexical.push("Good range of vocabulary. Add a few topic-specific collocations to push higher.");

  // Grammatical range & accuracy
  const errRate = (g.issues.filter((i) => i.category !== "filler").length / sentences) * 100;
  const range = clamp((complex / sentences) * 120);
  const gra100 = clamp((100 - errRate * 0.9) * 0.65 + range * 0.35);
  if (g.issues.length) feedback.grammar.push(`${g.issues.length} grammar/spelling point${g.issues.length > 1 ? "s" : ""} found — see corrections.`);
  if (complex / sentences < 0.4) feedback.grammar.push("Use more complex sentences (although…, which…, if…, so that…).");
  if (!feedback.grammar.length) feedback.grammar.push("Accurate grammar with a good mix of sentence types.");

  const criteria: WritingCriteria = {
    task: wc < 20 ? 1 : wc < minWords * 0.5 ? Math.min(4, toBand(task100)) : toBand(task100),
    coherence: wc < 20 ? 1 : toBand(coh100),
    lexical: wc < 20 ? 1 : toBand(lex100),
    grammar: wc < 20 ? 1 : toBand(gra100),
  };

  const paragraphTips =
    task === "task2"
      ? [
          "Introduction: paraphrase the question + give your clear position.",
          "Body 1: main idea + explanation + specific example.",
          "Body 2: second idea (or the opposing view) + explanation + example.",
          "Conclusion: restate your position in new words — no new ideas.",
        ]
      : task === "task1-academic"
        ? [
            "Introduction: paraphrase what the visual shows (what, where, when).",
            "Overview: two or three main trends or key features — no detailed numbers.",
            "Body 1 & 2: group the data logically and compare with specific figures.",
          ]
        : [
            "Opening: greeting + the purpose of your letter in one sentence.",
            "One paragraph for each bullet point in the task.",
            "Closing: what you want the reader to do + sign-off that matches the tone.",
          ];

  return {
    band: criteriaAverage(Object.values(criteria)),
    criteria,
    wordCount: wc,
    paragraphs,
    linkers,
    feedback,
    corrections: g.issues,
    correctedText: g.corrected,
    vocabularySuggestions,
    paragraphTips,
  };
}

/* ------------------------------- Speaking -------------------------------- */

export interface SpeakingBand {
  band: number;
  fluency: number;
  lexical: number;
  grammar: number;
  pronunciation: number | null;
}

/** Converts 0-100 indicator scores into estimated IELTS speaking criteria bands. */
export function speakingBand(s: { fluency: number; vocabulary: number; grammar: number; pronunciation: number | null; wordCount: number }): SpeakingBand {
  const lim = (b: number) => (s.wordCount < 15 ? Math.min(b, 3) : s.wordCount < 40 ? Math.min(b, 5) : b);
  const fluency = lim(toBand(s.fluency));
  const lexical = lim(toBand(s.vocabulary));
  const grammar = lim(toBand(s.grammar));
  const pronunciation = s.pronunciation === null ? null : lim(toBand(s.pronunciation));
  const parts = [fluency, lexical, grammar, ...(pronunciation === null ? [] : [pronunciation])];
  return { band: criteriaAverage(parts), fluency, lexical, grammar, pronunciation };
}

export const BANDS = [5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9];
