import { ScoreRing } from "@/components/ui/Score";

export function BandResult({ title, raw, total, band, children }: { title: string; raw?: number; total?: number; band: number; children?: React.ReactNode }) {
  return (
    <div className="card fade-in flex flex-col items-center gap-4 p-5 sm:flex-row">
      <ScoreRing value={band} max={9} size={110} label="Band" />
      <div className="flex-1 text-center sm:text-left">
        <p className="text-lg font-bold">{title}</p>
        {raw !== undefined && total !== undefined && <p className="text-muted">Raw score: <b>{raw}/{total}</b>{total !== 40 ? ` (scaled to ${Math.round((raw / total) * 40)}/40)` : ""}</p>}
        <p className="mt-1 text-sm text-muted">Estimated band {band.toFixed(1)} — an automated practice estimate, not an official IELTS score.</p>
        {children}
      </div>
    </div>
  );
}
