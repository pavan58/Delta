"use client";
import { useEffect, useState } from "react";
import { getReadingTest } from "@/content/ielts/reading";
import { QuestionGroups, QuestionNav, scoreGroups, type Answers } from "./Questions";
import { readingBand } from "@/lib/scoring/ielts";
import { useCountdown } from "@/lib/utils/useTimer";
import { cn, mmss } from "@/lib/utils";

export interface ReadingResult { raw: number; total: number; band: number; testId: string }

export function ReadingTest({ variant, timed, onFinish }: { variant: "academic" | "general"; timed: boolean; onFinish: (r: ReadingResult) => void }) {
  const test = getReadingTest(variant);
  const [p, setP] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [review, setReview] = useState(false);
  const allGroups = test.passages.flatMap((x) => x.groups);
  const timer = useCountdown(test.minutes * 60, () => submit());
  useEffect(() => {
    if (timed) timer.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const passage = test.passages[p];

  function submit() {
    timer.stop();
    const { raw, total } = scoreGroups(allGroups, answers);
    setReview(true);
    onFinish({ raw, total, band: readingBand(raw, total, variant), testId: test.id });
  }

  return (
    <div className="space-y-3">
      <div className="card sticky top-14 z-10 flex flex-wrap items-center gap-2 p-3">
        {test.passages.map((x, i) => (
          <button key={x.id} onClick={() => setP(i)} className={cn("chip px-3 py-1.5", p === i && "border-brand-500 bg-brand-500 text-white")}>{variant === "academic" ? `Passage ${i + 1}` : `Section ${i + 1}`}</button>
        ))}
        {timed && <span className={cn("ml-auto font-mono text-sm tabular-nums", timer.left < 300 && "text-red-500")}>⏱ {mmss(timer.left)}</span>}
        {!review && <button onClick={submit} className="btn btn-primary ml-auto py-1.5 text-sm">Submit</button>}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <article className="card max-h-[75vh] overflow-y-auto p-5 leading-relaxed">
          <h2 className="mb-3 text-xl font-bold">{passage.title}</h2>
          {passage.paragraphs.map((para, i) => (
            <p key={i} className="mb-3 text-[15px]">{para.label && <b className="mr-2 text-brand-500">{para.label}</b>}{para.text}</p>
          ))}
        </article>
        <div className="card max-h-[75vh] overflow-y-auto p-4">
          <QuestionGroups groups={passage.groups} answers={answers} onChange={(id, v) => setAnswers((a) => ({ ...a, [id]: v }))} review={review} />
          <div className="mt-4 flex justify-between">
            <button disabled={p === 0} onClick={() => setP(p - 1)} className="btn btn-secondary">← Previous</button>
            {p < test.passages.length - 1 ? <button onClick={() => setP(p + 1)} className="btn btn-secondary">Next →</button> : !review && <button onClick={submit} className="btn btn-primary">Submit answers</button>}
          </div>
        </div>
      </div>
      <div className="card p-3"><p className="label mb-2">Question navigation</p><QuestionNav groups={allGroups} answers={answers} /></div>
    </div>
  );
}
