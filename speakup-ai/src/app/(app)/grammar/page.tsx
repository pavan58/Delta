"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, RotateCcw, Sparkles, Trash2, X } from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { VoiceInput, type VoiceAnswer } from "@/components/voice/VoiceInput";
import { GrammarFeedback } from "@/components/voice/Feedback";
import { analyse, CATEGORY_LABELS, type GrammarCategory, type GrammarReport } from "@/lib/grammar/engine";
import { recordActivity, setState, useAppState } from "@/lib/store/store";
import { trackMistakes } from "@/lib/store/actions";
import { aiAvailable, askAi } from "@/lib/ai/client";
import { XP } from "@/lib/gamification";
import { normaliseAnswer } from "@/lib/scoring/ielts";
import { cn } from "@/lib/utils";

const EXAMPLES = [
  "Yesterday I go to office and discuss about the project with my manager.",
  "Myself Rahul, I am having 3 years experience in desktop support.",
  "She don't like coffee but she have tea in morning.",
  "I am working here since 2020 and I am engineer.",
];

export default function GrammarPage() {
  return (
    <Suspense>
      <Grammar />
    </Suspense>
  );
}

function Grammar() {
  const params = useSearchParams();
  const [tab, setTab] = useState<"check" | "mistakes">(params.get("tab") === "mistakes" ? "mistakes" : "check");
  const mistakes = useAppState((s) => s.mistakes);
  const open = mistakes.filter((m) => !m.revised).length;
  return (
    <div>
      <PageHeader title="Grammar & Pronunciation Coach" subtitle="Find mistakes, understand why, and practise the correct form." />
      <div className="mb-4 inline-flex rounded-xl surface-2 p-1" role="tablist">
        {([["check", "Check sentences"], ["mistakes", `My mistakes${open ? ` (${open})` : ""}`]] as const).map(([v, l]) => (
          <button key={v} role="tab" aria-selected={tab === v} onClick={() => setTab(v)} className={cn("rounded-lg px-4 py-2 text-sm font-semibold", tab === v ? "bg-[var(--surface)] shadow" : "text-muted")}>{l}</button>
        ))}
      </div>
      {tab === "check" ? <Checker /> : <MistakeTracker />}
    </div>
  );
}

function Checker() {
  const [report, setReport] = useState<GrammarReport | null>(null);
  const [ai, setAi] = useState<{ text: string; model: string } | null>(null);
  const [aiErr, setAiErr] = useState("");
  const [aiOn, setAiOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastInput, setLastInput] = useState<VoiceAnswer | null>(null);
  const [key, setKey] = useState(0);
  const settings = useAppState((s) => s.settings);
  useEffect(() => {
    aiAvailable().then(setAiOn);
  }, [settings.aiEnabled, settings.aiConsent, settings.userApiKey]);

  function check(a: VoiceAnswer) {
    const r = analyse(a.text, { source: a.input });
    setReport(r);
    setAi(null);
    setAiErr("");
    setLastInput(a);
    trackMistakes(r);
    recordActivity(XP.grammarCheck, a.input === "voice" ? a.durationSec / 60 : 0);
  }

  async function deepCheck() {
    if (!lastInput) return;
    setBusy(true);
    const r = await askAi("grammar", [{ role: "user", content: lastInput.text }]);
    setBusy(false);
    if ("text" in r) setAi(r);
    else setAiErr(r.error);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3">
        <VoiceInput key={key} onSubmit={check} defaultMode="text" placeholder="Type or speak a sentence, e.g. 'Yesterday I go to office.'" submitLabel="Check grammar" />
        <div>
          <p className="label mb-2">Try an example</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((e) => (
              <button key={e} onClick={() => { check({ text: e, input: "text", durationSec: 0, confidence: null }); setKey((k) => k + 1); }} className="chip text-left text-xs hover:border-brand-400">{e}</button>
            ))}
          </div>
        </div>
        <div className="card p-4 text-sm text-muted">
          <p className="font-semibold text-[var(--text)]">What the free checker covers</p>
          <p className="mt-1">Tenses after time words, articles (a/an/the), prepositions, subject–verb agreement, word order in questions, state verbs, uncountable nouns, common Indian-English expressions, spelling, repeated words and fillers.</p>
          <p className="mt-2"><b>Pronunciation:</b> when you speak, we show how clearly your words were recognised. This is an indicator, not phoneme-level pronunciation analysis.</p>
        </div>
      </div>
      <div className="space-y-3">
        {report ? (
          <>
            <div className="card p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-semibold">Original: <span className="font-normal text-muted">{report.input}</span></p>
                <span className="chip">Accuracy {report.score}/100</span>
              </div>
              <GrammarFeedback report={report} />
            </div>
            {aiOn ? (
              <div className="card p-4">
                {ai ? (
                  <>
                    <p className="label flex items-center gap-1"><Sparkles size={14} /> AI contextual check · {ai.model}</p>
                    <p className="mt-2 whitespace-pre-line text-sm">{ai.text}</p>
                  </>
                ) : (
                  <button onClick={deepCheck} disabled={busy} className="btn btn-secondary w-full"><Sparkles size={16} /> {busy ? "Checking…" : "Deeper AI check (uses 1 AI request)"}</button>
                )}
                {aiErr && <p className="mt-2 text-sm text-amber-600">{aiErr}</p>}
              </div>
            ) : (
              <p className="text-xs text-muted">Want context-aware corrections? Turn on AI in Settings (optional, uses an AI provider).</p>
            )}
          </>
        ) : (
          <div className="card grid min-h-60 place-items-center p-6 text-center text-muted">Your corrections will appear here.</div>
        )}
      </div>
    </div>
  );
}

