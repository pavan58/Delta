"use client";
import { use, useMemo, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, BookOpen, CheckCircle2, Lightbulb, Mic, PenLine, RotateCcw, Trophy, XCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { FOUNDATION_LESSONS, FOUNDATION_UNITS, getFoundationLesson, nextFoundationLesson, type Exercise, type FoundationLesson } from "@/content/foundation";
import { acceptedAnswers, checkExercise, shuffledWords } from "@/lib/foundation/check";
import { Speak, GrammarFeedback, ScoreReport } from "@/components/voice/Feedback";
import { VoiceInput, type VoiceAnswer } from "@/components/voice/VoiceInput";
import { scoreSpeaking, type SpeakingResult } from "@/lib/scoring/speaking";
import { saveSpeakingSession } from "@/lib/store/actions";
import { recordActivity, setState, useAppState } from "@/lib/store/store";
import { XP } from "@/lib/gamification";
import { cn } from "@/lib/utils";

type Step = "learn" | "practice" | "speak";

export default function FoundationLessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const lesson = getFoundationLesson(id);
  if (!lesson) notFound();
  return <Lesson key={lesson.id} lesson={lesson} />;
}

function Lesson({ lesson }: { lesson: FoundationLesson }) {
  const progress = useAppState((s) => s.foundation?.[lesson.id]);
  const [step, setStep] = useState<Step>("learn");
  const [score, setScore] = useState<number | null>(null);
  const [startedAt] = useState(() => Date.now());
  const n = FOUNDATION_LESSONS.indexOf(lesson) + 1;
  const unit = FOUNDATION_UNITS[lesson.unit - 1];
  const next = nextFoundationLesson(lesson.id);

  function complete(pct: number) {
    setScore(pct);
    const first = !progress;
    setState((s) => {
      const cur = s.foundation?.[lesson.id];
      return {
        ...s,
        foundation: {
          ...(s.foundation ?? {}),
          [lesson.id]: { completedAt: cur?.completedAt ?? new Date().toISOString(), best: Math.max(cur?.best ?? 0, pct), attempts: (cur?.attempts ?? 0) + 1, spoke: cur?.spoke ?? false },
        },
      };
    });
    recordActivity(first ? XP.foundationLesson : 10, Math.min(30, (Date.now() - startedAt) / 60000));
    setStep("speak");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div>
      <PageHeader back={{ href: "/foundation", label: "Foundation Course" }} title={`${n}. ${lesson.title}`} subtitle={`${unit.emoji} Unit ${unit.id} · ${unit.title}`}>
        {progress && <span className="chip text-mint-500"><CheckCircle2 size={14} /> Best {progress.best}%</span>}
      </PageHeader>

      <div className="mb-5 grid grid-cols-3 gap-2" role="tablist" aria-label="Lesson steps">
        {([["learn", "1. Learn", BookOpen], ["practice", "2. Practise", PenLine], ["speak", "3. Speak", Mic]] as const).map(([v, l, I]) => (
          <button key={v} role="tab" aria-selected={step === v} onClick={() => setStep(v)} className={cn("btn btn-secondary py-2 text-sm", step === v && "border-brand-500 bg-brand-500 text-white hover:border-brand-500")}>
            <I size={16} className="hidden sm:inline" /> {l}
          </button>
        ))}
      </div>

      {step === "learn" && <Learn lesson={lesson} onNext={() => { setStep("practice"); window.scrollTo({ top: 0 }); }} />}
      {step === "practice" && <Practice lesson={lesson} onDone={complete} />}
      {step === "speak" && <SpeakStep lesson={lesson} score={score} next={next} />}
    </div>
  );
}

