"use client";
import { useCallback, useEffect, useState } from "react";
import { post } from "@/lib/client/api";
import { ErrorState, SkeletonBlock } from "@/components/States";
import { Pill } from "@/components/Scores";

interface Overview {
  demo: boolean;
  ai: { provider: string; vision: boolean };
  totals: { products: number; available: number; retailers: number; withHistory: number; sponsored: number };
  providers: { id: string; name: string; kind: string; configured: boolean; lastSyncAt?: string; lastError?: string; productCount: number }[];
  retailers: { id: string; name: string; integration: string; products: number; available: number; stale: number }[];
  freshness: Record<string, number>;
  categories: [string, number][];
  trends: { id: string; name: string; source: string; metric: { label: string; value: string } | null }[];
  recipes: { id: string; name: string; slots: number }[];
  searches: { count: number; zeroResults: number; top: [string, number][]; recent: { q: string; results: number; at: string }[] };
  clicks: { count: number; demo: number; byRetailer: [string, number][] };
  conversions: { available: boolean; note: string };
  outfits: { count: number; recent: { occasion: string; budget: number; count: number; at: string }[] };
  feedback: { count: number; perfect: number };
  users: { note: string };
  failedIntegrations: { provider: string; error: string; at: string }[];
  jobs: { job: string; startedAt: string; ok: boolean; detail: string }[];
}

const SECTIONS = ["Overview", "Products", "Retailers", "Providers", "Price history", "Trend data", "Users", "Outfits", "Categories", "Searches", "Failed integrations", "Data freshness", "Affiliate clicks", "Conversions", "Jobs"];
const JOBS = ["sync-products", "sync-prices", "compute-trends", "generate-recommendations"] as const;

