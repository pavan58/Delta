/**
 * Speaking score (0-100) built from transparent, explainable indicators.
 * All values are automated ESTIMATES. "Measured" values are the ones counted
 * directly (word count, duration, words per minute, fillers).
 */
import { analyse, wordsOf, type GrammarReport } from "@/lib/grammar/engine";
import { clamp } from "@/lib/utils";
import type { ScoreBreakdown } from "@/lib/store/types";

const COMMON = new Set(
  `a about above after again against all also always am an and any are as at back be because been before being below between both but by can could day did do does doing done down during each even every few first for from get go going good got great had has have having he her here hers him his how i if in into is it its just know like little long look made make many me more most much my myself new no nor not now of off often on once one only or other our out over own people really right said same say see she should so some such take than that the their them then there these they thing think this those through time to too up us very want was way we well went were what when where which while who why will with would year you your yes okay ok yeah`.split(
    /\s+/,
  ),
);

export interface SpeakingInput {
  transcript: string;
  durationSec: number;
  input: "voice" | "text";
  /** Mean speech-recognition confidence 0..1, if the browser reported it. */
  confidence?: number | null;
  keywords?: string[];
  minSeconds?: number;
  /** Target number of words for typed answers when duration is meaningless. */
  minWords?: number;
}

export interface SpeakingResult {
  scores: ScoreBreakdown;
  grammar: GrammarReport;
  details: {
    wordCount: number;
    uniqueWords: number;
    lexicalDiversity: number;
    advancedWords: string[];
    fillerCount: number;
    keywordHits: string[];
    avgSentenceLength: number;
  };
  tips: string[];
}

export function lexicalStats(text: string) {
  const words = wordsOf(text);
  const unique = new Set(words);
  // Guiraud's index (unique / sqrt(total)) is less length-sensitive than plain TTR.
  const guiraud = words.length ? unique.size / Math.sqrt(words.length) : 0;
  const advanced = [...unique].filter((w) => w.length >= 7 && !COMMON.has(w));
  return { words, unique: unique.size, guiraud, advanced };
}

