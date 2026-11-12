"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Swords } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { getLesson } from "@/content/lessons/challenge";
import { VoiceInput, type VoiceAnswer } from "@/components/voice/VoiceInput";
import { GrammarFeedback, ScoreReport } from "@/components/voice/Feedback";
import { scoreSpeaking, type SpeakingResult } from "@/lib/scoring/speaking";
import { ShareButtons } from "@/components/sharing/ShareCard";

export default function Page() {
  return <Suspense><ChallengeFriend /></Suspense>;
}

function ChallengeFriend() {
  const q = useSearchParams();
  const day = Math.min(30, Math.max(1, Number(q.get("d")) || 1));
  const name = (q.get("n") ?? "Your friend").replace(/[<>]/g, "").slice(0, 30);
  const theirs = q.get("s") !== null && /^\d{1,3}$/.test(q.get("s")!) ? Math.min(100, Number(q.get("s"))) : null;
  const lesson = getLesson(day)!;
  const [r, setR] = useState<SpeakingResult | null>(null);
  const submit = (a: VoiceAnswer) => setR(scoreSpeaking({ transcript: a.text, durationSec: a.durationSec, input: a.input, confidence: a.confidence, keywords: lesson.keywords, minSeconds: lesson.minSeconds }));
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Logo />
      <div className="card mt-6 p-5 text-center">
        <Swords className="mx-auto text-red-500" size={32} />
        <h1 className="mt-2 text-2xl font-extrabold">{name} challenged you!</h1>
        <p className="mt-1 text-muted">{theirs !== null ? <>They scored <b>{theirs}/100</b>. Can you beat it?</> : "Try the same speaking task and compare your scores."}</p>
      </div>
      <div className="card mt-4 p-4"><p className="label">Speaking task · {lesson.title}</p><p className="mt-1 text-lg font-semibold">{lesson.task}</p></div>
      <div className="mt-4"><VoiceInput onSubmit={submit} minSeconds={lesson.minSeconds} submitLabel="Get my score" /></div>
      {r && (
        <div className="mt-4 space-y-4">
          {theirs !== null && <p className="card p-4 text-center text-lg font-bold">{r.scores.overall > theirs ? "🏆 You win!" : r.scores.overall === theirs ? "🤝 It's a tie!" : "So close! Practise and try again."} You: {r.scores.overall} · {name}: {theirs}</p>}
          <ScoreReport scores={r.scores} tips={r.tips} />
          <div className="card p-4"><GrammarFeedback report={r.grammar} /></div>
          <div className="card p-4 text-center"><ShareButtons kind="daily" data={{ score: r.scores.overall, scores: r.scores, streak: 0 }} /></div>
        </div>
      )}
      <div className="mt-6 text-center"><Link href="/start" className="btn btn-primary">Start your own free English practice</Link></div>
      <p className="mt-4 text-center text-xs text-muted">This attempt is not saved. Scores are automated estimates.</p>
    </div>
  );
}
