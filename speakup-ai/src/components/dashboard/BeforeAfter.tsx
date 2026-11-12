"use client";
import { useAppState } from "@/lib/store/store";
import type { ScoreBreakdown } from "@/lib/store/types";

/** Compares the first and latest challenge recordings - real data only. */
export function BeforeAfter() {
  const challenge = useAppState((s) => s.challenge);
  const days = Object.values(challenge).sort((a, b) => a.day - b.day);
  if (days.length < 2) return null;
  const first = days[0];
  const last = days[days.length - 1];
  const rows: Array<[string, keyof ScoreBreakdown]> = [["Overall", "overall"], ["Grammar", "grammar"], ["Fluency", "fluency"], ["Vocabulary", "vocabulary"], ["Relevance", "relevance"]];
  const words = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
  return (
    <div className="card p-4">
      <h3 className="font-semibold">Before & after report</h3>
      <p className="text-sm text-muted">Day {first.day} vs Day {last.day} (automated estimates)</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-muted"><tr><th className="py-1">Measure</th><th>Day {first.day}</th><th>Day {last.day}</th><th>Change</th></tr></thead>
          <tbody>
            {rows.map(([label, k]) => {
              const a = (first.scores?.[k] as number | null) ?? null;
              const b = (last.scores?.[k] as number | null) ?? null;
              const diff = a !== null && b !== null ? b - a : null;
              return (
                <tr key={k} className="border-t border-base">
                  <td className="py-1.5">{label}</td><td>{a ?? "—"}</td><td>{b ?? "—"}</td>
                  <td className={diff === null ? "" : diff >= 0 ? "font-semibold text-mint-500" : "font-semibold text-red-500"}>{diff === null ? "—" : `${diff > 0 ? "+" : ""}${diff}`}</td>
                </tr>
              );
            })}
            <tr className="border-t border-base"><td className="py-1.5">Words spoken (measured)</td><td>{words(first.transcript)}</td><td>{words(last.transcript)}</td><td>{words(last.transcript) - words(first.transcript)}</td></tr>
            <tr className="border-t border-base"><td className="py-1.5">Speaking time (measured)</td><td>{first.scores?.durationSec ?? 0}s</td><td>{last.scores?.durationSec ?? 0}s</td><td>{(last.scores?.durationSec ?? 0) - (first.scores?.durationSec ?? 0)}s</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