function MistakeTracker() {
  const mistakes = useAppState((s) => s.mistakes);
  const [filter, setFilter] = useState<"open" | "revised" | "all">("open");
  const [cat, setCat] = useState<GrammarCategory | "">("");
  const list = mistakes.filter((m) => (filter === "all" || (filter === "open" ? !m.revised : m.revised)) && (!cat || m.category === cat));
  const counts: Partial<Record<GrammarCategory, number>> = {};
  for (const m of mistakes) counts[m.category] = (counts[m.category] ?? 0) + 1;

  if (!mistakes.length) return <div className="card p-8 text-center text-muted">No mistakes tracked yet. Every correction from speaking practice, the 30-day challenge and the grammar checker is saved here so you can revise it.</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(["open", "revised", "all"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={cn("chip px-3 py-1.5 capitalize", filter === f && "border-brand-500 bg-brand-500 text-white")}>{f}</button>
        ))}
        <span className="mx-1 border-l border-base" />
        <button onClick={() => setCat("")} className={cn("chip px-3 py-1.5", !cat && "border-brand-500")}>All types</button>
        {Object.entries(counts).map(([c, n]) => (
          <button key={c} onClick={() => setCat(c as GrammarCategory)} className={cn("chip px-3 py-1.5", cat === c && "border-brand-500")}>{CATEGORY_LABELS[c as GrammarCategory]} · {n}</button>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {list.slice(0, 60).map((m) => <MistakeCard key={m.id} id={m.id} />)}
      </div>
      {list.length === 0 && <p className="text-muted">Nothing here. 🎉</p>}
    </div>
  );
}

function MistakeCard({ id }: { id: string }) {
  const m = useAppState((s) => s.mistakes.find((x) => x.id === id));
  const [attempt, setAttempt] = useState("");
  const [result, setResult] = useState<"ok" | "wrong" | null>(null);
  const [show, setShow] = useState(false);
  if (!m) return null;

  function tryIt() {
    if (!m) return;
    const r = analyse(attempt);
    const matches = normaliseAnswer(attempt) === normaliseAnswer(m.corrected);
    const ok = matches || (r.issues.filter((i) => i.category !== "punctuation").length === 0 && normaliseAnswer(attempt).length > 3 && !attempt.toLowerCase().includes(m.original.toLowerCase()));
    setResult(ok ? "ok" : "wrong");
    setState((s) => ({ ...s, mistakes: s.mistakes.map((x) => (x.id === id ? { ...x, attempts: x.attempts + 1, revised: ok || x.revised } : x)) }));
    if (ok) recordActivity(XP.mistakeRevised, 0, false);
  }

  return (
    <div className={cn("card p-4", m.revised && "opacity-75")}>
      <div className="flex items-start justify-between gap-2">
        <span className="chip">{CATEGORY_LABELS[m.category]}</span>
        <button onClick={() => setState((s) => ({ ...s, mistakes: s.mistakes.filter((x) => x.id !== id) }))} className="text-muted hover:text-red-500" aria-label="Delete mistake"><Trash2 size={16} /></button>
      </div>
      <p className="mt-2 text-sm text-red-500 line-through">{m.original}</p>
      <p className="mt-1 text-xs text-muted">{m.reason}</p>
      {m.revised ? (
        <p className="mt-2 flex items-center gap-1 text-sm font-semibold text-mint-500"><Check size={16} /> Revised · {m.corrected}</p>
      ) : (
        <div className="mt-3">
          <label className="label" htmlFor={`fix-${id}`}>Write the correct sentence</label>
          <div className="mt-1 flex gap-2">
            <input id={`fix-${id}`} className="input text-sm" value={attempt} onChange={(e) => { setAttempt(e.target.value); setResult(null); }} onKeyDown={(e) => e.key === "Enter" && attempt && tryIt()} />
            <button onClick={tryIt} disabled={!attempt} className="btn btn-primary px-3">Check</button>
          </div>
          {result === "wrong" && <p className="mt-1 flex items-center gap-1 text-sm text-amber-600"><X size={14} /> Not quite. Try again or reveal the answer.</p>}
          {result === "ok" && <p className="mt-1 text-sm text-mint-500">Correct! +{XP.mistakeRevised} XP</p>}
          <button onClick={() => setShow(!show)} className="mt-2 flex items-center gap-1 text-xs font-semibold text-brand-500"><RotateCcw size={12} /> {show ? "Hide" : "Reveal"} answer</button>
          {show && <p className="mt-1 text-sm">{m.corrected}</p>}
        </div>
      )}
    </div>
  );
}
