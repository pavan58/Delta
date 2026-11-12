"use client";
import { useEffect, useState } from "react";
import { Volume2 } from "lucide-react";
import { CUE_CARDS, PART1, type CueCard } from "@/content/ielts/speaking";
import { VoiceInput, type VoiceAnswer } from "@/components/voice/VoiceInput";
import { GrammarFeedback } from "@/components/voice/Feedback";
import { scoreSpeaking, type SpeakingResult } from "@/lib/scoring/speaking";
import { speakingBand, type SpeakingBand } from "@/lib/scoring/ielts";
import { useSpeechSynthesis } from "@/lib/speech/useSpeechSynthesis";
import { useAppState } from "@/lib/store/store";
import { saveSpeakingSession } from "@/lib/store/actions";
import { useCountdown } from "@/lib/utils/useTimer";
import { avg, mmss } from "@/lib/utils";
import { BandResult } from "./BandResult";

export interface Step { part: 1 | 2 | 3; question: string; card?: CueCard; keywords: string[] }
export interface SpeakingOutcome { band: SpeakingBand; results: SpeakingResult[] }

export function buildFullTest(topic?: string, card?: CueCard): Step[] {
  const t = topic ?? Object.keys(PART1)[Math.floor(Math.random() * Object.keys(PART1).length)];
  const c = card ?? CUE_CARDS[Math.floor(Math.random() * CUE_CARDS.length)];
  return [
    ...PART1[t].map((q) => ({ part: 1 as const, question: q, keywords: [] })),
    { part: 2, question: c.prompt, card: c, keywords: c.keywords },
    ...c.part3.slice(0, 3).map((q) => ({ part: 3 as const, question: q, keywords: c.keywords })),
  ];
}

export function aggregateBand(results: SpeakingResult[]): SpeakingBand {
  const pr = results.map((r) => r.scores.pronunciation).filter((v): v is number => v !== null);
  return speakingBand({
    fluency: avg(results.map((r) => r.scores.fluency)),
    vocabulary: avg(results.map((r) => r.scores.vocabulary)),
    grammar: avg(results.map((r) => r.scores.grammar)),
    pronunciation: pr.length ? avg(pr) : null,
    wordCount: results.reduce((n, r) => n + r.details.wordCount, 0),
  });
}

