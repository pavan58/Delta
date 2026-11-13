"use client";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Target, Volume2 } from "lucide-react";
import { DAILY_BY_ID, DAILY_CATEGORIES, DAILY_CATEGORY_BY_ID, DAILY_WORDS, type DailyWord } from "@/content/vocabulary/daily-needs";
import { DAILY_GOALS, ensureDailyPlan, markLearned, remainingNewWords } from "@/lib/vocab/daily";
import { getState, recordActivity, setState, updateSettings, useAppState } from "@/lib/store/store";
import { useSpeechSynthesis } from "@/lib/speech/useSpeechSynthesis";
import { ScoreRing } from "@/components/ui/Score";
import { ShareButtons } from "@/components/sharing/ShareCard";
import { XP } from "@/lib/gamification";
import { cn, localDate } from "@/lib/utils";

const BATCH = 10;

function useTodayPlan() {
  const plan = useAppState((s) => s.dailyWords);
  const goal = useAppState((s) => s.settings.dailyGoal);
  const cats = useAppState((s) => s.settings.dailyCategories.join(","));
  useEffect(() => {
    const s = getState();
    const next = ensureDailyPlan(s);
    if (JSON.stringify(next) !== JSON.stringify(s.dailyWords)) setState((st) => ({ ...st, dailyWords: next }), { silent: true });
  }, [goal, cats, plan?.date]);
  return plan && plan.date === localDate() ? plan : null;
}

function learn(id: string) {
  const first = (getState().dailyWords?.learned.length ?? 0) === 0;
  setState((s) => markLearned(s, id));
  recordActivity(XP.dailyWord, 0.2, first);
}

