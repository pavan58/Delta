"use client";
import { useMemo, useState } from "react";
import { ArrowRight, Bot, Briefcase, Lightbulb, RotateCcw, Sparkles, Volume2 } from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { INTERVIEW_CATEGORIES, INTERVIEW_INTROS, type InterviewCategory, type InterviewQuestion } from "@/content/interviews/questions";
import { VoiceInput, type VoiceAnswer } from "@/components/voice/VoiceInput";
import { GrammarFeedback, Speak } from "@/components/voice/Feedback";
import { Bar, EstimateNote, ScoreRing } from "@/components/ui/Score";
import { ShareButtons } from "@/components/sharing/ShareCard";
import { scoreInterviewAnswer } from "@/lib/scoring/interview";
import { aiAvailable, askAi } from "@/lib/ai/client";
import { recordActivity, setState, useAppState } from "@/lib/store/store";
import { trackMistakes } from "@/lib/store/actions";
import { useSpeechSynthesis } from "@/lib/speech/useSpeechSynthesis";
import { useCustomContent } from "@/lib/content/custom";
import { XP } from "@/lib/gamification";
import type { InterviewAnswer, InterviewSession } from "@/lib/store/types";
import { avg, cn, uid } from "@/lib/utils";

type Phase = "pick" | "interview" | "report";

interface Turn {
  question: InterviewQuestion;
  followUp?: boolean;
  answer?: InterviewAnswer;
  evalData?: ReturnType<typeof scoreInterviewAnswer>;
  ai?: string;
}

const FOLLOW_UPS = [
  "What was the final result, and what did you learn from it?",
  "Can you give me a specific example of that?",
  "What would you do differently if you faced the same situation again?",
  "How did you measure success in that situation?",
];

function shuffle<T>(xs: T[]) {
  return [...xs].sort(() => Math.random() - 0.5);
}

