import type { FitRisk } from "@/lib/types";
import { RISK_META } from "@/lib/engines/fit";

export function ScoreRing({ value, size = 64, label }: { value: number; size?: number; label?: string }) {
  const r = size / 2 - 5;
  const c = 2 * Math.PI * r;
  const color = value >= 80 ? "#2F7A4B" : value >= 66 ? "#B7791F" : "#B42318";
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }} role="img" aria-label={`${label ?? "Score"} ${value} out of 100`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#EAE3D6" strokeWidth={5} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={5} fill="none" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} strokeLinecap="round" />
      </svg>
      <span className="absolute font-display text-lg font-semibold" style={{ fontSize: size / 3.4 }}>{value}</span>
    </div>
  );
}

export function ScoreBar({ label, value, hint }: { label: string; value: number | null; hint?: string }) {
  const color = value === null ? "#DDD4C4" : value >= 80 ? "#2F7A4B" : value >= 66 ? "#B7791F" : "#B42318";
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-ink-soft">{label}</span>
        <span className="font-semibold tabular-nums">{value === null ? "—" : value}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-bone-deep">
        <div className="h-full rounded-full" style={{ width: `${value ?? 0}%`, background: color }} />
      </div>
      {hint && <p className="mt-1 text-[11px] text-ink-mute">{hint}</p>}
    </div>
  );
}

export function RiskBadge({ risk, compact = false }: { risk: FitRisk; compact?: boolean }) {
  const m = RISK_META[risk];
  const tone = risk === "LOW" ? "bg-risk-low/10 text-risk-low border-risk-low/30" : risk === "MEDIUM" ? "bg-risk-med/10 text-risk-med border-risk-med/30" : "bg-risk-high/10 text-risk-high border-risk-high/30";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${tone}`}>
      <span aria-hidden>{m.emoji}</span>
      {compact ? risk : m.label}
    </span>
  );
}

export function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "accent" | "dark" | "moss" }) {
  const t = { neutral: "bg-bone-deep text-ink-soft", accent: "bg-saffron-soft text-saffron-deep", dark: "bg-ink text-bone", moss: "bg-moss-soft text-moss" }[tone];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${t}`}>{children}</span>;
}