export function keywordHits(text: string, keywords: string[] = []) {
  const lower = " " + text.toLowerCase().replace(/[^a-z0-9'?%+ ]/g, " ") + " ";
  return keywords.filter((k) => {
    const kk = k.toLowerCase();
    if (kk === "?") return text.includes("?") || /^(what|where|why|when|how|who|could|would|do|does|did|are|is|can)\b/im.test(text);
    return lower.includes(" " + kk + " ") || lower.includes(" " + kk) ;
  });
}

export function scoreSpeaking(inp: SpeakingInput): SpeakingResult {
  const grammar = analyse(inp.transcript, { source: inp.input });
  const { words, unique, guiraud, advanced } = lexicalStats(inp.transcript);
  const wc = words.length;
  const sentences = Math.max(1, grammar.sentences.length);
  const avgSentenceLength = wc / sentences;

  // Fluency: words per minute (voice), filler ratio, length vs target.
  let wpm: number | null = null;
  let fluency: number;
  const fillerRatio = wc ? grammar.fillerCount / wc : 0;
  if (inp.input === "voice" && inp.durationSec >= 5) {
    wpm = Math.round((wc / inp.durationSec) * 60);
    // Comfortable conversational pace for learners ~100-160 wpm.
    const paceScore = wpm >= 100 && wpm <= 160 ? 100 : wpm < 100 ? clamp(40 + (wpm / 100) * 60) : clamp(100 - (wpm - 160) * 1.2);
    const lengthScore = inp.minSeconds ? clamp((inp.durationSec / inp.minSeconds) * 100) : 100;
    fluency = clamp(paceScore * 0.5 + lengthScore * 0.3 + (100 - fillerRatio * 600) * 0.2);
  } else {
    const target = inp.minWords ?? Math.max(30, Math.round(((inp.minSeconds ?? 45) / 60) * 90));
    const lengthScore = clamp((wc / target) * 100);
    const flow = clamp(avgSentenceLength >= 8 && avgSentenceLength <= 25 ? 100 : avgSentenceLength < 8 ? avgSentenceLength * 12 : 100 - (avgSentenceLength - 25) * 3);
    fluency = clamp(lengthScore * 0.6 + flow * 0.25 + (100 - fillerRatio * 600) * 0.15);
  }

  // Vocabulary: diversity + share of less-common words.
  const diversity = clamp(((guiraud - 3) / 4.5) * 100); // ~3 = very repetitive, ~7.5 = rich
  const sophistication = clamp((advanced.length / Math.max(1, wc)) * 100 * 6);
  const vocabulary = wc < 5 ? clamp(wc * 8) : clamp(diversity * 0.65 + sophistication * 0.35);

  // Pronunciation indicator: only from recogniser confidence (not phoneme analysis).
  const pronunciation =
    inp.input === "voice" && typeof inp.confidence === "number" && inp.confidence > 0
      ? clamp(Math.round(40 + inp.confidence * 60))
      : null;

  // Relevance: keyword coverage + adequate length.
  const hits = keywordHits(inp.transcript, inp.keywords);
  const kwScore = inp.keywords?.length ? clamp((hits.length / Math.min(4, inp.keywords.length)) * 100) : 75;
  const relevance = wc < 5 ? clamp(wc * 6) : clamp(kwScore * 0.8 + Math.min(20, wc / 3));

  const grammarScore = wc < 3 ? 0 : grammar.score;
  const parts: Array<[number, number]> = [
    [grammarScore, 0.3],
    [fluency, 0.25],
    [vocabulary, 0.2],
    [relevance, 0.15],
  ];
  if (pronunciation !== null) parts.push([pronunciation, 0.1]);
  const totalW = parts.reduce((s, [, w]) => s + w, 0);
  const overall = Math.round(parts.reduce((s, [v, w]) => s + v * w, 0) / totalW);

  const tips: string[] = [];
  if (grammar.issues.length) tips.push(`Fix ${grammar.issues.length} grammar point${grammar.issues.length > 1 ? "s" : ""} — see the corrections below.`);
  if (wpm !== null && wpm < 90) tips.push("Try to speak a little faster and keep going without long pauses.");
  if (wpm !== null && wpm > 170) tips.push("Slow down slightly so every word is clear.");
  if (grammar.fillerCount >= 3) tips.push(`You used ${grammar.fillerCount} fillers (um, uh, basically…). Replace them with a short silent pause.`);
  if (inp.minSeconds && inp.input === "voice" && inp.durationSec < inp.minSeconds) tips.push(`Aim to speak for at least ${inp.minSeconds} seconds.`);
  if (vocabulary < 50 && wc >= 15) tips.push("Use a wider range of words — try the vocabulary from today's lesson.");
  if (inp.keywords?.length && hits.length < 2) tips.push("Stay closer to the topic and answer every part of the question.");
  if (avgSentenceLength < 6 && wc > 15) tips.push("Join short sentences with because, so, but, and although.");
  if (!tips.length) tips.push("Excellent! Challenge yourself with a longer answer and more advanced vocabulary.");

  return {
    scores: {
      overall: clamp(overall),
      grammar: Math.round(grammarScore),
      fluency: Math.round(fluency),
      vocabulary: Math.round(vocabulary),
      pronunciation: pronunciation === null ? null : Math.round(pronunciation),
      relevance: Math.round(relevance),
      durationSec: Math.round(inp.durationSec),
      wpm,
    },
    grammar,
    details: {
      wordCount: wc,
      uniqueWords: unique,
      lexicalDiversity: +guiraud.toFixed(2),
      advancedWords: advanced.slice(0, 12),
      fillerCount: grammar.fillerCount,
      keywordHits: hits,
      avgSentenceLength: +avgSentenceLength.toFixed(1),
    },
    tips,
  };
}