export default function InterviewPage() {
  const custom = useCustomContent().interview;
  const categories = useMemo<InterviewCategory[]>(
    () => INTERVIEW_CATEGORIES.map((c) => ({ ...c, questions: [...c.questions, ...custom.filter((q) => q.category === c.id)] })),
    [custom],
  );
  const history = useAppState((s) => s.interviews);
  const [phase, setPhase] = useState<Phase>("pick");
  const [cat, setCat] = useState<InterviewCategory | null>(null);
  const [count, setCount] = useState(5);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [idx, setIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState<InterviewSession | null>(null);
  const tts = useSpeechSynthesis();
  const settings = useAppState((s) => s.settings);
  const say = (t: string) => tts.speak(t, { rate: settings.speechRate, voiceURI: settings.voiceURI });

  function start(c: InterviewCategory) {
    const qs = c.id === "hr" || c.id === "fresher" ? [c.questions[0], ...shuffle(c.questions.slice(1))] : shuffle(c.questions);
    const picked = qs.slice(0, Math.min(count, qs.length));
    setCat(c);
    setTurns(picked.map((q) => ({ question: q })));
    setIdx(0);
    setPhase("interview");
    say(`${INTERVIEW_INTROS.default} ${picked[0].q}`);
  }

  async function answer(a: VoiceAnswer) {
    const t = turns[idx];
    const e = scoreInterviewAnswer({ answer: a.text, input: a.input, durationSec: a.durationSec, confidence: a.confidence, keywords: t.question.keywords, behavioural: t.question.behavioural });
    trackMistakes(e.speaking.grammar);
    const ans: InterviewAnswer = { question: t.question.q, answer: a.text, input: a.input, durationSec: Math.round(a.durationSec), scores: e.scores, corrected: e.speaking.grammar.professional, feedback: e.feedback };
    const next = [...turns];
    next[idx] = { ...t, answer: ans, evalData: e };
    // Ask one follow-up for some main questions (realistic interviewer behaviour).
    const followUpsSoFar = next.filter((x) => x.followUp).length;
    if (!t.followUp && followUpsSoFar < 2 && (t.question.behavioural || idx % 2 === 1)) {
      const fq = t.question.behavioural && !/result|outcome|learn/i.test(a.text) ? FOLLOW_UPS[0] : FOLLOW_UPS[(idx + 1) % FOLLOW_UPS.length];
      next.splice(idx + 1, 0, { question: { q: fq, keywords: ["result", "example", "learned", "because", "specific"], tip: "Answer briefly and specifically.", behavioural: true }, followUp: true });
    }
    setTurns(next);
    if (await aiAvailable()) {
      setBusy(true);
      const r = await askAi("interview", [{ role: "user", content: `Job category: ${cat?.title}\nQuestion: ${t.question.q}\nCandidate answer: ${a.text}` }]);
      setBusy(false);
      if ("text" in r) setTurns((cur) => cur.map((x, i) => (i === idx ? { ...x, ai: r.text } : x)));
    }
  }

  function nextQuestion() {
    if (idx + 1 < turns.length) {
      setIdx(idx + 1);
      say(turns[idx + 1].question.q);
    } else finish();
  }

  function finish() {
    const answers = turns.filter((t) => t.answer).map((t) => t.answer!);
    if (!answers.length) {
      setPhase("pick");
      return;
    }
    const total = Math.round(avg(answers.map((a) => a.scores.total)));
    const s: InterviewSession = { id: uid(), date: new Date().toISOString(), category: cat!.title, answers, total };
    setSession(s);
    setState((st) => ({ ...st, interviews: [s, ...st.interviews].slice(0, 100) }));
    recordActivity(XP.interview, answers.filter((a) => a.input === "voice").reduce((m, a) => m + a.durationSec, 0) / 60);
    setPhase("report");
    say(`Thank you, that's the end of the interview. Your overall score is ${total} out of 100.`);
  }

  if (phase === "pick")
    return (
      <div>
        <PageHeader title="AI Job Interview Simulator" subtitle="Realistic, one-question-at-a-time mock interviews with scores and better sample answers." />
        <div className="mb-4 flex items-center gap-3">
          <label className="label" htmlFor="qcount">Questions</label>
          <select id="qcount" className="input w-24" value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {[3, 5, 7].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => (
            <button key={c.id} onClick={() => start(c)} className="card p-4 text-left transition hover:border-brand-400">
              <div className="flex items-center justify-between"><span className="text-2xl">{c.emoji}</span><span className="text-xs text-muted">{c.questions.length} questions</span></div>
              <p className="mt-2 font-semibold">{c.title}</p>
              <p className="mt-1 text-sm text-muted">{c.description}</p>
            </button>
          ))}
        </div>
        {history.length > 0 && (
          <div className="card mt-6 p-4">
            <h2 className="font-semibold">Past interviews</h2>
            <ul className="mt-2 divide-y divide-[var(--border)] text-sm">
              {history.slice(0, 8).map((h) => (
                <li key={h.id} className="flex justify-between py-2"><span>{h.category} · {new Date(h.date).toLocaleDateString()}</span><span className="font-semibold">{h.total}/100</span></li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );

  if (phase === "report" && session) {
    const parts = ["communication", "grammar", "vocabulary", "relevance", "fluency"] as const;
    const max = { communication: 20, grammar: 20, vocabulary: 15, relevance: 20, fluency: 15 };
    const pron = session.answers.map((a) => a.scores.pronunciation).filter((v): v is number => v !== null);
    const allFeedback = [...new Set(session.answers.flatMap((a) => a.feedback))].slice(0, 5);
    return (
      <div>
        <PageHeader title="Interview report" subtitle={`${session.category} · ${session.answers.length} answers`} />
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="card flex flex-col items-center gap-3 p-5 text-center">
            <ScoreRing value={session.total} size={140} label="Total" />
            <p className="text-sm text-muted">{session.total >= 80 ? "Strong performance — you're interview-ready for this role." : session.total >= 60 ? "Good foundation. Work on the points below." : "Keep practising — focus on structure and examples."}</p>
            <ShareButtons kind="interview" data={{ title: session.category, score: session.total }} compact />
          </div>
          <div className="card space-y-3 p-5">
            {parts.map((p) => <Bar key={p} label={p[0].toUpperCase() + p.slice(1)} value={Math.round(avg(session.answers.map((a) => a.scores[p])))} max={max[p]} />)}
            <Bar label="Pronunciation" note="estimate from recognition clarity" value={pron.length ? Math.round(avg(pron)) : null} max={10} />
            <div className="pt-2">
              <p className="font-semibold">Top improvements</p>
              <ul className="mt-1 space-y-1 text-sm">{allFeedback.map((f) => <li key={f} className="flex gap-2"><Lightbulb size={16} className="mt-0.5 shrink-0 text-accent-500" /> {f}</li>)}</ul>
            </div>
            <EstimateNote />
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {session.answers.map((a, i) => (
            <details key={i} className="card p-4">
              <summary className="cursor-pointer font-semibold">Q{i + 1}. {a.question} <span className="float-right text-sm">{a.scores.total}/100</span></summary>
              <p className="mt-2 text-sm"><span className="label">Your answer: </span>{a.answer}</p>
              <p className="mt-2 text-sm"><span className="label">Polished version: </span>{a.corrected}</p>
            </details>
          ))}
        </div>
        <button onClick={() => setPhase("pick")} className="btn btn-primary mt-4"><RotateCcw size={16} /> Start another interview</button>
      </div>
    );
  }

  const t = turns[idx];
  return (
    <div>
      <PageHeader title={`${cat?.emoji} ${cat?.title}`} subtitle={`Question ${idx + 1} of ${turns.length}${t.followUp ? " · follow-up" : ""}`}>
        <button onClick={finish} className="btn btn-secondary text-sm">End interview</button>
      </PageHeader>
      <div className="mb-4 h-2 rounded-full bg-[var(--border)]"><div className="h-2 rounded-full bg-brand-500 transition-all" style={{ width: `${(idx / turns.length) * 100}%` }} /></div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="card p-5">
            <div className="flex items-center gap-2 text-sm text-muted"><Briefcase size={16} /> Interviewer</div>
            <p className="mt-2 text-xl font-semibold">{t.question.q}</p>
            <div className="mt-2 flex gap-1">
              <button onClick={() => say(t.question.q)} className="btn btn-ghost px-2 py-1 text-xs"><Volume2 size={14} /> Repeat question</button>
            </div>
            <details className="mt-2 text-sm text-muted"><summary className="cursor-pointer font-semibold text-brand-500">Need a hint?</summary><p className="mt-1">{t.question.tip}</p></details>
          </div>
          {!t.answer ? (
            <VoiceInput key={idx} onSubmit={answer} minSeconds={30} maxSeconds={180} submitLabel="Submit answer" placeholder="Type your answer…" />
          ) : (
            <button onClick={nextQuestion} className="btn btn-primary w-full py-3">{idx + 1 < turns.length ? <>Next question <ArrowRight size={16} /></> : "Finish & see report"}</button>
          )}
        </div>
        <div className="space-y-3">
          {t.answer && t.evalData ? (
            <>
              <div className="card p-4">
                <div className="flex items-center gap-4">
                  <ScoreRing value={t.answer.scores.total} size={84} label="/100" />
                  <div className="flex-1 space-y-1.5 text-sm">
                    <Bar label="Communication" value={t.answer.scores.communication} max={20} />
                    <Bar label="Relevance" value={t.answer.scores.relevance} max={20} />
                  </div>
                </div>
                <ul className="mt-3 space-y-1 text-sm">{t.answer.feedback.map((f) => <li key={f} className="flex gap-2"><Lightbulb size={16} className="mt-0.5 shrink-0 text-accent-500" /> {f}</li>)}</ul>
              </div>
              <div className="card p-4">
                <p className="mb-2 font-semibold">Grammar corrections</p>
                <GrammarFeedback report={t.evalData.speaking.grammar} />
              </div>
              <div className="card p-4">
                {t.ai ? (
                  <>
                    <p className="label flex items-center gap-1"><Sparkles size={14} /> AI feedback & better answer</p>
                    <p className="mt-2 whitespace-pre-line text-sm">{t.ai}</p>
                  </>
                ) : busy ? (
                  <p className="text-sm text-muted">AI is preparing a better answer…</p>
                ) : t.question.sample ? (
                  <>
                    <p className="label flex items-center gap-1"><Bot size={14} /> Sample strong answer (from our question bank)</p>
                    <p className="mt-2 text-sm">{t.question.sample} <Speak text={t.question.sample} /></p>
                  </>
                ) : (
                  <>
                    <p className="label flex items-center gap-1"><Bot size={14} /> How to make it stronger</p>
                    <p className="mt-2 text-sm">{t.question.tip}</p>
                    <p className="mt-2 text-sm"><span className="font-semibold">Your answer, polished:</span> {t.answer.corrected}</p>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className={cn("card p-5 text-sm text-muted")}>
              <p className="font-semibold text-[var(--text)]">Interview tips</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Pause for 2–3 seconds to think — that&apos;s normal.</li>
                <li>Aim for 45–90 seconds per answer.</li>
                <li>Use a real example. For &ldquo;tell me about a time&rdquo; questions, use STAR: Situation, Task, Action, Result.</li>
                <li>End with a clear conclusion.</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
