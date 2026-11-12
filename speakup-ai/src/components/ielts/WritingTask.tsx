"use client";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import type { WritingPrompt } from "@/content/ielts/writing";
import { WritingChart } from "./Diagrams";
import { evaluateWriting, type WritingEvaluation } from "@/lib/scoring/ielts";
import { aiAvailable, askAi } from "@/lib/ai/client";
import { CATEGORY_LABELS } from "@/lib/grammar/engine";
import { useCountdown } from "@/lib/utils/useTimer";
import { cn, mmss } from "@/lib/utils";
import { BandResult } from "./BandResult";
import { trackMistakes } from "@/lib/store/actions";
import { analyse } from "@/lib/grammar/engine";

export function WritingTask({ prompt, minutes, onDone, compact }: { prompt: WritingPrompt; minutes?: number; onDone?: (e: WritingEvaluation, text: string) => void; compact?: boolean }) {
  const [text, setText] = useState("");
  const [ev, setEv] = useState<WritingEvaluation | null>(null);
  const [ai, setAi] = useState("");
  const [aiOn, setAiOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useCountdown((minutes ?? 0) * 60, () => submit());
  const min = prompt.task === "task2" ? 250 : 150;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  useEffect(() => {
    if (minutes) timer.start();
    aiAvailable().then(setAiOn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt.id]);

  function submit() {
    timer.stop();
    const e = evaluateWriting(text, prompt.task, prompt.keywords);
    setEv(e);
    trackMistakes(analyse(text));
    onDone?.(e, text);
  }

  async function aiEval() {
    setBusy(true);
    const r = await askAi("ielts-writing", [{ role: "user", content: `Task: ${prompt.prompt}\n\nCandidate response:\n${text}` }]);
    setBusy(false);
    setAi("text" in r ? r.text : r.error);
  }

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <p className="label">{prompt.label} · {prompt.task === "task2" ? "Task 2" : "Task 1"}</p>
        <p className="mt-1 whitespace-pre-line text-[15px]">{prompt.prompt}</p>
        {prompt.bullets && <ul className="mt-2 list-disc pl-5 text-sm">{prompt.bullets.map((b) => <li key={b}>{b}</li>)}</ul>}
      </div>
      {prompt.chart && <WritingChart chart={prompt.chart} />}
      <div className="card p-3">
        <textarea className="input min-h-72 resize-y font-[inherit] text-[15px] leading-relaxed" value={text} disabled={!!ev} onChange={(e) => setText(e.target.value)} placeholder="Write your answer here. Leave a blank line between paragraphs." aria-label="Your essay" spellCheck={false} />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span className={cn("text-sm font-semibold", words >= min ? "text-mint-500" : "text-muted")}>{words} / {min}+ words</span>
          {minutes ? <span className={cn("font-mono text-sm", timer.left < 300 && "text-red-500")}>⏱ {mmss(timer.left)}</span> : null}
          {!ev && <button onClick={submit} disabled={words < 20} className="btn btn-primary ml-auto">Submit for evaluation</button>}
        </div>
        <p className="mt-1 text-xs text-muted">Spell-check is off, as in the computer-delivered test.</p>
      </div>
      {ev && (
        <div className="fade-in space-y-4">
          <BandResult title="Writing estimate" band={ev.band}>
            <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
              <span>{prompt.task === "task2" ? "TR" : "TA"}: <b>{ev.criteria.task}</b></span>
              <span>CC: <b>{ev.criteria.coherence}</b></span>
              <span>LR: <b>{ev.criteria.lexical}</b></span>
              <span>GRA: <b>{ev.criteria.grammar}</b></span>
            </div>
          </BandResult>
          <div className="grid gap-3 md:grid-cols-2">
            {([["task", prompt.task === "task2" ? "Task Response" : "Task Achievement"], ["coherence", "Coherence & Cohesion"], ["lexical", "Lexical Resource"], ["grammar", "Grammatical Range & Accuracy"]] as const).map(([k, l]) => (
              <div key={k} className="card p-4">
                <p className="font-semibold">{l} <span className="chip ml-1">{ev.criteria[k]}</span></p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{ev.feedback[k].map((f) => <li key={f}>{f}</li>)}</ul>
              </div>
            ))}
          </div>
          {ev.corrections.length > 0 && (
            <div className="card p-4">
              <p className="font-semibold">Mistakes & corrections</p>
              <ul className="mt-2 space-y-1 text-sm">
                {ev.corrections.slice(0, 15).map((c, i) => <li key={i}><span className="chip mr-2">{CATEGORY_LABELS[c.category]}</span><span className="text-red-500 line-through">{c.original}</span> → <b className="text-mint-500">{c.replacement}</b> <span className="text-muted">— {c.message}</span></li>)}
              </ul>
            </div>
          )}
          {ev.vocabularySuggestions.length > 0 && (
            <div className="card p-4">
              <p className="font-semibold">Vocabulary suggestions</p>
              <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">{ev.vocabularySuggestions.map((v) => <li key={v.from}>&ldquo;{v.from}&rdquo; → {v.to}</li>)}</ul>
            </div>
          )}
          <div className="card p-4">
            <p className="font-semibold">Paragraph plan for a higher band</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">{ev.paragraphTips.map((t) => <li key={t}>{t}</li>)}</ol>
            <p className="mt-3 font-semibold">Outline for this question</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{prompt.outline.map((t) => <li key={t}>{t}</li>)}</ul>
          </div>
          <details className="card p-4">
            <summary className="cursor-pointer font-semibold">{prompt.model ? "Sample improved response (model answer)" : "Your response with grammar corrections"}</summary>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{prompt.model ?? ev.correctedText}</p>
          </details>
          {!compact && aiOn && (
            <div className="card p-4">
              {ai ? <><p className="label flex items-center gap-1"><Sparkles size={14} /> AI examiner-style feedback (estimate)</p><p className="mt-2 whitespace-pre-line text-sm">{ai}</p></> : <button onClick={aiEval} disabled={busy} className="btn btn-secondary w-full"><Sparkles size={16} /> {busy ? "Evaluating…" : "Detailed AI evaluation"}</button>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
