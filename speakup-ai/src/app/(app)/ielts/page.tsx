"use client";
import Link from "next/link";
import { BookOpenText, Headphones, Mic, PenLine, Timer } from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { setState, useAppState } from "@/lib/store/store";
import { BANDS, overallBand } from "@/lib/scoring/ielts";
import { ShareButtons } from "@/components/sharing/ShareCard";
import { cn } from "@/lib/utils";

const SKILLS = [
  { id: "speaking", title: "Speaking", icon: Mic, href: "/ielts/speaking", text: "Part 1 interview, Part 2 cue card with 1-minute preparation, Part 3 discussion." },
  { id: "listening", title: "Listening", icon: Headphones, href: "/ielts/listening", text: "4 sections, 40 questions: forms, notes, MCQ, map labelling and matching." },
  { id: "reading", title: "Reading", icon: BookOpenText, href: "/ielts/reading", text: "Academic & General passages: T/F/NG, headings, matching, completion." },
  { id: "writing", title: "Writing", icon: PenLine, href: "/ielts/writing", text: "Task 1 (graphs, maps, processes / letters) and Task 2 essays." },
] as const;

export default function IeltsHub() {
  const profile = useAppState((s) => s.profile);
  const attempts = useAppState((s) => s.ielts);
  const mocks = useAppState((s) => s.mocks);
  const variant = profile?.ieltsModule ?? "academic";
  const target = profile?.targetBand ?? 6.5;
  const latest = (m: string) => attempts.find((a) => a.module === m && a.variant === variant)?.band ?? attempts.find((a) => a.module === m)?.band ?? null;
  const bands = Object.fromEntries(SKILLS.map((s) => [s.id, latest(s.id)])) as Record<string, number | null>;
  const have = Object.values(bands).filter((b): b is number => b !== null);
  const overall = have.length ? overallBand(have) : null;

  const setProfile = (patch: Partial<NonNullable<typeof profile>>) => setState((s) => (s.profile ? { ...s, profile: { ...s.profile, ...patch } } : s));

  return (
    <div>
      <PageHeader title="IELTS Preparation" subtitle="Original practice material with estimated band scores. Not affiliated with the official IELTS test." />
      <div className="card mb-4 flex flex-wrap items-center gap-4 p-4">
        <div className="inline-flex rounded-xl surface-2 p-1">
          {(["academic", "general"] as const).map((v) => (
            <button key={v} onClick={() => setProfile({ ieltsModule: v })} className={cn("rounded-lg px-4 py-2 text-sm font-semibold", variant === v ? "bg-[var(--surface)] shadow" : "text-muted")}>{v === "academic" ? "Academic" : "General Training"}</button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="label">Target band</span>
          <select className="input w-24" value={target} onChange={(e) => setProfile({ targetBand: Number(e.target.value), wantsIelts: true })}>
            {BANDS.map((b) => <option key={b} value={b}>{b.toFixed(1)}</option>)}
          </select>
        </label>
        <div className="ml-auto text-right">
          <p className="text-xs text-muted">Estimated overall</p>
          <p className="text-2xl font-extrabold">{overall !== null ? overall.toFixed(1) : "—"}<span className="text-sm font-medium text-muted"> / target {target.toFixed(1)}</span></p>
          {have.length > 0 && have.length < 4 && <p className="text-xs text-muted">based on {have.length} of 4 skills</p>}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {SKILLS.map((s) => {
          const b = bands[s.id];
          return (
            <Link key={s.id} href={s.href} className="card flex gap-4 p-4 hover:border-brand-400">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-500/15 text-brand-500"><s.icon /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between"><p className="font-semibold">{s.title}</p>{b !== null && <span className={cn("chip", b >= target ? "text-mint-500" : "")}>Band {b.toFixed(1)}</span>}</div>
                <p className="mt-1 text-sm text-muted">{s.text}</p>
              </div>
            </Link>
          );
        })}
      </div>

      <Link href="/ielts/mock-test" className="card mt-3 flex items-center gap-4 p-4 hover:border-brand-400">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent-500/15 text-accent-500"><Timer /></div>
        <div className="flex-1">
          <p className="font-semibold">Full mock test</p>
          <p className="text-sm text-muted">Listening (30 min) → Reading (60 min) → Writing (60 min) → Speaking (11–14 min), with a final band report.</p>
        </div>
        {mocks[0]?.overall != null && <span className="chip">Last: {mocks[0].overall?.toFixed(1)}</span>}
      </Link>

      {have.length > 0 && (
        <div className="card mt-4 p-4 text-center">
          <p className="mb-2 font-semibold">Share your IELTS progress</p>
          <ShareButtons kind="ielts" data={{ band: overall, target, bands: bands as Record<"listening" | "reading" | "writing" | "speaking", number | null> }} />
        </div>
      )}

      <div className="mt-4 rounded-xl surface-2 p-4 text-xs text-muted">
        <b>Important:</b> All band scores are automated estimates based on public IELTS assessment criteria and approximate raw-score conversion tables. They are not official IELTS results and do not guarantee any score in the real test. Practice listening audio uses your browser&apos;s synthetic voices and differs from official recordings. IELTS is a registered trademark of its owners; SpeakUp AI is not affiliated with or endorsed by them.
      </div>
    </div>
  );
}
