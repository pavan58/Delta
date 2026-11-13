"use client";
import { useEffect, useMemo, useState } from "react";
import { Bookmark, BookmarkCheck, Brain, Check, Layers, Search, Shuffle, X } from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { Speak } from "@/components/voice/Feedback";
import { VOCAB_CATEGORIES, WORDS, WORDS_BY_ID, type VocabCategory, type Word } from "@/content/vocabulary/words";
import { getState, recordActivity, setState, useAppState } from "@/lib/store/store";
import { dailyWords, dueIds, LEARNED_BOX, newCard, review } from "@/lib/vocab/srs";
import { XP } from "@/lib/gamification";
import { useCustomContent } from "@/lib/content/custom";
import { cn } from "@/lib/utils";
import { DailyWords } from "@/components/vocab/DailyWords";
import { DAILY_WORDS, DAILY_CATEGORY_BY_ID } from "@/content/vocabulary/daily-needs";
import { CalendarDays } from "lucide-react";

/** Daily Needs words in the shared Word shape, so flashcard review and Saved work for them too. */
const DAILY_AS_WORDS: Word[] = DAILY_WORDS.map((w) => ({
  id: w.id, word: w.word, category: "daily", meaning: `${w.emoji} ${w.hi}`, pron: "", example: w.example,
  synonyms: [], antonyms: [], usage: `Daily needs · ${DAILY_CATEGORY_BY_ID.get(w.category)?.label ?? ""}`, hi: w.hi,
}));

type Tab = "daily" | "browse" | "review" | "quiz" | "saved";

export default function VocabularyPage() {
  const vocab = useAppState((s) => s.vocab);
  const due = dueIds({ vocab }).length;
  const [tab, setTab] = useState<Tab>("daily");
  const custom = useCustomContent().vocabulary;
  const all = useMemo(() => [...WORDS, ...custom], [custom]);
  const withDaily = useMemo(() => [...all, ...DAILY_AS_WORDS], [all]);
  const today = useAppState((s) => s.dailyWords);
  return (
    <div>
      <PageHeader title="Vocabulary Builder" subtitle="Daily needs words (animals, fruits, plants and more) plus professional, interview and IELTS vocabulary — locked in with spaced repetition." />
      <div className="mb-4 flex flex-wrap gap-2" role="tablist">
        {([["daily", `Daily ${s_goalLabel(today)}`, CalendarDays], ["browse", "Word lists", Search], ["review", `Flashcards${due ? ` (${due} due)` : ""}`, Layers], ["quiz", "Daily quiz", Brain], ["saved", `Saved (${Object.keys(vocab).length})`, Bookmark]] as const).map(([v, l, Icon]) => (
          <button key={v} role="tab" aria-selected={tab === v} onClick={() => setTab(v)} className={cn("btn btn-secondary py-2 text-sm", tab === v && "border-brand-500 ring-2 ring-brand-500/30")}><Icon size={16} /> {l}</button>
        ))}
      </div>
      {tab === "daily" && <DailyWords />}
      {tab === "browse" && <Browse all={all} />}
      {tab === "review" && <Review all={withDaily} />}
      {tab === "quiz" && <Quiz all={all} />}
      {tab === "saved" && <Saved all={withDaily} />}
    </div>
  );
}

function s_goalLabel(plan: { date: string; ids: string[]; learned: string[] } | null) {
  return plan ? `words (${plan.learned.length}/${plan.ids.length})` : "words";
}

function useWordMap(all: Word[]) {
  return useMemo(() => new Map(all.map((w) => [w.id, w])), [all]);
}

function toggleSave(id: string) {
  setState((s) => {
    const v = { ...s.vocab };
    if (v[id]) delete v[id];
    else v[id] = newCard();
    return { ...s, vocab: v };
  });
}

