"use client";
import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Turtle } from "lucide-react";
import { LISTENING_SECTIONS } from "@/content/ielts/listening";
import { QuestionGroups, QuestionNav, scoreGroups, type Answers } from "./Questions";
import { speakSequence, synthesisSupported } from "@/lib/speech/useSpeechSynthesis";
import { listeningBand } from "@/lib/scoring/ielts";
import { useCountdown } from "@/lib/utils/useTimer";
import { cn, mmss } from "@/lib/utils";

export interface ListeningResult { raw: number; total: number; band: number; answers: Answers }

/** Practice mode allows replays; exam mode plays each section once (as in the real test). */
export function ListeningTest({ mode, onFinish }: { mode: "practice" | "exam"; onFinish: (r: ListeningResult) => void }) {
  const [sec, setSec] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [review, setReview] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [line, setLine] = useState(-1);
  const [plays, setPlays] = useState<Record<number, number>>({});
  const [slow, setSlow] = useState(false);
  const [showScript, setShowScript] = useState(false);
  const stopRef = useRef<() => void>(() => {});
  const allGroups = LISTENING_SECTIONS.flatMap((s) => s.groups);
  const timer = useCountdown(32 * 60, () => mode === "exam" && submit());
  const section = LISTENING_SECTIONS[sec];

  useEffect(() => {
    if (mode === "exam") timer.start();
    return () => stopRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function play() {
    if (mode === "exam" && (plays[sec] ?? 0) >= 1) return;
    setPlaying(true);
    setPlays((p) => ({ ...p, [sec]: (p[sec] ?? 0) + 1 }));
    stopRef.current = speakSequence(section.script, { rate: slow ? 0.8 : 0.95, voiceMap: section.speakers, onLine: setLine, onDone: () => { setPlaying(false); setLine(-1); } });
  }
  function stop() {
    stopRef.current();
    setPlaying(false);
    setLine(-1);
  }

  function submit() {
    stop();
    timer.stop();
    const { raw, total } = scoreGroups(allGroups, answers);
    setReview(true);
    onFinish({ raw, total, band: listeningBand(raw, total), answers });
  }

  const exhausted = mode === "exam" && (plays[sec] ?? 0) >= 1 && !playing;

  return (
    <div className="space-y-4">
      <div className="card sticky top-14 z-10 flex flex-wrap items-center gap-2 p-3">
        {LISTENING_SECTIONS.map((s, i) => (
          <button key={s.id} onClick={() => { stop(); setSec(i); }} className={cn("chip px-3 py-1.5", sec === i && "border-brand-500 bg-brand-500 text-white")}>Section {s.id}</button>
        ))}
        {mode === "exam" && <span className={cn("ml-auto font-mono text-sm tabular-nums", timer.left < 300 && "text-red-500")} aria-label="Time left">⏱ {mmss(timer.left)}</span>}
      </div>

      {!synthesisSupported() && <p className="rounded-lg bg-amber-500/10 p-3 text-sm">Your browser does not support speech synthesis. Read the audio script instead (shown below).</p>}

      <div className="card p-4">
        <p className="font-semibold">{section.title}</p>
        <p className="text-sm text-muted">{section.context}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {playing ? (
            <button onClick={stop} className="btn btn-secondary"><Pause size={16} /> Stop</button>
          ) : (
            <button onClick={play} disabled={exhausted || review} className="btn btn-primary"><Play size={16} /> {plays[sec] ? "Replay audio" : "Play audio"}</button>
          )}
          {mode === "practice" && (
            <>
              <button onClick={() => setSlow(!slow)} className={cn("btn btn-secondary text-sm", slow && "border-brand-500")} aria-pressed={slow}><Turtle size={16} /> Slower</button>
              <button onClick={() => setShowScript(!showScript)} className="btn btn-ghost text-sm">{showScript ? "Hide" : "Show"} transcript</button>
            </>
          )}
          {exhausted && <span className="text-sm text-muted">In exam mode, each section plays once.</span>}
          {playing && <span className="text-sm text-muted">Playing… line {line + 1}/{section.script.length}</span>}
        </div>
        {(showScript || review || !synthesisSupported()) && (
          <div className="mt-3 max-h-64 space-y-1 overflow-y-auto rounded-lg surface-2 p-3 text-sm">
            {section.script.map((l, i) => <p key={i} className={cn(i === line && "font-semibold text-brand-500")}><b>{l.speaker}:</b> {l.text}</p>)}
          </div>
        )}
        <p className="mt-2 text-xs text-muted">Synthetic browser voices are used for practice; they differ from official IELTS recordings.</p>
      </div>

      <div className="card p-4">
        <QuestionGroups groups={section.groups} answers={answers} onChange={(id, v) => setAnswers((a) => ({ ...a, [id]: v }))} review={review} />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <button disabled={sec === 0} onClick={() => { stop(); setSec(sec - 1); }} className="btn btn-secondary">← Previous section</button>
          {sec < 3 ? <button onClick={() => { stop(); setSec(sec + 1); }} className="btn btn-secondary">Next section →</button> : !review && <button onClick={submit} className="btn btn-primary">Submit answers</button>}
        </div>
      </div>
      <div className="card p-3"><p className="label mb-2">Answer sheet</p><QuestionNav groups={allGroups} answers={answers} /></div>
      {!review && sec < 3 && <button onClick={submit} className="btn btn-ghost text-sm"><RotateCcw size={14} /> Finish early and check answers</button>}
    </div>
  );
}
