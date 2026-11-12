"use client";
import { addMistakes, recordActivity, setState } from "./store";
import type { SpeakingSession } from "./types";
import type { SpeakingResult } from "@/lib/scoring/speaking";
import type { GrammarReport } from "@/lib/grammar/engine";
import { XP } from "@/lib/gamification";
import { uid } from "@/lib/utils";

/** Saves real mistakes to the personal tracker (fillers/punctuation excluded). */
export function trackMistakes(report: GrammarReport) {
  addMistakes(
    report.issues
      .filter((i) => !["filler", "punctuation", "repetition"].includes(i.category))
      .map((i) => {
        const s = report.sentences[i.sentenceIndex];
        return { original: s.original, corrected: s.corrected, category: i.category, reason: i.message };
      }),
  );
}

export function saveSpeakingSession(opts: {
  module: SpeakingSession["module"];
  prompt: string;
  transcript: string;
  input: "voice" | "text";
  durationSec: number;
  result: SpeakingResult;
  xp?: number;
}): SpeakingSession {
  const session: SpeakingSession = {
    id: uid(),
    date: new Date().toISOString(),
    module: opts.module,
    prompt: opts.prompt,
    transcript: opts.transcript,
    input: opts.input,
    durationSec: opts.durationSec,
    scores: opts.result.scores,
  };
  setState((s) => ({ ...s, sessions: [session, ...s.sessions].slice(0, 1000) }));
  trackMistakes(opts.result.grammar);
  // Speaking minutes count only measured voice time; typed answers add a small, honest estimate (0).
  const minutes = opts.input === "voice" ? opts.durationSec / 60 : Math.min(opts.durationSec, 300) / 60;
  recordActivity(opts.xp ?? XP.speaking, minutes);
  return session;
}
