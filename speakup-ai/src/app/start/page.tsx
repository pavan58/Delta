"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { setState, useAppState, useHydrated } from "@/lib/store/store";
import type { ExplainLang, Level, Profile } from "@/lib/store/types";
import { BANDS } from "@/lib/scoring/ielts";
import { useAuth } from "@/lib/supabase/auth";
import { cn } from "@/lib/utils";

const LEVELS: Array<{ v: Level; label: string; hint: string }> = [
  { v: "beginner", label: "Beginner", hint: "I know a few words and simple sentences." },
  { v: "elementary", label: "Elementary", hint: "I can talk about myself, slowly." },
  { v: "intermediate", label: "Intermediate", hint: "I understand most things but hesitate to speak." },
  { v: "upper-intermediate", label: "Upper Intermediate", hint: "I speak well but make some mistakes." },
  { v: "advanced", label: "Advanced", hint: "I want to sound professional and polished." },
];
const LANGS = ["Hindi", "Marathi", "Tamil", "Telugu", "Kannada", "Malayalam", "Bengali", "Gujarati", "Punjabi", "Urdu", "Odia", "Other"];
const GOALS = ["Get a job", "Grow in my current job", "IELTS / study abroad", "Speak confidently in daily life", "Clear interviews", "Travel"];
const MINUTES = [5, 10, 15, 30, 45];
const DIFFICULTIES = ["I hesitate and feel nervous", "Grammar mistakes", "Not enough vocabulary", "Pronunciation", "Understanding fast speakers", "I think in my language first"];

const STEPS = ["name", "level", "language", "goal", "time", "ielts", "interview", "band", "difficulty"] as const;

