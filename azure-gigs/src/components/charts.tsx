"use client";
/** Lightweight accessible SVG charts (no external chart library). */
export function LineChart({ series, unit = "", height = 140, label }: { series: { t: string; v: number }[]; unit?: string; height?: number; label: string }) {
  const w = 480;
  const pad = { l: 36, r: 8, t: 8, b: 20 };
  if (!series.length) return <p className="text-sm text-muted">No data.</p>;
  const max = Math.max(1, ...series.map((p) => p.v));
  const yMax = unit === "%" ? 100 : Math.ceil(max * 1.15);
  const x = (i: number) => pad.l + (i / Math.max(1, series.length - 1)) * (w - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / yMax) * (height - pad.t - pad.b);
  const d = series.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const last = series[series.length - 1];
  const avg = series.reduce((a, p) => a + p.v, 0) / series.length;
  return (
    <figure>
      <figcaption className="mb-1 flex items-baseline justify-between text-xs text-muted">
        <span className="font-semibold text-ink">{label}</span>
        <span>now <strong className="text-ink">{last.v}{unit}</strong> · avg {avg.toFixed(1)}{unit}</span>
      </figcaption>
      <svg viewBox={`0 0 ${w} ${height}`} className="h-auto w-full" role="img" aria-label={`${label}: latest ${last.v}${unit}, average ${avg.toFixed(1)}${unit}`}>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={pad.l} x2={w - pad.r} y1={y(yMax * f)} y2={y(yMax * f)} stroke="var(--line)" strokeDasharray={f ? "3 3" : undefined} />
            <text x={pad.l - 4} y={y(yMax * f) + 3} textAnchor="end" fontSize="9" fill="var(--muted)">{Math.round(yMax * f)}</text>
          </g>
        ))}
        <path d={`${d} L${x(series.length - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill="var(--brand)" opacity="0.08" />
        <path d={d} fill="none" stroke="var(--brand)" strokeWidth="1.75" strokeLinejoin="round" />
        <text x={pad.l} y={height - 4} fontSize="9" fill="var(--muted)">{new Date(series[0].t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</text>
        <text x={w - pad.r} y={height - 4} fontSize="9" fill="var(--muted)" textAnchor="end">{new Date(last.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</text>
      </svg>
    </figure>
  );
}

export function Bars({ data, unit = "" }: { data: { label: string; value: number }[]; unit?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="grid gap-2">
      {data.map((d) => (
        <li key={d.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-sm">
          <span className="truncate text-ink">{d.label}</span>
          <span className="text-xs tabular-nums text-muted">{unit}{d.value.toFixed(2)}</span>
          <span className="col-span-2 h-2 rounded-full bg-subtle"><span className="block h-2 rounded-full bg-brand" style={{ width: `${(d.value / max) * 100}%` }} /></span>
        </li>
      ))}
    </ul>
  );
}

export function Progress({ value, label }: { value: number; label?: string }) {
  return (
    <div>
      {label && <div className="mb-1 flex justify-between text-xs"><span className="text-muted">{label}</span><span className="font-semibold text-ink">{value}%</span></div>}
      <div className="h-2 rounded-full bg-subtle" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className="h-2 rounded-full bg-brand" style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  );
}