function WordCard({ w }: { w: Word }) {
  const saved = useAppState((s) => !!s.vocab[w.id]);
  const learned = useAppState((s) => s.learnedWords.includes(w.id));
  const lang = useAppState((s) => s.profile?.explainLang ?? "en");
  const [hi, setHi] = useState(lang !== "en");
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-lg font-bold">{w.word} {learned && <span className="chip ml-1 text-mint-500">learned</span>}</p>
          <p className="text-xs text-muted">/{w.pron}/ · {VOCAB_CATEGORIES[w.category].label}</p>
        </div>
        <div className="flex items-center">
          <Speak text={w.word} label="Say" />
          <button onClick={() => toggleSave(w.id)} className="btn btn-ghost p-1.5" aria-label={saved ? "Remove from saved words" : "Save word"} aria-pressed={saved}>
            {saved ? <BookmarkCheck size={18} className="text-brand-500" /> : <Bookmark size={18} />}
          </button>
        </div>
      </div>
      <p className="mt-2 text-[15px]">{w.meaning}</p>
      <p className="mt-2 text-sm italic text-muted">&ldquo;{w.example}&rdquo; <Speak text={w.example} label="" /></p>
      <div className="mt-2 flex flex-wrap gap-1 text-xs">
        {w.synonyms.map((s) => <span key={s} className="chip">≈ {s}</span>)}
        {w.antonyms.map((s) => <span key={s} className="chip">≠ {s}</span>)}
      </div>
      {w.usage && <p className="mt-2 text-xs text-muted">Usage: {w.usage}</p>}
      <button onClick={() => setHi(!hi)} className="mt-2 text-xs font-semibold text-brand-500">{hi ? "Hide" : "Show"} Hindi</button>
      {hi && <p className="mt-1 text-sm" lang="hi">{w.hi}</p>}
    </div>
  );
}