export default function Admin() {
  const [d, setD] = useState<Overview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const r = await fetch("/api/admin/overview", { cache: "no-store" });
      if (!r.ok) throw new Error(r.status === 401 ? "Unauthorized — admin token required." : `Failed (${r.status})`);
      setD((await r.json()) as Overview);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);
  useEffect(() => void load(), [load]);

  async function run(job: string) {
    setRunning(job);
    try { await post("/api/admin/jobs", { job }); } catch { /* shown via reload */ }
    setRunning(null);
    void load();
  }

  if (err) return <div className="container-x py-10"><ErrorState message={err} onRetry={load} /></div>;
  if (!d) return <div className="container-x py-10"><SkeletonBlock className="h-96" /></div>;
  const id = (s: string) => s.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="container-x py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Admin</p>
          <h1 className="h-display mt-1 text-4xl">Operations dashboard</h1>
        </div>
        <div className="flex gap-2">{d.demo && <Pill tone="accent">Demo mode</Pill>}<Pill>AI: {d.ai.provider}</Pill></div>
      </div>
      <div className="mt-8 grid gap-8 lg:grid-cols-[200px_1fr]">
        <nav className="hidden lg:block" aria-label="Admin sections"><ul className="sticky top-20 space-y-1 text-sm">{SECTIONS.map((s) => <li key={s}><a href={`#${id(s)}`} className="text-ink-soft hover:text-ink">{s}</a></li>)}</ul></nav>
        <div className="space-y-10">
          <Block title="Overview">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Kpi k="Listings" v={d.totals.products} /><Kpi k="Available" v={d.totals.available} /><Kpi k="Retailers" v={d.totals.retailers} /><Kpi k="With price history" v={d.totals.withHistory} /><Kpi k="Sponsored (labelled)" v={d.totals.sponsored} />
            </div>
          </Block>
          <Block title="Products"><p className="text-sm text-ink-soft">{d.totals.products} normalized listings. {d.demo ? "All from the demo catalogue (clearly labelled in UI)." : "From configured providers."} Browse them in <a className="underline" href="/discover">Discover</a>.</p></Block>
          <Block title="Retailers">
            <Table head={["Retailer", "Integration", "Listings", "Available", "Stale"]} rows={d.retailers.map((r) => [r.name, r.integration, r.products, r.available, r.stale])} />
          </Block>
          <Block title="Providers">
            <Table head={["Provider", "Kind", "Configured", "Products", "Last sync", "Error"]} rows={d.providers.map((p) => [p.name, p.kind, p.configured ? "Yes" : "No", p.productCount, p.lastSyncAt ? new Date(p.lastSyncAt).toLocaleString("en-IN") : "—", p.lastError ?? "—"])} />
            <p className="mt-2 text-xs text-ink-mute">Adapters live in <code>src/lib/providers</code>. Only official APIs, affiliate feeds, merchant feeds or licensed data — no ToS-violating scraping.</p>
          </Block>
          <Block title="Price history"><p className="text-sm text-ink-soft">{d.totals.withHistory} of {d.totals.products} listings have ≥2 recorded price points. Listings without history never show &ldquo;lowest price&rdquo; claims.</p></Block>
          <Block title="Trend data"><Table head={["Trend", "Source", "Metric"]} rows={d.trends.map((t) => [t.name, t.source, t.metric ? `${t.metric.label}: ${t.metric.value}` : "None (editorial)"])} /></Block>
          <Block title="Users"><p className="text-sm text-ink-soft">{d.users.note} Fit feedback received (anonymous): {d.feedback.count} ({d.feedback.perfect} perfect).</p></Block>
          <Block title="Outfits">
            <p className="text-sm">{d.outfits.count} outfit requests this session. Recipes: {d.recipes.map((r) => r.name).join(", ")}.</p>
            {d.outfits.recent.length > 0 && <Table head={["Occasion", "Budget", "Outfits", "At"]} rows={d.outfits.recent.map((o) => [o.occasion, `₹${o.budget}`, o.count, new Date(o.at).toLocaleTimeString("en-IN")])} />}
          </Block>
          <Block title="Categories"><div className="flex flex-wrap gap-1.5">{d.categories.map(([c, n]) => <span key={c} className="chip">{c} <b>{n}</b></span>)}</div></Block>
          <Block title="Searches">
            <p className="text-sm">{d.searches.count} searches · {d.searches.zeroResults} with zero results</p>
            {d.searches.top.length > 0 && <Table head={["Query", "Count"]} rows={d.searches.top} />}
          </Block>
          <Block title="Failed integrations">{d.failedIntegrations.length === 0 ? <p className="text-sm text-ink-soft">No failures recorded.</p> : <Table head={["Provider", "Error", "At"]} rows={d.failedIntegrations.map((f) => [f.provider, f.error, f.at])} />}</Block>
          <Block title="Data freshness">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{Object.entries(d.freshness).map(([k, v]) => <Kpi key={k} k={k} v={v} warn={k.includes("stale") && v > 0} />)}</div>
            <p className="mt-2 text-xs text-ink-mute">Listings older than 48h show &ldquo;⚠️ Price may have changed&rdquo; to users.</p>
          </Block>
          <Block title="Affiliate clicks">
            <p className="text-sm">{d.clicks.count} outbound clicks ({d.clicks.demo} on demo listings — not forwarded).</p>
            {d.clicks.byRetailer.length > 0 && <Table head={["Retailer", "Clicks"]} rows={d.clicks.byRetailer} />}
          </Block>
          <Block title="Conversions"><p className="text-sm text-ink-soft">{d.conversions.note}</p></Block>
          <Block title="Jobs">
            <div className="flex flex-wrap gap-2">{JOBS.map((j) => <button key={j} className="btn-ghost btn-sm" disabled={running !== null} onClick={() => run(j)}>{running === j ? "Running…" : `Run ${j}`}</button>)}</div>
            {d.jobs.length > 0 && <div className="mt-3"><Table head={["Job", "Started", "OK", "Detail"]} rows={d.jobs.map((j) => [j.job, new Date(j.startedAt).toLocaleTimeString("en-IN"), j.ok ? "✓" : "✗", j.detail])} /></div>}
          </Block>
        </div>
      </div>
    </div>
  );

  function Block({ title, children }: { title: string; children: React.ReactNode }) {
    return <section id={id(title)} className="scroll-mt-20"><h2 className="mb-3 font-display text-2xl">{title}</h2>{children}</section>;
  }
}

function Kpi({ k, v, warn }: { k: string; v: number; warn?: boolean }) {
  return <div className={`card p-3 ${warn ? "border-risk-med/50 bg-risk-med/5" : ""}`}><p className="text-[11px] text-ink-mute">{k}</p><p className="font-display text-2xl">{v}</p></div>;
}

function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[480px] text-sm">
        <thead><tr className="border-b border-bone-line text-left text-[11px] uppercase tracking-wider text-ink-mute">{head.map((h) => <th key={h} className="p-2.5">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-b border-bone-line last:border-0">{r.map((c, j) => <td key={j} className="p-2.5">{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
