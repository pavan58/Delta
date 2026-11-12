"use client";
import { CheckCircle2, XCircle } from "lucide-react";
import type { Question, QuestionGroup } from "@/content/ielts/types";
import { isCorrectAnswer } from "@/lib/scoring/ielts";
import { cn } from "@/lib/utils";
import { ParkMap } from "./Diagrams";

export type Answers = Record<number, string>;

const LETTERS = "ABCDEFGHIJ";

export function scoreGroups(groups: QuestionGroup[], answers: Answers) {
  let raw = 0;
  let total = 0;
  for (const g of groups)
    for (const q of g.questions) {
      total++;
      if (isCorrectAnswer(answers[q.id] ?? "", q.answer)) raw++;
    }
  return { raw, total };
}

export function QuestionGroups({ groups, answers, onChange, review }: { groups: QuestionGroup[]; answers: Answers; onChange: (id: number, v: string) => void; review: boolean }) {
  return (
    <div className="space-y-6">
      {groups.map((g, gi) => (
        <section key={gi}>
          <p className="mb-3 rounded-lg surface-2 p-3 text-sm font-semibold">{g.instructions}</p>
          {g.diagram === "park-map" && <ParkMap />}
          {g.optionList && (
            <ul className="mb-3 grid gap-1 rounded-lg border border-base p-3 text-sm sm:grid-cols-2">
              {g.optionList.map((o) => <li key={o.key}><b>{o.key}</b> {o.text !== `Paragraph ${o.key}` && o.text !== `Notice ${o.key}` ? o.text : ""}</li>)}
            </ul>
          )}
          <ol className="space-y-3">
            {g.questions.map((q) => <QuestionItem key={q.id} q={q} value={answers[q.id] ?? ""} onChange={(v) => onChange(q.id, v)} review={review} />)}
          </ol>
        </section>
      ))}
    </div>
  );
}

function QuestionItem({ q, value, onChange, review }: { q: Question; value: string; onChange: (v: string) => void; review: boolean }) {
  const correct = review && isCorrectAnswer(value, q.answer);
  const display = q.type === "mcq" && q.options ? q.options[LETTERS.indexOf(q.answer.split("|")[0])] : q.answer.split("|")[0];
  return (
    <li id={`q-${q.id}`} className={cn("rounded-xl border border-base p-3", review && (correct ? "border-mint-500 bg-mint-500/5" : "border-red-400 bg-red-500/5"))}>
      <div className="flex gap-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-600 text-xs font-bold text-white">{q.id}</span>
        <div className="min-w-0 flex-1">
          {q.type === "gap" ? (
            <label className="block text-[15px]">
              {q.prompt.split("________").map((part, i, arr) => (
                <span key={i}>
                  {part}
                  {i < arr.length - 1 && (
                    <input
                      className="input mx-1 inline-block w-40 px-2 py-1 align-middle text-sm"
                      value={value}
                      disabled={review}
                      onChange={(e) => onChange(e.target.value)}
                      aria-label={`Answer for question ${q.id}`}
                      autoComplete="off"
                      spellCheck={false}
                    />
                  )}
                </span>
              ))}
            </label>
          ) : (
            <>
              <p className="text-[15px]">{q.prompt}</p>
              <div className={cn("mt-2 flex flex-wrap gap-2", q.type === "mcq" && "flex-col")} role="radiogroup" aria-label={`Question ${q.id}`}>
                {(q.type === "mcq" ? (q.options ?? []).map((o, i) => ({ key: LETTERS[i], label: `${LETTERS[i]}  ${o}` })) : (q.options ?? []).map((o) => ({ key: o, label: o }))).map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    role="radio"
                    aria-checked={value === o.key}
                    disabled={review}
                    onClick={() => onChange(o.key)}
                    className={cn("rounded-lg border px-3 py-1.5 text-left text-sm transition", value === o.key ? "border-brand-500 bg-brand-500 text-white" : "border-base hover:border-brand-400")}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </>
          )}
          {review && (
            <p className={cn("mt-2 flex items-start gap-1 text-sm", correct ? "text-mint-500" : "text-red-500")}>
              {correct ? <CheckCircle2 size={16} className="mt-0.5" /> : <XCircle size={16} className="mt-0.5" />}
              <span>
                {correct ? "Correct" : <>Answer: <b>{display}</b>{value ? ` (you wrote: ${value})` : " (no answer)"}</>}
                {q.explanation && <span className="block text-muted">{q.explanation}</span>}
              </span>
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

export function QuestionNav({ groups, answers }: { groups: QuestionGroup[]; answers: Answers }) {
  const ids = groups.flatMap((g) => g.questions.map((q) => q.id));
  return (
    <nav className="flex flex-wrap gap-1" aria-label="Question navigation">
      {ids.map((id) => (
        <a key={id} href={`#q-${id}`} className={cn("grid h-7 w-7 place-items-center rounded-md text-xs font-semibold", answers[id] ? "bg-brand-500 text-white" : "surface-2 text-muted")}>{id}</a>
      ))}
    </nav>
  );
}
