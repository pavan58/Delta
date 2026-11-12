"use client";
import { use, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, BookOpen, Lightbulb, Target, Trophy } from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { getLesson } from "@/content/lessons/challenge";
import { VoiceInput, type VoiceAnswer } from "@/components/voice/VoiceInput";
import { GrammarFeedback, ScoreReport, Speak } from "@/components/voice/Feedback";
import { scoreSpeaking, type SpeakingResult } from "@/lib/scoring/speaking";
import { saveSpeakingSession } from "@/lib/store/actions";
import { setState, useAppState } from "@/lib/store/store";
import { XP } from "@/lib/gamification";
import { ShareButtons } from "@/components/sharing/ShareCard";

export default function DayPage({ params }: { params: Promise<{ day: string }> }) {
  const { day: dayStr } = use(params);
  const day = Number(dayStr);
  const lesson = getLesson(day);
  const prev = useAppState((s) => s.challenge[day]);
  const profile = useAppState((s) => s.profile);
  const [result, setResult] = useState<SpeakingResult | null>(null);
  const [showExample, setShowExample] = useState(false);
  if (!lesson) notFound();

  function submit(a: VoiceAnswer) {
    const r = scoreSpeaking({ transcript: a.text, durationSec: a.durationSec, input: a.input, confidence: a.confidence, keywords: lesson!.keywords, minSeconds: lesson!.minSeconds });
    setResult(r);
    const firstTime = !prev;
    saveSpeakingSession({ module: "challenge", prompt: `Day ${day}: ${lesson!.task}`, transcript: a.text, input: a.input, durationSec: a.durationSec, result: r, xp: firstTime ? XP.challengeDay : XP.speaking });
    setState((s) => {
      const old = s.challenge[day];
      // Keep the better attempt, but always keep the first completion date.
      if (old && old.score >= r.scores.overall) return s;
      return { ...s, challenge: { ...s.challenge, [day]: { day, completedAt: old?.completedAt ?? new Date().toISOString(), score: r.scores.overall, transcript: a.text, scores: r.scores } } };
    });
  }

  return (
    <div>
      <PageHeader back={{ href: "/challenge", label: "30-Day Challenge" }} title={`Day ${day}: ${lesson.title}`} subtitle={`Week ${lesson.week}${lesson.assessment ? " · Assessment day" : ""}`}>
        {prev && <span className="chip text-mint-500">{lesson.badge} Completed · best {prev.score}</span>}
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-4">
          <div className="card p-4">
            <p className="label flex items-center gap-1"><Target size={14} /> Learning objective</p>
            <p className="mt-1 font-semibold">{lesson.objective}</p>
          </div>
          <div className="card p-4">
            <p className="label flex items-center gap-1"><Lightbulb size={14} /> Short lesson</p>
            <ul className="mt-2 space-y-2 text-[15px]">
              {lesson.lesson.map((x) => <li key={x} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" /> {x}</li>)}
            </ul>
          </div>
          <div className="card p-4">
            <p className="label flex items-center gap-1"><BookOpen size={14} /> Vocabulary</p>
            <ul className="mt-2 divide-y divide-[var(--border)]">
              {lesson.vocabulary.map((v) => (
                <li key={v.word} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span><b>{v.word}</b> — <span className="text-muted">{v.meaning}</span></span>
                  <Speak text={v.word} label="Say" />
                </li>
              ))}
            </ul>
            <p className="label mt-3">Useful phrases</p>
            <div className="mt-1 flex flex-wrap gap-2">{lesson.usefulPhrases.map((p) => <span key={p} className="chip">{p}</span>)}</div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card border-brand-400 p-4">
            <p className="label">Speaking activity</p>
            <p className="mt-1 text-lg font-semibold">{lesson.task}</p>
            <p className="mt-1 text-sm text-muted">Aim for at least {lesson.minSeconds} seconds. Use 2–3 words from today&apos;s vocabulary.</p>
            <div className="mt-2 flex items-center gap-2">
              <Speak text={lesson.task} label="Hear the task" />
              <button onClick={() => setShowExample(!showExample)} className="btn btn-ghost px-2 py-1 text-xs">{showExample ? "Hide" : "Show"} example answer</button>
            </div>
            {showExample && <p className="mt-2 rounded-xl surface-2 p-3 text-sm">{lesson.example} <Speak text={lesson.example} /></p>}
          </div>
          <VoiceInput onSubmit={submit} minSeconds={lesson.minSeconds} maxSeconds={Math.max(lesson.minSeconds * 2, 120)} placeholder="Type your answer if you can't speak right now…" submitLabel="Submit & get score" />
          {result && (
            <div className="fade-in space-y-4">
              <ScoreReport scores={result.scores} tips={result.tips} title={`Day ${day} score`} />
              <div className="card p-4"><GrammarFeedback report={result.grammar} /></div>
              <div className="card flex flex-col items-center gap-3 p-5 text-center">
                <Trophy className="text-accent-500" size={32} />
                <p className="text-lg font-bold">{lesson.badge} Day {day} badge earned!</p>
                <ShareButtons kind="challenge" data={{ title: `Day ${day} of 30 complete!`, score: result.scores.overall, scores: result.scores, name: profile?.name }} />
                {day < 30 && <Link href={`/challenge/${day + 1}`} className="btn btn-primary">Next day <ArrowRight size={16} /></Link>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