export function DailyWords() {
  const plan = useTodayPlan();
  const settings = useAppState((s) => s.settings);
  const learnedAll = useAppState((s) => s.learnedWords);
  const [mode, setMode] = useState<"home" | "study" | "test" | "topic">("home");
  const [batch, setBatch] = useState<string[]>([]);
  const [topic, setTopic] = useState<string | null>(null);
  if (!plan) return <div className="h-40 animate-pulse rounded-2xl surface-2" />;

  const goal = settings.dailyGoal;
  const done = plan.learned.length;
  const pending = plan.ids.filter((id) => !plan.learned.includes(id));
  const startBatch = () => {
    setBatch(pending.slice(0, BATCH));
    setMode("study");
    window.scrollTo({ top: 0 });
  };

  if (mode === "study") return <Study ids={batch} onBack={() => setMode("home")} onTest={() => setMode("test")} />;
  if (mode === "test") return <Test ids={batch} onDone={() => setMode("home")} />;
  if (mode === "topic" && topic) return <TopicView id={topic} onBack={() => setMode("home")} />;

  const toggleCat = (id: string) => {
    const cur = settings.dailyCategories;
    updateSettings({ dailyCategories: cur.includes(id) ? cur.filter((c) => c !== id) : [...cur, id] });
  };
  const left = remainingNewWords({ learnedWords: learnedAll });

  return (
    <div className="space-y-4">
      <div className="card flex flex-col items-center gap-4 p-5 sm:flex-row">
        <ScoreRing value={done} max={goal} size={120} label="today" suffix={`/${goal}`} />
        <div className="flex-1 text-center sm:text-left">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-500">Daily Needs Vocabulary</p>
          <h2 className="text-xl font-bold">{done >= goal ? `🎉 Goal reached: ${done} new words today!` : `Learn ${goal} new everyday words today`}</h2>
          <p className="mt-1 text-sm text-muted">Study 10 picture words, take a quick test, repeat. Every word you learn comes back for review tomorrow and again over the next weeks so you don&apos;t forget it.</p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            {pending.length > 0 ? (
              <button onClick={startBatch} className="btn btn-primary">{done ? "Next" : "Start"} {Math.min(BATCH, pending.length)} words <ArrowRight size={16} /></button>
            ) : done < goal ? (
              <span className="text-sm text-muted">You&apos;ve learned every word in the selected topics. Choose more topics below.</span>
            ) : null}
            <label className="flex items-center gap-2 text-sm"><Target size={16} className="text-muted" /> Daily goal
              <select className="input w-24 py-1.5" value={goal} onChange={(e) => updateSettings({ dailyGoal: Number(e.target.value) })} aria-label="Daily word goal">
                {DAILY_GOALS.map((g) => <option key={g} value={g}>{g} words</option>)}
              </select>
            </label>
          </div>
        </div>
      </div>

      {done >= goal && <div className="card p-4 text-center"><ShareButtons kind="weekly" data={{ lines: [`I learned ${done} new English words today! 📚`, `Total words learned: ${learnedAll.length}`] }} /></div>}

      <div className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold">Today&apos;s words ({done}/{plan.ids.length})</p>
          <p className="text-xs text-muted">{left} new words left in the bank</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {plan.ids.map((id) => {
            const w = DAILY_BY_ID.get(id);
            if (!w) return null;
            const ok = plan.learned.includes(id);
            return <span key={id} title={`${w.word} — ${w.hi}`} className={cn("chip", ok ? "border-mint-500 text-mint-600 dark:text-mint-500" : "opacity-70")}>{w.emoji} {ok ? w.word : "?"}</span>;
          })}
        </div>
      </div>

      <div className="card p-4">
        <p className="font-semibold">Topics for my daily words</p>
        <p className="text-sm text-muted">{settings.dailyCategories.length ? "Only selected topics are used." : "All topics are mixed. Tap topics to focus on them (e.g. animals, fruits, plants)."}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => updateSettings({ dailyCategories: [] })} className={cn("chip px-3 py-1.5", !settings.dailyCategories.length && "border-brand-500 bg-brand-500 text-white")}>All topics</button>
          {DAILY_CATEGORIES.map((c) => (
            <button key={c.id} onClick={() => toggleCat(c.id)} aria-pressed={settings.dailyCategories.includes(c.id)} className={cn("chip px-3 py-1.5", settings.dailyCategories.includes(c.id) && "border-brand-500 bg-brand-500 text-white")}>{c.emoji} {c.label}</button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 font-semibold">Browse by topic</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {DAILY_CATEGORIES.map((c) => {
            const words = DAILY_WORDS.filter((w) => w.category === c.id);
            const known = words.filter((w) => learnedAll.includes(w.id)).length;
            return (
              <button key={c.id} onClick={() => { setTopic(c.id); setMode("topic"); window.scrollTo({ top: 0 }); }} className="card p-3 text-left hover:border-brand-400">
                <div className="text-3xl" aria-hidden>{c.emoji}</div>
                <p className="mt-1 font-semibold">{c.label}</p>
                <div className="mt-1 h-1.5 rounded-full bg-[var(--border)]"><div className="h-1.5 rounded-full bg-mint-500" style={{ width: `${(known / words.length) * 100}%` }} /></div>
                <p className="mt-1 text-xs text-muted">{known}/{words.length} learned</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SayButton({ text, label }: { text: string; label: string }) {
  const tts = useSpeechSynthesis();
  const rate = useAppState((s) => s.settings.speechRate);
  if (!tts.supported) return null;
  return <button onClick={() => tts.speak(text, { rate })} className="btn btn-ghost p-1.5" aria-label={label}><Volume2 size={16} /></button>;
}

function PictureCard({ w, learned }: { w: DailyWord; learned?: boolean }) {
  return (
    <div className={cn("card min-w-0 p-3 sm:p-4", learned && "border-mint-500")}>
      <div className="flex items-start justify-between">
        <span className="text-5xl leading-none" aria-hidden>{w.emoji}</span>
        <div className="flex items-center">
          {learned && <CheckCircle2 size={18} className="text-mint-500" aria-label="learned" />}
          <SayButton text={w.word} label={`Say ${w.word}`} />
        </div>
      </div>
      <p className="mt-2 break-words text-lg font-bold sm:text-xl">{w.word}</p>
      <p className="text-[15px]" lang="hi">{w.hi}</p>
      <p className="mt-2 flex items-start gap-1 text-sm italic text-muted">{w.example} <SayButton text={w.example} label={`Say example for ${w.word}`} /></p>
      <p className="mt-1 text-[11px] uppercase tracking-wide text-muted">{DAILY_CATEGORY_BY_ID.get(w.category)?.label}</p>
    </div>
  );
}

function Study({ ids, onBack, onTest }: { ids: string[]; onBack: () => void; onTest: () => void }) {
  const words = ids.map((id) => DAILY_BY_ID.get(id)!).filter(Boolean);
  const tts = useSpeechSynthesis();
  const rate = useAppState((s) => s.settings.speechRate);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button onClick={onBack} className="btn btn-ghost text-sm"><ArrowLeft size={16} /> Back</button>
        <p className="text-sm text-muted">Look, listen and say each word aloud 2–3 times.</p>
        {tts.supported && <button onClick={() => tts.speak(words.map((w) => w.word).join(". "), { rate: rate * 0.85 })} className="btn btn-secondary text-sm"><Volume2 size={16} /> Hear all</button>}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">{words.map((w) => <PictureCard key={w.id} w={w} />)}</div>
      <button onClick={onTest} className="btn btn-primary w-full py-3">I&apos;ve studied these — test me <ArrowRight size={16} /></button>
    </div>
  );
}

interface Q { id: string; kind: "pic-to-word" | "word-to-hindi"; options: string[]; answer: string }

function makeQuestion(w: DailyWord, i: number): Q {
  const same = DAILY_WORDS.filter((x) => x.category === w.category && x.id !== w.id);
  const pool = same.length >= 3 ? same : DAILY_WORDS.filter((x) => x.id !== w.id);
  let h = 0;
  for (const c of w.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const picks: DailyWord[] = [];
  for (let k = 0; picks.length < 3 && k < pool.length * 2; k++) {
    const cand = pool[(h + k * 7) % pool.length];
    if (!picks.includes(cand) && cand.word !== w.word && cand.hi !== w.hi) picks.push(cand);
  }
  const kind = i % 2 === 0 ? "pic-to-word" : "word-to-hindi";
  const opts = [w, ...picks].map((x) => (kind === "pic-to-word" ? x.word : x.hi));
  const sorted = [...opts].sort((a, b) => ((a.length * 13 + h) % 7) - ((b.length * 13 + h) % 7) || a.localeCompare(b));
  return { id: w.id, kind, options: sorted, answer: kind === "pic-to-word" ? w.word : w.hi };
}

function Test({ ids, onDone }: { ids: string[]; onDone: () => void }) {
  const [queue, setQueue] = useState(() => ids.map((id, i) => makeQuestion(DAILY_BY_ID.get(id)!, i)));
  const [tries, setTries] = useState<Record<string, number>>({});
  const [picked, setPicked] = useState<string | null>(null);
  const [correct, setCorrect] = useState<string[]>([]);
  const [finished, setFinished] = useState(false);
  const tts = useSpeechSynthesis();
  const rate = useAppState((s) => s.settings.speechRate);
  const q = queue[0];
  const w = useMemo(() => (q ? DAILY_BY_ID.get(q.id)! : null), [q]);

  function choose(o: string) {
    if (picked || !q || !w) return;
    setPicked(o);
    const ok = o === q.answer;
    if (ok) {
      learn(q.id);
      setCorrect((c) => [...c, q.id]);
      tts.speak(w.word, { rate });
    }
  }
  function next() {
    if (!q) return;
    const ok = picked === q.answer;
    const t = (tries[q.id] ?? 0) + 1;
    setTries({ ...tries, [q.id]: t });
    // A missed word comes back once at the end of this test, asked the other way round.
    const again = !ok && t < 2 ? [makeQuestion(w!, q.kind === "pic-to-word" ? 1 : 0)] : [];
    const nq = [...queue.slice(1), ...again];
    setPicked(null);
    if (!nq.length) setFinished(true);
    setQueue(nq);
  }

  if (finished || !q || !w)
    return (
      <div className="card mx-auto max-w-md p-6 text-center">
        <p className="text-5xl">🎯</p>
        <p className="mt-2 text-2xl font-extrabold">{correct.length}/{ids.length} words learned</p>
        <p className="mt-1 text-muted">{correct.length === ids.length ? "Perfect! " : "Words you missed will appear again in your next set. "}Learned words return for review tomorrow.</p>
        <button onClick={onDone} className="btn btn-primary mt-4 w-full">Continue <ArrowRight size={16} /></button>
      </div>
    );

  return (
    <div className="mx-auto max-w-md">
      <p className="mb-2 text-center text-sm text-muted">Quick test · {correct.length}/{ids.length} learned · {queue.length} left</p>
      <div className="card p-5 text-center">
        {q.kind === "pic-to-word" ? (
          <>
            <p className="label">Which word is this?</p>
            <div className="my-3 text-7xl" aria-hidden>{w.emoji}</div>
            <p className="text-lg" lang="hi">{w.hi}</p>
          </>
        ) : (
          <>
            <p className="label">What does this word mean?</p>
            <p className="my-4 flex items-center justify-center gap-2 text-3xl font-extrabold">{w.word} <SayButton text={w.word} label={`Say ${w.word}`} /></p>
          </>
        )}
        <div className="mt-4 grid gap-2" role="radiogroup">
          {q.options.map((o) => (
            <button key={o} role="radio" aria-checked={picked === o} onClick={() => choose(o)} disabled={!!picked}
              className={cn("card px-4 py-3 text-left text-[15px]", picked && o === q.answer && "border-mint-500 bg-mint-500/10", picked === o && o !== q.answer && "border-red-500 bg-red-500/10")}
              lang={q.kind === "word-to-hindi" ? "hi" : undefined}>
              {o}
            </button>
          ))}
        </div>
        {picked && (
          <div className="mt-4 text-left">
            <p className="text-sm"><b>{w.emoji} {w.word}</b> — {w.hi}</p>
            <p className="text-sm italic text-muted">{w.example}</p>
            <button onClick={next} className="btn btn-primary mt-3 w-full">Next</button>
          </div>
        )}
      </div>
    </div>
  );
}

function TopicView({ id, onBack }: { id: string; onBack: () => void }) {
  const c = DAILY_CATEGORY_BY_ID.get(id)!;
  const learned = useAppState((s) => s.learnedWords);
  const selected = useAppState((s) => s.settings.dailyCategories);
  const words = DAILY_WORDS.filter((w) => w.category === id);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button onClick={onBack} className="btn btn-ghost text-sm"><ArrowLeft size={16} /> Back</button>
        <h2 className="text-xl font-bold">{c.emoji} {c.label} · {words.filter((w) => learned.includes(w.id)).length}/{words.length}</h2>
        <button onClick={() => { updateSettings({ dailyCategories: [id] }); onBack(); }} className="btn btn-secondary text-sm" disabled={selected.length === 1 && selected[0] === id}>Use only this topic for daily words</button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">{words.map((w) => <PictureCard key={w.id} w={w} learned={learned.includes(w.id)} />)}</div>
    </div>
  );
}
