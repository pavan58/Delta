import { scoreSpeaking } from "./speaking";
import type { InterviewScores } from "@/lib/store/types";

export interface InterviewEvalInput {
  answer: string;
  input: "voice" | "text";
  durationSec: number;
  confidence?: number | null;
  keywords: string[];
  behavioural?: boolean;
}

/**
 * Interview answer score out of 100:
 * Communication 20, Grammar 20, Vocabulary 15, Relevance 20, Fluency 15, Pronunciation 10.
 * When pronunciation cannot be estimated (typed answer) the other parts are scaled to 100.
 */
export function scoreInterviewAnswer(inp: InterviewEvalInput) {
  const r = scoreSpeaking({
    transcript: inp.answer,
    durationSec: inp.durationSec,
    input: inp.input,
    confidence: inp.confidence,
    keywords: inp.keywords,
    minSeconds: 45,
    minWords: 60,
  });
  const s = r.scores;
  const wc = r.details.wordCount;
  const lower = inp.answer.toLowerCase();

  // Communication: structure + clarity + length appropriateness.
  const hasExample = /\b(for example|for instance|once|when i|in my (last|previous|current)|recently|last year)\b/.test(lower);
  const hasStructure = /\b(first|firstly|secondly|also|another|finally|as a result|so|because|therefore)\b/.test(lower);
  const star = inp.behavioural ? ["situation|when|once", "task|responsib|had to|needed to", "i (did|decided|took|started|created|fixed|spoke|called|escalated)|action", "result|as a result|finally|in the end|outcome|learned"].filter((p) => new RegExp(p).test(lower)).length : 0;
  const lengthOk = wc >= 40 && wc <= 250 ? 1 : wc < 40 ? wc / 40 : Math.max(0.6, 1 - (wc - 250) / 400);
  let comm = 20 * (0.45 * lengthOk + 0.2 * (hasExample ? 1 : 0.3) + 0.2 * (hasStructure ? 1 : 0.4) + 0.15 * (s.grammar / 100));
  if (inp.behavioural) comm = comm * 0.75 + 5 * (star / 4);

  const parts = {
    communication: Math.round(comm),
    grammar: Math.round((s.grammar / 100) * 20),
    vocabulary: Math.round((s.vocabulary / 100) * 15),
    relevance: Math.round((s.relevance / 100) * 20),
    fluency: Math.round((s.fluency / 100) * 15),
    pronunciation: s.pronunciation === null ? null : Math.round((s.pronunciation / 100) * 10),
  };
  const sub = parts.communication + parts.grammar + parts.vocabulary + parts.relevance + parts.fluency;
  const total = parts.pronunciation === null ? Math.round((sub / 90) * 100) : sub + parts.pronunciation;
  const scores: InterviewScores = { ...parts, total: Math.min(100, total) };

  const feedback: string[] = [];
  if (wc < 40) feedback.push("Your answer is short. Aim for 60–150 words (about 45–90 seconds).");
  if (!hasExample) feedback.push("Add a specific example from your experience to make the answer believable.");
  if (inp.behavioural && star < 3) feedback.push("Use the STAR method: Situation, Task, Action, Result.");
  if (r.details.keywordHits.length < 2 && inp.keywords.length) feedback.push(`Mention key points the interviewer expects, such as: ${inp.keywords.slice(0, 4).join(", ")}.`);
  feedback.push(...r.tips.filter((t) => !/Excellent/.test(t)).slice(0, 2));
  if (!feedback.length) feedback.push("Strong answer — clear, relevant and well structured.");

  return { scores, feedback, speaking: r };
}
