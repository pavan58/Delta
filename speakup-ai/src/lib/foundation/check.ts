/** Answer checking for Foundation Course exercises. Unlike IELTS checking, articles matter here. */
import type { Exercise } from "@/content/foundation/types";

const CONTRACTIONS: Array<[RegExp, string]> = [
  [/\bi'm\b/g, "i am"], [/\byou're\b/g, "you are"], [/\bwe're\b/g, "we are"], [/\bthey're\b/g, "they are"], [/\b(he|she|it)'s\b/g, "$1 is"],
  [/\bisn't\b/g, "is not"], [/\baren't\b/g, "are not"], [/\bwasn't\b/g, "was not"], [/\bweren't\b/g, "were not"],
  [/\bdon't\b/g, "do not"], [/\bdoesn't\b/g, "does not"], [/\bdidn't\b/g, "did not"], [/\bhaven't\b/g, "have not"], [/\bhasn't\b/g, "has not"],
  [/\bhadn't\b/g, "had not"], [/\bwon't\b/g, "will not"], [/\bcan't\b/g, "cannot"], [/\bcan not\b/g, "cannot"], [/\bshouldn't\b/g, "should not"],
  [/\bwouldn't\b/g, "would not"], [/\bcouldn't\b/g, "could not"], [/\blet's\b/g, "let us"], [/\b(i|you|we|they|he|she|it)'ll\b/g, "$1 will"],
  [/\b(i|you|we|they)'ve\b/g, "$1 have"], [/\b(i|you|we|they|he|she)'d\b/g, "$1 would"], [/(^| )'re\b/g, "$1are"], [/(^| )'ll\b/g, "$1will"],
];

export function normaliseSentence(s: string) {
  let x = s.toLowerCase().replace(/[‘’]/g, "'").trim();
  for (const [re, rep] of CONTRACTIONS) x = x.replace(re, rep);
  return x.replace(/[.,!?;:"()]/g, " ").replace(/\s+/g, " ").trim();
}

export function acceptedAnswers(e: Exercise): string[] {
  if (e.type === "mcq") return [e.options[e.answer]];
  return e.answer.split("|").map((a) => a.trim()).filter(Boolean);
}

export function checkExercise(e: Exercise, given: string | number): boolean {
  if (e.type === "mcq") return Number(given) === e.answer;
  const g = normaliseSentence(String(given));
  if (!g) return false;
  return acceptedAnswers(e).some((a) => normaliseSentence(a) === g);
}

/** Deterministic word shuffle for "order" exercises (never returns the original order when avoidable). */
export function shuffledWords(sentence: string, seed: string): string[] {
  const words = sentence.replace(/[.?!]$/, "").split(/\s+/);
  let h = 0;
  for (const c of seed + sentence) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const rand = () => ((h = (h * 1103515245 + 12345) >>> 0) / 2 ** 32);
  // Try several shuffles and keep the one that moves the most words out of place.
  let best = [...words];
  let bestMoved = -1;
  for (let attempt = 0; attempt < 12; attempt++) {
    const out = [...words];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    const moved = out.filter((w, i) => w !== words[i]).length;
    if (moved > bestMoved) {
      best = out;
      bestMoved = moved;
    }
    if (moved >= Math.ceil(words.length * 0.75)) break;
  }
  const out = best;
  return out;
}
