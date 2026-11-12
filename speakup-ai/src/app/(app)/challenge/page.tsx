"use client";
import Link from "next/link";
import { Check, Lock, Share2 } from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { CHALLENGE, WEEK_TITLES } from "@/content/lessons/challenge";
import { useAppState } from "@/lib/store/store";
import { cn } from "@/lib/utils";
import { BeforeAfter } from "@/components/dashboard/BeforeAfter";

export default function ChallengePage() {
  const done = useAppState((s) => s.challenge);
  const count = Object.keys(done).length;
  const next = CHALLENGE.find((l) => !done[l.day])?.day ?? 31;
  return (
    <div>
      <PageHeader title="30-Day English Confidence Challenge" subtitle="A guided program with measurable milestones. One focused task a day.">
        <span className="chip">{count}/30 completed</span>
      </PageHeader>
      <div className="mb-5 h-3 rounded-full bg-[var(--border)]" aria-label={`${count} of 30 days completed`}>
        <div className="h-3 rounded-full bg-gradient-to-r from-brand-500 to-mint-500 transition-all" style={{ width: `${(count / 30) * 100}%` }} />
      </div>
      {count >= 2 && <div className="mb-6"><BeforeAfter /></div>}
      {([1, 2, 3, 4] as const).map((w) => (
        <section key={w} className="mb-6">
          <h2 className="mb-3 font-semibold">Week {w} · {WEEK_TITLES[w]}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CHALLENGE.filter((l) => l.week === w).map((l) => {
              const d = done[l.day];
              // Days unlock in order; you can always redo completed days.
              const locked = !d && l.day > next;
              return (
                <Link
                  key={l.day}
                  href={locked ? "#" : `/challenge/${l.day}`}
                  aria-disabled={locked}
                  onClick={(e) => locked && e.preventDefault()}
                  className={cn("card flex items-center gap-3 p-4 transition", locked ? "cursor-not-allowed opacity-60" : "hover:border-brand-400", l.day === next && "ring-2 ring-accent-400")}
                >
                  <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl text-xl", d ? "bg-mint-500/15" : "surface-2")}>{d ? l.badge : locked ? <Lock size={18} className="text-muted" /> : l.badge}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-muted">Day {l.day}{l.assessment ? " · Assessment" : ""}</p>
                    <p className="truncate font-semibold">{l.title}</p>
                  </div>
                  {d ? <span className="flex items-center gap-1 text-sm font-semibold text-mint-500"><Check size={16} /> {d.score}</span> : l.day === next ? <span className="chip text-accent-500">Today</span> : null}
                </Link>
              );
            })}
          </div>
        </section>
      ))}
      <p className="text-sm text-muted"><Share2 size={14} className="mr-1 inline" /> Days unlock one after another. Complete one day per sitting for the best results — consistency matters more than speed.</p>
    </div>
  );
}