function Learn({ lesson, onNext }: { lesson: FoundationLesson; onNext: () => void }) {
  const lang = useAppState((s) => s.profile?.explainLang ?? "en");
  const [hi, setHi] = useState(lang !== "en");
  return (
    <div className="space-y-4">
      <div className="card p-4">
        <p className="label">Goal</p>
        <p className="mt-1 font-semibold">{lesson.objective}</p>
      </div>
      <div className="card p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="label flex items-center gap-1"><Lightbulb size={14} /> The rule</p>
          <button onClick={() => setHi(!hi)} className="chip" aria-pressed={hi}>हिंदी {hi ? "✓" : ""}</button>
        </div>
        <ol className="mt-2 space-y-2 text-[15px]">
          {lesson.explain.map((x, i) => (
            <li key={i} className="flex gap-2"><span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-500/15 text-xs font-bold text-brand-600">{i + 1}</span><span>{x}</span></li>
          ))}
        </ol>
        {hi && <p className="mt-3 rounded-xl surface-2 p-3 text-[15px]" lang="hi">{lesson.hi}</p>}
      </div>
      {lesson.table && (
        <div className="card overflow-x-auto p-4">
          <table className="w-full min-w-[420px] text-sm">
            <thead><tr>{lesson.table.headers.map((h) => <th key={h} className="border-b border-base px-2 py-2 text-left font-semibold">{h}</th>)}</tr></thead>
            <tbody>{lesson.table.rows.map((r, i) => <tr key={i} className="border-b border-base last:border-0">{r.map((c, j) => <td key={j} className={cn("px-2 py-2", j === 0 && "font-medium")}>{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
      <div className="card p-4">
        <p className="label">Examples — tap to listen</p>
        <ul className="mt-2 divide-y divide-[var(--border)]">
          {lesson.examples.map((e) => (
            <li key={e.en} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="text-[15px]">{e.en}{e.note && <span className="ml-2 text-xs text-muted">({e.note})</span>}</span>
              <Speak text={e.en} />
            </li>
          ))}
        </ul>
      </div>
      <div className="card p-4">
        <p className="label">Common mistakes</p>
        <ul className="mt-2 space-y-2">
          {lesson.mistakes.map((m) => (
            <li key={m.wrong} className="rounded-xl border border-base p-3 text-sm">
              <p className="flex items-start gap-1 text-red-500"><XCircle size={16} className="mt-0.5 shrink-0" /> <span className="line-through">{m.wrong}</span></p>
              <p className="mt-1 flex items-start gap-1 font-semibold text-mint-500"><CheckCircle2 size={16} className="mt-0.5 shrink-0" /> {m.right}</p>
              <p className="mt-1 text-muted">{m.why}</p>
            </li>
          ))}
        </ul>
      </div>
      <button onClick={onNext} className="btn btn-primary w-full py-3">Start practice ({lesson.exercises.length} exercises) <ArrowRight size={16} /></button>
    </div>
  );
}

function Practice({ lesson, onDone }: { lesson: FoundationLesson; onDone: (pct: number) => void }) {
  const [i, setI] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [answered, setAnswered] = useState<{ ok: boolean } | null>(null);
  const [round, setRound] = useState(0);
  const ex = lesson.exercises[i];

  function submit(ok: boolean) {
    setAnswered({ ok });
    setResults((r) => [...r, ok]);
  }
  function next() {
    setAnswered(null);
    if (i + 1 < lesson.exercises.length) setI(i + 1);
    else onDone(Math.round((results.filter(Boolean).length / lesson.exercises.length) * 100));
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 rounded-full bg-[var(--border)]"><div className="h-2 rounded-full bg-brand-500 transition-all" style={{ width: `${(i / lesson.exercises.length) * 100}%` }} /></div>
        <span className="text-sm text-muted">{i + 1}/{lesson.exercises.length}</span>
      </div>
      <ExerciseCard key={`${round}-${i}`} ex={ex} seed={`${lesson.id}-${i}`} onSubmit={submit} locked={!!answered} />
      {answered && (
        <div className={cn("fade-in rounded-xl p-3 text-sm", answered.ok ? "bg-mint-500/10" : "bg-red-500/10")} role="status">
          <p className="font-semibold">{answered.ok ? "✅ Correct!" : "❌ Not quite."}</p>
          {!answered.ok && <p className="mt-1">Correct answer: <b>{acceptedAnswers(ex)[0]}</b></p>}
          {ex.why && <p className="mt-1 text-muted">{ex.why}</p>}
          <button onClick={next} className="btn btn-primary mt-3 w-full">{i + 1 < lesson.exercises.length ? "Next" : "Finish practice"} <ArrowRight size={16} /></button>
        </div>
      )}
      {i === 0 && !answered && results.length === 0 && round > 0 && <p className="text-center text-sm text-muted">Second try — you&apos;ve got this!</p>}
      {results.length > 0 && !answered && (
        <button onClick={() => { setI(0); setResults([]); setRound((r) => r + 1); }} className="btn btn-ghost mx-auto flex text-sm"><RotateCcw size={14} /> Restart practice</button>
      )}
    </div>
  );
}

function ExerciseCard({ ex, seed, onSubmit, locked }: { ex: Exercise; seed: string; onSubmit: (ok: boolean) => void; locked: boolean }) {
  const [value, setValue] = useState("");
  const [picked, setPicked] = useState<number | null>(null);
  const words = useMemo(() => (ex.type === "order" ? shuffledWords(ex.answer, seed) : []), [ex, seed]);
  const [used, setUsed] = useState<number[]>([]);

  if (ex.type === "mcq")
    return (
      <div className="card p-5">
        <p className="label">Choose the correct answer</p>
        <p className="mt-2 text-lg font-semibold">{ex.q}</p>
        <div className="mt-4 grid gap-2">
          {ex.options.map((o, k) => (
            <button key={o} disabled={locked} onClick={() => { setPicked(k); onSubmit(checkExercise(ex, k)); }}
              className={cn("card px-4 py-3 text-left", locked && k === ex.answer && "border-mint-500 bg-mint-500/10", locked && picked === k && k !== ex.answer && "border-red-500 bg-red-500/10")}>
              {o}
            </button>
          ))}
        </div>
      </div>
    );

  if (ex.type === "order") {
    const sentence = used.map((k) => words[k]).join(" ");
    return (
      <div className="card p-5">
        <p className="label">Put the words in the correct order</p>
        <div className="mt-3 min-h-14 rounded-xl border-2 border-dashed border-brand-300 p-3 text-lg" aria-live="polite">{sentence || <span className="text-sm text-muted">Tap the words below…</span>}</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {words.map((w, k) => (
            <button key={k} disabled={locked || used.includes(k)} onClick={() => setUsed([...used, k])} className={cn("rounded-lg border border-base px-3 py-1.5 font-medium", used.includes(k) ? "opacity-30" : "hover:border-brand-400")}>{w}</button>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <button disabled={locked || !used.length} onClick={() => setUsed(used.slice(0, -1))} className="btn btn-secondary text-sm">Undo</button>
          <button disabled={locked || used.length !== words.length} onClick={() => onSubmit(checkExercise(ex, sentence))} className="btn btn-primary ml-auto">Check</button>
        </div>
      </div>
    );
  }

  const isFix = ex.type === "fix";
  return (
    <div className="card p-5">
      <p className="label">{isFix ? "Correct this sentence" : "Fill in the blank"}</p>
      <p className={cn("mt-2 text-lg font-semibold", isFix && "text-red-500")}>{ex.q}</p>
      {ex.type === "fill" && ex.hint && <p className="mt-1 text-xs text-muted">{ex.hint}</p>}
      <form onSubmit={(e) => { e.preventDefault(); if (value.trim()) onSubmit(checkExercise(ex, value)); }} className="mt-4 flex gap-2">
        <input className="input" value={value} disabled={locked} onChange={(e) => setValue(e.target.value)} placeholder={isFix ? "Write the correct sentence" : "Your answer"} aria-label="Your answer" autoComplete="off" spellCheck={false} />
        <button disabled={locked || !value.trim()} className="btn btn-primary">Check</button>
      </form>
    </div>
  );
}

function SpeakStep({ lesson, score, next }: { lesson: FoundationLesson; score: number | null; next?: FoundationLesson }) {
  const [r, setR] = useState<SpeakingResult | null>(null);
  const [showEx, setShowEx] = useState(false);
  function submit(a: VoiceAnswer) {
    const res = scoreSpeaking({ transcript: a.text, durationSec: a.durationSec, input: a.input, confidence: a.confidence, keywords: lesson.speaking.keywords, minSeconds: lesson.speaking.minSeconds });
    setR(res);
    saveSpeakingSession({ module: "foundation", prompt: `Foundation: ${lesson.title}`, transcript: a.text, input: a.input, durationSec: a.durationSec, result: res, xp: 15 });
    setState((s) => (s.foundation?.[lesson.id] ? { ...s, foundation: { ...s.foundation, [lesson.id]: { ...s.foundation[lesson.id], spoke: true } } } : s));
  }
  return (
    <div className="space-y-4">
      {score !== null && (
        <div className="card fade-in flex items-center gap-4 p-4">
          <Trophy className="shrink-0 text-accent-500" size={32} />
          <div>
            <p className="font-bold">Practice complete: {score}% correct</p>
            <p className="text-sm text-muted">{score >= 80 ? "Excellent — you've understood this rule." : score >= 50 ? "Good progress. Review the rule and try the practice again later." : "Read the rule again and retry the practice — it gets easier!"} Now use it in speech.</p>
          </div>
        </div>
      )}
      <div className="card border-brand-400 p-4">
        <p className="label">Speaking drill</p>
        <p className="mt-1 text-lg font-semibold">{lesson.speaking.prompt}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Speak text={lesson.speaking.prompt} label="Hear the task" />
          <button onClick={() => setShowEx(!showEx)} className="btn btn-ghost px-2 py-1 text-xs">{showEx ? "Hide" : "Show"} example answer</button>
        </div>
        {showEx && <p className="mt-2 rounded-xl surface-2 p-3 text-sm">{lesson.speaking.example} <Speak text={lesson.speaking.example} /></p>}
      </div>
      <VoiceInput onSubmit={submit} minSeconds={lesson.speaking.minSeconds} submitLabel="Get my score" placeholder="Type your answer if you can't speak right now…" />
      {r && (
        <>
          <ScoreReport scores={r.scores} tips={r.tips} title="Speaking drill score" />
          <div className="card p-4"><GrammarFeedback report={r.grammar} /></div>
        </>
      )}
      {next ? (
        <Link href={`/foundation/${next.id}`} className="btn btn-primary w-full py-3">Next lesson: {next.title} <ArrowRight size={16} /></Link>
      ) : (
        <Link href="/foundation" className="btn btn-primary w-full py-3">🎓 Back to the course overview</Link>
      )}
    </div>
  );
}
