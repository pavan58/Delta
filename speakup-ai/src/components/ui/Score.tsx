import { cn } from "@/lib/utils";

export function scoreColor(v: number) {
  return v >= 80 ? "text-mint-500" : v >= 60 ? "text-brand-500" : v >= 40 ? "text-accent-500" : "text-red-500";
}

export function ScoreRing({ value, size = 96, label, max = 100, suffix }: { value: number; size?: number; label?: string; max?: number; suffix?: string }) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value / max));
  const color = pct >= 0.8 ? "#14b88a" : pct >= 0.6 ? "#3b63f6" : pct >= 0.4 ? "#ff9a1f" : "#ef4444";
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }} role="img" aria-label={`${label ?? "Score"}: ${value} out of ${max}`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--border)" strokeWidth={8} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={8} fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} style={{ transition: "stroke-dashoffset .6s ease" }} />
      </svg>
      <div className="absolute text-center">
        <div className="text-2xl font-extrabold tabular-nums" style={{ fontSize: size / 4 }}>{value}{suffix}</div>
        {label && <div className="text-[10px] font-semibold uppercase tracking-wide opacity-60">{label}</div>}
      </div>
    </div>
  );
}

export function Bar({ label, value, max = 100, note }: { label: string; value: number | null; max?: number; note?: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span>{label}{note && <span className="ml-1 text-xs text-muted">({note})</span>}</span>
        <span className={cn("font-semibold tabular-nums", value !== null && scoreColor((value / max) * 100))}>{value === null ? "not measured" : `${value}/${max}`}</span>
      </div>
      <div className="h-2 rounded-full bg-[var(--border)]">
        {value !== null && <div className="h-2 rounded-full bg-brand-500 transition-all" style={{ width: `${(value / max) * 100}%` }} />}
      </div>
    </div>
  );
}

export function Stat({ label, value, sub, icon }: { label: string; value: React.ReactNode; sub?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between text-muted">
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
        {icon}
      </div>
      <div className="mt-2 text-2xl font-extrabold tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function EstimateNote({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs text-muted", className)}>
      Scores are automated estimates from rule-based indicators (grammar rules, word counts, speaking speed, recognition confidence). They are not
      official assessments. &ldquo;Not measured&rdquo; means we could not estimate it (e.g. typed answers have no pronunciation data).
    </p>
  );
}