export function SpeakingTest({ steps, onFinish, showFeedback = true }: { steps: Step[]; onFinish: (o: SpeakingOutcome) => void; showFeedback?: boolean }) {
  const [i, setI] = useState(0);
  const [results, setResults] = useState<SpeakingResult[]>([]);
  const [current, setCurrent] = useState<SpeakingResult | null>(null);
  const [phase, setPhase] = useState<"prep" | "speak">("speak");
  const [notes, setNotes] = useState("");
  const [done, setDone] = useState<SpeakingOutcome | null>(null);
  const tts = useSpeechSynthesis();
  const settings = useAppState((s) => s.settings);
  const step = steps[i];
  const prep = useCountdown(60, () => setPhase("speak"));

  useEffect(() => {
    setCurrent(null);
    if (step?.part === 2) {
      setPhase("prep");
      prep.start(60);
    } else setPhase("speak");
    if (step) tts.speak(step.part === 2 ? `Here is your topic. ${step.question} You have one minute to prepare.` : step.question, { rate: settings.speechRate, voiceURI: settings.voiceURI });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  function answer(a: VoiceAnswer) {
    const r = scoreSpeaking({ transcript: a.text, durationSec: a.durationSec, input: a.input, confidence: a.confidence, keywords: step.keywords, minSeconds: step.part === 2 ? 60 : 20 });
    saveSpeakingSession({ module: "ielts-speaking", prompt: `IELTS Part ${step.part}: ${step.question}`, transcript: a.text, input: a.input, durationSec: a.durationSec, result: r, xp: 10 });
    setResults((x) => [...x, r]);
    setCurrent(r);
  }

  function next() {
    if (i + 1 < steps.length) setI(i + 1);
    else {
      const all = current && !results.includes(current) ? [...results, current] : results;
      const o = { band: aggregateBand(all), results: all };
      setDone(o);
      onFinish(o);
    }
  }

  if (done)
    return (
      <BandResult title="Speaking estimate" band={done.band.band}>
        <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <span>Fluency & Coherence: <b>{done.band.fluency}</b></span>
          <span>Lexical Resource: <b>{done.band.lexical}</b></span>
          <span>Grammar Range & Accuracy: <b>{done.band.grammar}</b></span>
          <span>Pronunciation: <b>{done.band.pronunciation ?? "not measured"}</b></span>
        </div>
        <p className="mt-2 text-xs text-muted">Pronunciation is estimated only from speech-recognition clarity, not phoneme analysis. Typed answers cannot be assessed for pronunciation.</p>
      </BandResult>
    );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3">
        <div className="card p-5">
          <p className="label">Part {step.part} · Question {i + 1} of {steps.length}</p>
          {step.card ? (
            <div className="mt-2 rounded-xl border-2 border-dashed border-brand-300 p-4">
              <p className="font-semibold">{step.card.prompt}</p>
              <p className="mt-2 text-sm">You should say:</p>
              <ul className="list-disc pl-5 text-sm">{step.card.bullets.map((b) => <li key={b}>{b}</li>)}</ul>
            </div>
          ) : (
            <p className="mt-2 text-xl font-semibold">{step.question}</p>
          )}
          <button onClick={() => tts.speak(step.question, { rate: settings.speechRate })} className="btn btn-ghost mt-2 px-2 py-1 text-xs"><Volume2 size={14} /> Repeat</button>
        </div>
        {step.part === 2 && phase === "prep" ? (
          <div className="card p-4">
            <div className="flex items-center justify-between"><p className="font-semibold">Preparation time</p><span className="font-mono text-2xl tabular-nums">{mmss(prep.left)}</span></div>
            <textarea className="input mt-2 min-h-28 text-sm" placeholder="Make short notes (keywords only)…" value={notes} onChange={(e) => setNotes(e.target.value)} aria-label="Preparation notes" />
            <button onClick={() => { prep.stop(); setPhase("speak"); }} className="btn btn-secondary mt-2 w-full">I&apos;m ready — start speaking</button>
          </div>
        ) : !current ? (
          <>
            {step.part === 2 && notes && <p className="rounded-lg surface-2 p-2 text-sm"><b>Your notes:</b> {notes}</p>}
            <VoiceInput key={i} onSubmit={answer} minSeconds={step.part === 2 ? 60 : 15} maxSeconds={step.part === 2 ? 120 : 90} autoStart={step.part === 2} submitLabel="Submit answer" placeholder="Type your answer if you can't use a microphone…" />
            {step.part === 2 && <p className="text-xs text-muted">Speak for 1–2 minutes. Recording stops automatically at 2:00.</p>}
          </>
        ) : (
          <button onClick={next} className="btn btn-primary w-full py-3">{i + 1 < steps.length ? "Next question →" : "Finish & see band estimate"}</button>
        )}
      </div>
      <div>
        {current && showFeedback ? (
          <div className="card space-y-3 p-4">
            <p className="font-semibold">Quick feedback</p>
            <p className="text-sm text-muted">{current.details.wordCount} words · {current.scores.durationSec}s{current.scores.wpm ? ` · ${current.scores.wpm} wpm` : ""}</p>
            <ul className="list-disc pl-5 text-sm">{current.tips.map((t) => <li key={t}>{t}</li>)}</ul>
            <GrammarFeedback report={current.grammar} />
          </div>
        ) : (
          <div className="card p-4 text-sm text-muted">
            <p className="font-semibold text-[var(--text)]">Examiner tips</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Part 1: answer in 2–3 sentences with a reason or example.</li>
              <li>Part 2: cover every bullet point and keep talking for up to 2 minutes.</li>
              <li>Part 3: give opinions, compare, speculate and support with examples.</li>
              <li>Use a range of tenses and linking words; self-correct naturally.</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