export default function Onboarding() {
  const router = useRouter();
  const hydrated = useHydrated();
  const existing = useAppState((s) => s.profile);
  const auth = useAuth();
  const [step, setStep] = useState(0);
  const [p, setP] = useState<Profile>(
    () =>
      existing ?? {
        name: "", level: "intermediate", firstLanguage: "Hindi", goal: GOALS[0], dailyMinutes: 15, wantsIelts: false, ieltsModule: "academic",
        targetBand: 6.5, preparingInterviews: true, difficulty: DIFFICULTIES[0], explainLang: "en", onboarded: false, createdAt: new Date().toISOString(),
      },
  );
  const steps = STEPS.filter((s) => s !== "band" || p.wantsIelts);
  const cur = steps[step];
  const set = (patch: Partial<Profile>) => setP((x) => ({ ...x, ...patch }));

  function finish() {
    const explainLang: ExplainLang = p.firstLanguage === "Hindi" || p.level === "beginner" || p.level === "elementary" ? (p.explainLang === "en" ? "both" : p.explainLang) : p.explainLang;
    setState((s) => ({ ...s, profile: { ...p, name: p.name.trim() || "Learner", explainLang, onboarded: true }, settings: { ...s.settings, displayName: s.settings.displayName || p.name.trim() } }));
    router.push("/dashboard");
  }

  const next = () => (step < steps.length - 1 ? setStep(step + 1) : finish());
  const canNext = cur !== "name" || p.name.trim().length > 0;

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 py-6">
      <div className="flex items-center justify-between">
        <Logo />
        {!auth.user && auth.configured && <Link href="/login" className="text-sm font-semibold text-brand-500">I have an account</Link>}
      </div>
      <div className="mt-6 h-2 rounded-full bg-[var(--border)]" aria-hidden>
        <div className="h-2 rounded-full bg-brand-500 transition-all" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
      </div>
      <p className="mt-2 text-xs text-muted">Step {step + 1} of {steps.length}</p>

      <div key={cur} className="fade-in mt-6 flex-1">
        {cur === "name" && (
          <Q title="Welcome! What should we call you?" sub="You're starting in guest mode — no account needed. Your progress is saved in this browser.">
            <input autoFocus className="input text-lg" placeholder="Your first name" value={p.name} maxLength={40} onChange={(e) => set({ name: e.target.value })} onKeyDown={(e) => e.key === "Enter" && canNext && next()} />
            <label className="mt-4 block label">Explanations language</label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {([["en", "English"], ["both", "English + हिंदी"], ["hi", "हिंदी"]] as const).map(([v, l]) => (
                <Option key={v} active={p.explainLang === v} onClick={() => set({ explainLang: v })}>{l}</Option>
              ))}
            </div>
          </Q>
        )}
        {cur === "level" && (
          <Q title="1. What is your current English level?">
            <div className="grid gap-2">
              {LEVELS.map((l) => (
                <Option key={l.v} active={p.level === l.v} onClick={() => set({ level: l.v })}>
                  <span className="font-semibold">{l.label}</span>
                  <span className="block text-sm text-muted">{l.hint}</span>
                </Option>
              ))}
            </div>
          </Q>
        )}
        {cur === "language" && (
          <Q title="2. What is your first language?">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {LANGS.map((l) => <Option key={l} active={p.firstLanguage === l} onClick={() => set({ firstLanguage: l })}>{l}</Option>)}
            </div>
          </Q>
        )}
        {cur === "goal" && (
          <Q title="3. Why do you want to learn English?">
            <div className="grid gap-2 sm:grid-cols-2">
              {GOALS.map((g) => <Option key={g} active={p.goal === g} onClick={() => set({ goal: g, wantsIelts: g.startsWith("IELTS") ? true : p.wantsIelts, preparingInterviews: /job|interview/i.test(g) ? true : p.preparingInterviews })}>{g}</Option>)}
            </div>
          </Q>
        )}
        {cur === "time" && (
          <Q title="4. How much time can you practise daily?" sub="Short, daily practice beats long, irregular sessions.">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {MINUTES.map((m) => <Option key={m} active={p.dailyMinutes === m} onClick={() => set({ dailyMinutes: m })}>{m} min</Option>)}
            </div>
          </Q>
        )}
        {cur === "ielts" && (
          <Q title="5. Do you want IELTS preparation?">
            <div className="grid grid-cols-2 gap-2">
              <Option active={p.wantsIelts} onClick={() => set({ wantsIelts: true })}>Yes</Option>
              <Option active={!p.wantsIelts} onClick={() => set({ wantsIelts: false })}>Not now</Option>
            </div>
            {p.wantsIelts && (
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Option active={p.ieltsModule === "academic"} onClick={() => set({ ieltsModule: "academic" })}>Academic<span className="block text-xs text-muted">Study abroad</span></Option>
                <Option active={p.ieltsModule === "general"} onClick={() => set({ ieltsModule: "general" })}>General Training<span className="block text-xs text-muted">Work / migration</span></Option>
              </div>
            )}
          </Q>
        )}
        {cur === "interview" && (
          <Q title="6. Are you preparing for job interviews?">
            <div className="grid grid-cols-2 gap-2">
              <Option active={p.preparingInterviews} onClick={() => set({ preparingInterviews: true })}>Yes</Option>
              <Option active={!p.preparingInterviews} onClick={() => set({ preparingInterviews: false })}>No</Option>
            </div>
          </Q>
        )}
        {cur === "band" && (
          <Q title="7. What is your target IELTS band?">
            <div className="grid grid-cols-3 gap-2">
              {BANDS.map((b) => <Option key={b} active={p.targetBand === b} onClick={() => set({ targetBand: b })}>{b.toFixed(1)}</Option>)}
            </div>
          </Q>
        )}
        {cur === "difficulty" && (
          <Q title="8. What is your biggest English-speaking difficulty?">
            <div className="grid gap-2">
              {DIFFICULTIES.map((d) => <Option key={d} active={p.difficulty === d} onClick={() => set({ difficulty: d })}>{d}</Option>)}
            </div>
          </Q>
        )}
      </div>

      <div className="sticky bottom-0 mt-6 flex gap-3 bg-[var(--bg)] py-4">
        {step > 0 && <button className="btn btn-secondary" onClick={() => setStep(step - 1)} aria-label="Back"><ArrowLeft size={18} /></button>}
        <button className="btn btn-primary flex-1 py-3" disabled={!canNext || !hydrated} onClick={next}>
          {step === steps.length - 1 ? <>Build my plan <Check size={18} /></> : <>Continue <ArrowRight size={18} /></>}
        </button>
      </div>
    </div>
  );
}

function Q({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div>
      <h1 className="text-2xl font-bold">{title}</h1>
      {sub && <p className="mt-2 text-muted">{sub}</p>}
      <div className="mt-5">{children}</div>
    </div>
  );
}

function Option({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={cn("card w-full px-4 py-3 text-left transition", active ? "border-brand-500 ring-2 ring-brand-500/40" : "hover:border-brand-300")}>
      {children}
    </button>
  );
}
