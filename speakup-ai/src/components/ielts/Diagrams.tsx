"use client";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ChartSpec } from "@/content/ielts/writing";

/** Map for Listening Section 2. Letters are positions; the audio describes which place is where. */
export function ParkMap() {
  const box = (x: number, y: number, w: number, h: number, l: string) => (
    <g key={l}>
      <rect x={x} y={y} width={w} height={h} rx={8} fill="var(--surface)" stroke="var(--muted)" strokeWidth={1.5} />
      <text x={x + w / 2} y={y + h / 2 + 7} textAnchor="middle" fontSize="20" fontWeight="800" fill="var(--text)">{l}</text>
    </g>
  );
  return (
    <figure className="mb-4">
      <svg viewBox="0 0 420 330" className="w-full max-w-md rounded-xl border border-base surface-2" role="img" aria-label="Map of Greenfield Heritage Park with places labelled A to H">
        <path d="M0 40 C 100 20, 200 60, 420 30 L420 0 L0 0 Z" fill="#93b4ff" opacity=".5" />
        <text x="12" y="22" fontSize="12" fill="var(--text)">River</text>
        <rect x="130" y="110" width="160" height="120" rx="16" fill="#14b88a" opacity=".25" />
        <text x="210" y="175" textAnchor="middle" fontSize="13" fill="var(--text)">Central lawn</text>
        {box(40, 50, 70, 45, "A")}
        {box(170, 45, 90, 50, "B")}
        {box(30, 110, 70, 45, "C")}
        {box(310, 50, 80, 45, "D")}
        {box(310, 130, 80, 70, "E")}
        {box(320, 215, 60, 35, "F")}
        {box(30, 180, 80, 50, "G")}
        {box(170, 245, 80, 30, "H")}
        <rect x="185" y="300" width="50" height="22" rx="4" fill="var(--color-brand-600)" />
        <text x="210" y="316" textAnchor="middle" fontSize="11" fill="#fff">Main gate</text>
        <text x="400" y="320" textAnchor="end" fontSize="10" fill="var(--muted)">N ↑</text>
      </svg>
      <figcaption className="mt-1 text-xs text-muted">You are at the main gate (bottom). The river is at the top.</figcaption>
    </figure>
  );
}

const COLORS = ["#3b63f6", "#ff9a1f", "#14b88a", "#ef4444"];
const tip = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--text)" };

export function WritingChart({ chart }: { chart: ChartSpec }) {
  if (chart.kind === "line" || chart.kind === "bar") {
    const data = (chart.categories ?? []).map((c, i) => ({ label: c, ...Object.fromEntries((chart.series ?? []).map((s) => [s.name, s.values[i]])) }));
    const Chart = chart.kind === "line" ? LineChart : BarChart;
    return (
      <figure className="card p-3">
        <figcaption className="mb-2 text-center text-sm font-semibold">{chart.title}</figcaption>
        <div className="h-64 w-full">
          <ResponsiveContainer>
            <Chart data={data} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" stroke="var(--muted)" fontSize={12} />
              <YAxis stroke="var(--muted)" fontSize={12} />
              <Tooltip contentStyle={tip} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {(chart.series ?? []).map((s, i) =>
                chart.kind === "line" ? <Line key={s.name} dataKey={s.name} stroke={COLORS[i]} strokeWidth={2.5} /> : <Bar key={s.name} dataKey={s.name} fill={COLORS[i]} radius={[4, 4, 0, 0]} />,
              )}
            </Chart>
          </ResponsiveContainer>
        </div>
      </figure>
    );
  }
  if (chart.kind === "table")
    return (
      <figure className="card overflow-x-auto p-3">
        <figcaption className="mb-2 text-center text-sm font-semibold">{chart.title}</figcaption>
        <table className="w-full text-sm">
          <tbody>
            {(chart.rows ?? []).map((r, i) => (
              <tr key={i} className={i === 0 ? "font-semibold" : "border-t border-base"}>{r.map((c, j) => <td key={j} className="px-2 py-1.5">{c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </figure>
    );
  if (chart.kind === "process")
    return (
      <figure className="card p-3">
        <figcaption className="mb-2 text-center text-sm font-semibold">{chart.title}</figcaption>
        <ol className="flex flex-wrap items-center justify-center gap-2 text-sm">
          {(chart.steps ?? []).map((s, i) => (
            <li key={i} className="flex items-center gap-2"><span className="rounded-lg surface-2 px-3 py-2"><b>{i + 1}.</b> {s}</span>{i < (chart.steps?.length ?? 0) - 1 && <span aria-hidden>→</span>}</li>
          ))}
        </ol>
      </figure>
    );
  if (chart.kind === "map")
    return (
      <figure className="card grid gap-3 p-3 sm:grid-cols-2">
        {(chart.maps ?? []).map((m) => (
          <div key={m.year} className="rounded-xl surface-2 p-3">
            <p className="font-semibold">{chart.title} — {m.year}</p>
            <ul className="mt-2 list-disc pl-5 text-sm">{m.features.map((f) => <li key={f}>{f}</li>)}</ul>
          </div>
        ))}
        <figcaption className="text-xs text-muted sm:col-span-2">Text description of the two maps (accessible format).</figcaption>
      </figure>
    );
  return null;
}