function Browse({ all }: { all: Word[] }) {
  const [cat, setCat] = useState<VocabCategory | "today">("today");
  const [q, setQ] = useState("");
  const today = useMemo(() => dailyWords(all, 6), [all]);
  const list = q ? all.filter((w) => (w.word + " " + w.meaning).toLowerCase().includes(q.toLowerCase())) : cat === "today" ? today : all.filter((w) => w.category === cat);
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input className="input pl-9" placeholder="Search words or meanings…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search vocabulary" />
        </div>
      </div>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        <button onClick={() => setCat("today")} className={cn("chip shrink-0 px-3 py-1.5", cat === "today" && "border-brand-500 bg-brand-500 text-white")}>⭐ Words of the day</button>
        {(Object.entries(VOCAB_CATEGORIES) as Array<[VocabCategory, { label: string; emoji: string }]>).map(([k, v]) => (
          <button key={k} onClick={() => setCat(k)} className={cn("chip shrink-0 px-3 py-1.5", cat === k && "border-brand-500 bg-brand-500 text-white")}>{v.emoji} {v.label}</button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{list.map((w) => <WordCard key={w.id} w={w} />)}</div>
      {cat === "today" && !q && (
        <button onClick={() => today.forEach((w) => { if (!getState().vocab[w.id]) toggleSave(w.id); })} className="btn btn-primary mt-4">Save all words of the day to flashcards</button>
      )}
    </div>
  );
}


function markLearned(id: string, box: number) {
  if (box < LEARNED_BOX) return;
  setState((s) => (s.learnedWords.includes(id) ? s : { ...s, learnedWords: [...s.learnedWords, id] }));
  recordActivity(XP.vocabLearned, 0, false);
}

function Review({ all }: { all: Word[] }) {
  const vocab = useAppState((s) => s.vocab);
  const map = useWordMap(all);
  const [queue, setQueue] = useState<string[]>(() => dueIds({ vocab }).filter((id) => map.has(id)));
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(0);
  const id = queue[0];
  const w = id ? map.get(id) : undefined;

  function grade(ok: boolean) {
    if (!id) return;
    const card = review(vocab[id] ?? newCard(), ok);
    setState((s) => ({ ...s, vocab: { ...s.vocab, [id]: card } }));
    markLearned(id, card.box);
    if (done === 0) recordActivity(XP.vocabReview, 1); // one review session counts toward the streak
    else recordActivity(XP.vocabReview, 0.2, false);
    setDone((d) => d + 1);
    setFlipped(false);
    setQueue((q) => (ok ? q.slice(1) : [...q.slice(1), id]));
  }

  if (!Object.keys(vocab).length) return <div className="card p-8 text-center text-muted">Save words from Browse to start flashcards. Words come back after 1, 3, 7, 14 and 30 days — just before you&apos;d forget them.</div>;
  if (!w) return <div className="card p-8 text-center"><p className="text-xl font-bold">All caught up! 🎉</p><p className="mt-1 text-muted">{done ? `You reviewed ${done} cards.` : "No cards are due right now."} Come back tomorrow for your next review.</p></div>;

  return (
    <div className="mx-auto max-w-md">
      <p className="mb-2 text-center text-sm text-muted">{queue.length} card{queue.length > 1 ? "s" : ""} left · box {vocab[id]?.box ?? 0}/5</p>
      <button onClick={() => setFlipped(!flipped)} className="card grid min-h-64 w-full place-items-center p-6 text-center" aria-label="Flip card">
        {!flipped ? (
          <div>
            <p className="text-3xl font-extrabold">{w.word}</p>
            <p className="mt-2 text-sm text-muted">/{w.pron}/ — tap to reveal the meaning</p>
          </div>
        ) : (
          <div className="fade-in">
            <p className="text-lg font-semibold">{w.meaning}</p>
            <p className="mt-2 text-sm italic text-muted">{w.example}</p>
            <p className="mt-2 text-sm" lang="hi">{w.hi}</p>
          </div>
        )}
      </button>
      <div className="mt-3 flex justify-center"><Speak text={w.word} label="Hear it" /></div>
      {flipped && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <button onClick={() => grade(false)} className="btn btn-secondary py-3"><X size={18} className="text-red-500" /> Didn&apos;t know</button>
          <button onClick={() => grade(true)} className="btn btn-primary py-3"><Check size={18} /> I knew it</button>
        </div>
      )}
    </div>
  );
}

interface QuizQ { word: Word; options: string[]; answer: string }

function makeQuiz(all: Word[], n = 8): QuizQ[] {
  const picks = dailyWords(all, n);
  return picks.map((w, i) => {
    const distractors = dailyWords(all.filter((x) => x.id !== w.id), 3, `q-${i}-${w.id}`).map((x) => x.meaning);
    const options = [...distractors, w.meaning].sort((a, b) => a.localeCompare(b));
    return { word: w, options, answer: w.meaning };
  });
}

function Quiz({ all }: { all: Word[] }) {
  const [qs, setQs] = useState<QuizQ[]>([]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  useEffect(() => setQs(makeQuiz(all)), [all]);
  if (!qs.length) return null;
  if (i >= qs.length)
    return (
      <div className="card mx-auto max-w-md p-8 text-center">
        <p className="text-4xl font-extrabold">{score}/{qs.length}</p>
        <p className="mt-2 text-muted">Today&apos;s quiz complete. Missed words were added to your flashcards.</p>
        <button onClick={() => { setQs(makeQuiz([...all].sort(() => Math.random() - 0.5))); setI(0); setScore(0); setPicked(null); }} className="btn btn-secondary mt-4"><Shuffle size={16} /> New random quiz</button>
      </div>
    );
  const q = qs[i];
  function choose(o: string) {
    if (picked) return;
    setPicked(o);
    const ok = o === q.answer;
    if (ok) setScore((s) => s + 1);
    else setState((s) => (s.vocab[q.word.id] ? s : { ...s, vocab: { ...s.vocab, [q.word.id]: newCard() } }));
    recordActivity(XP.vocabReview, 0.2, i === 0);
  }
  return (
    <div className="mx-auto max-w-lg">
      <p className="mb-2 text-sm text-muted">Question {i + 1} of {qs.length} · Score {score}</p>
      <div className="card p-5">
        <p className="label">What does this word mean?</p>
        <p className="mt-1 flex items-center gap-2 text-2xl font-bold">{q.word.word} <Speak text={q.word.word} label="" /></p>
        <div className="mt-4 grid gap-2">
          {q.options.map((o) => (
            <button key={o} onClick={() => choose(o)} disabled={!!picked} className={cn("card px-4 py-3 text-left text-sm", picked && o === q.answer && "border-mint-500 bg-mint-500/10", picked === o && o !== q.answer && "border-red-500 bg-red-500/10")}>{o}</button>
          ))}
        </div>
        {picked && (
          <div className="mt-4">
            <p className="text-sm italic text-muted">{q.word.example}</p>
            <button onClick={() => { setI(i + 1); setPicked(null); }} className="btn btn-primary mt-3 w-full">Next</button>
          </div>
        )}
      </div>
    </div>
  );
}

function Saved({ all }: { all: Word[] }) {
  const vocab = useAppState((s) => s.vocab);
  const map = useWordMap(all);
  const ids = Object.keys(vocab).filter((id) => map.has(id) || WORDS_BY_ID.has(id));
  if (!ids.length) return <div className="card p-8 text-center text-muted">No saved words yet. Tap the bookmark icon on any word.</div>;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {ids.map((id) => {
        const w = map.get(id)!;
        return (
          <div key={id} className="relative">
            <WordCard w={w} />
            <span className="absolute bottom-3 right-3 text-xs text-muted">next review: {vocab[id].due}</span>
          </div>
        );
      })}
    </div>
  );
}
