"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Button } from "./ui/button";
import { Input, Select } from "./ui/form";
import { Alert, Badge, Card, CardHeader, Table, Td, Th, statusColor } from "./ui/misc";
import { LineChart, Bars } from "./charts";
import { CodeEditor } from "./code-editor";
import { Section } from "./sections";
import { useResources } from "./resource/hooks";
import { T, TYPE_LABELS } from "@/lib/sim/types";
import { timeAgo } from "@/lib/utils";

type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any

export function ActivityLogTable({ take = 200 }: { take?: number }) {
  const [logs, setLogs] = useState<Any[] | null>(null);
  const [q, setQ] = useState("");
  useEffect(() => {
    api(`/api/activity?take=${take}`).then((r) => setLogs(r.logs)).catch(() => setLogs([]));
  }, [take]);
  const rows = (logs ?? []).filter((l) => !q || `${l.operation} ${l.resourceName} ${l.caller} ${l.status}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3"><Input aria-label="Filter activity log" className="max-w-sm" placeholder="Filter operations, resources, callers…" value={q} onChange={(e) => setQ(e.target.value)} /><span className="text-xs text-muted">{rows.length} event(s)</span></div>
      <Table><thead><tr><Th>Operation name</Th><Th>Status</Th><Th>Time</Th><Th>Resource</Th><Th>Event initiated by</Th><Th>Source</Th></tr></thead>
        <tbody>{rows.map((l) => <tr key={l.id}><Td>{l.operation}</Td><Td><Badge color={statusColor(l.status)}>{l.status}</Badge></Td><Td title={l.createdAt}>{timeAgo(l.createdAt)}</Td><Td>{l.resourceId ? <Link className="text-brand hover:underline" href={`/resources/${l.resourceId}`}>{l.resourceName}</Link> : l.resourceName ?? "-"}</Td><Td className="break-all text-xs">{l.caller}</Td><Td>{l.source}</Td></tr>)}{logs && !rows.length && <tr><Td colSpan={6} className="text-muted">No events.</Td></tr>}</tbody>
      </Table>
    </Card>
  );
}

export function MonitorView({ initialTab }: { initialTab?: string }) {
  const [tab, setTab] = useState(initialTab ?? "Overview");
  const all = useResources([T.VM, T.SITE, T.STORAGE, T.SQL_DB, T.AKS]);
  const [alerts, setAlerts] = useState<Any[] | null>(null);
  const [metricRes, setMetricRes] = useState("");
  const [detail, setDetail] = useState<Any>(null);
  useEffect(() => {
    api("/api/monitor/alerts", { body: {} }).then((r) => setAlerts(r.alerts)).catch(() => setAlerts([]));
  }, []);
  useEffect(() => {
    if (metricRes) api(`/api/resources/${metricRes}`).then(setDetail).catch(() => setDetail(null));
  }, [metricRes]);
  const tabs = ["Overview", "Alerts", "Metrics", "Activity log"];
  return (
    <div>
      <div role="tablist" className="mb-3 flex gap-1 border-b border-line">{tabs.map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === t ? "border-brand font-semibold text-brand" : "border-transparent text-muted"}`}>{t}</button>)}</div>
      {tab === "Overview" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card><CardHeader title="Resource health" subtitle="Computed from live simulator state" />
            <Table><thead><tr><Th>Resource</Th><Th>Type</Th><Th>Health</Th></tr></thead><tbody>{(all.rows ?? []).map((r) => <tr key={r.id}><Td><Link className="text-brand hover:underline" href={`/resources/${r.id}`}>{r.name}</Link></Td><Td>{TYPE_LABELS[r.type]}</Td><Td><Badge color={statusColor(r.health ?? "")}>{r.health}</Badge></Td></tr>)}{all.rows && !all.rows.length && <tr><Td colSpan={3} className="text-muted">No monitored resources yet.</Td></tr>}</tbody></Table>
          </Card>
          <Card><CardHeader title="Fired alerts" />
            <Table><thead><tr><Th>Rule</Th><Th>Target</Th><Th>Value</Th><Th>State</Th></tr></thead><tbody>{(alerts ?? []).map((a) => <tr key={a.id}><Td><Link className="text-brand hover:underline" href={`/resources/${a.id}`}>{a.name}</Link></Td><Td>{a.target}</Td><Td>{a.value} ({a.metric} vs {a.threshold})</Td><Td><Badge color={a.state === "Fired" ? "red" : "green"}>{a.state}</Badge></Td></tr>)}{alerts && !alerts.length && <tr><Td colSpan={4} className="text-muted">No alert rules. Create one in the Alerts tab.</Td></tr>}</tbody></Table>
          </Card>
        </div>
      )}
      {tab === "Alerts" && <AlertsTab />}
      {tab === "Metrics" && (
        <div className="grid gap-3">
          <Card className="p-3"><label className="text-xs font-semibold" htmlFor="metric-res">Scope</label><Select id="metric-res" className="max-w-md" value={metricRes} onChange={(e) => setMetricRes(e.target.value)}><option value="">Select a resource</option>{(all.rows ?? []).map((r) => <option key={r.id} value={r.id}>{r.name} ({TYPE_LABELS[r.type]})</option>)}</Select></Card>
          {detail && <div className="grid gap-4 md:grid-cols-2">{detail.metrics.map((m: Any) => <Card key={m.name} className="p-4"><LineChart series={m.series} unit={m.unit === "%" ? "%" : ""} label={m.name} /></Card>)}</div>}
        </div>
      )}
      {tab === "Activity log" && <ActivityLogTable />}
    </div>
  );
}

function AlertsTab() {
  const targets = useResources([T.VM, T.SITE, T.STORAGE, T.SQL_DB, T.AKS]);
  const rgs = useResources([T.RG]);
  const [f, setF] = useState({ resourceGroup: "", name: "", targetResourceId: "", metric: "Percentage CPU", operator: "GreaterThan", threshold: "80", windowMinutes: "10", severity: "2" });
  const [msg, setMsg] = useState<{ k: "error" | "success"; t: string } | null>(null);
  const [key, setKey] = useState(0);
  const metricsFor: Record<string, string[]> = { [T.VM]: ["Percentage CPU", "Available Memory Percentage", "OS Disk Used Percentage", "Network In Total"], [T.SITE]: ["Requests", "Http5xx", "Response Time"], [T.STORAGE]: ["Used Capacity", "Transactions"], [T.SQL_DB]: ["DTU Percentage", "Failed Connections"], [T.AKS]: ["Node CPU Percentage", "Ready Pods"] };
  const target = (targets.rows ?? []).find((r) => r.id === f.targetResourceId);
  const create = async () => {
    try {
      await api("/api/resources", { body: { type: T.ALERT, input: { ...f, threshold: Number(f.threshold), windowMinutes: Number(f.windowMinutes), severity: Number(f.severity) } } });
      setMsg({ k: "success", t: "Alert rule created." });
      setKey((k) => k + 1);
    } catch (e) {
      setMsg({ k: "error", t: (e as Error).message });
    }
  };
  return (
    <div className="grid gap-3">
      <Card><CardHeader title="Create alert rule" /><div className="grid gap-2 p-3 sm:grid-cols-4">
        <Select aria-label="Resource group" value={f.resourceGroup} onChange={(e) => setF({ ...f, resourceGroup: e.target.value })}><option value="">Resource group</option>{(rgs.rows ?? []).map((r) => <option key={r.id}>{r.name}</option>)}</Select>
        <Input aria-label="Alert rule name" placeholder="alert-cpu-high" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Select aria-label="Target resource" value={f.targetResourceId} onChange={(e) => { const t = (targets.rows ?? []).find((r) => r.id === e.target.value); setF({ ...f, targetResourceId: e.target.value, metric: t ? metricsFor[t.type][0] : f.metric }); }}><option value="">Target resource</option>{(targets.rows ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</Select>
        <Select aria-label="Metric" value={f.metric} onChange={(e) => setF({ ...f, metric: e.target.value })}>{(target ? metricsFor[target.type] : metricsFor[T.VM]).map((m) => <option key={m}>{m}</option>)}</Select>
        <Select aria-label="Operator" value={f.operator} onChange={(e) => setF({ ...f, operator: e.target.value })}>{["GreaterThan", "GreaterThanOrEqual", "LessThan", "LessThanOrEqual"].map((o) => <option key={o}>{o}</option>)}</Select>
        <Input aria-label="Threshold" type="number" value={f.threshold} onChange={(e) => setF({ ...f, threshold: e.target.value })} />
        <Input aria-label="Window (minutes)" type="number" value={f.windowMinutes} onChange={(e) => setF({ ...f, windowMinutes: e.target.value })} />
        <Select aria-label="Severity" value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value })}>{[0, 1, 2, 3, 4].map((s) => <option key={s} value={s}>Sev{s}</option>)}</Select>
      </div><div className="flex gap-2 px-3 pb-3"><Button onClick={create}>Create alert rule</Button>{msg && <Alert kind={msg.k}>{msg.t}</Alert>}</div></Card>
      <div key={key}><Section which="alerts" /></div>
    </div>
  );
}

export function KqlWorkbench() {
  const [query, setQuery] = useState("Perf\n| where CounterName == \"% Processor Time\"\n| summarize AvgCPU = avg(CounterValue) by Computer\n| sort by AvgCPU desc");
  const [res, setRes] = useState<Any>(null);
  const [busy, setBusy] = useState(false);
  const [examples, setExamples] = useState<{ title: string; query: string }[]>([]);
  useEffect(() => {
    import("@/lib/sim/kql").then((m) => setExamples(m.EXAMPLE_QUERIES));
  }, []);
  const run = async () => {
    setBusy(true);
    try {
      setRes(await api("/api/kql", { body: { query } }));
    } catch (e) {
      setRes({ ok: false, error: (e as Error).message });
    }
    setBusy(false);
  };
  const timeCol = res?.ok ? res.columns.find((c: string) => res.rows.length && typeof res.rows[0][c] === "string" && /^\d{4}-\d\d-\d\dT/.test(res.rows[0][c])) : null;
  const numCol = res?.ok ? res.columns.find((c: string) => res.rows.length && typeof res.rows[0][c] === "number") : null;
  const labelCol = res?.ok ? res.columns.find((c: string) => c !== numCol && res.rows.length && typeof res.rows[0][c] === "string") : null;
  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_280px]">
      <div className="grid gap-3">
        <Card className="grid gap-2 p-3">
          <CodeEditor label="KQL query" language="kusto" value={query} onChange={setQuery} height={170} />
          <div className="flex items-center gap-2"><Button onClick={run} disabled={busy}>{busy ? "Running…" : "Run"}</Button><span className="text-xs text-muted">Tables: Heartbeat, Perf, Syslog, Event, AppRequests, AzureActivity, SigninLogs, KubePodInventory</span></div>
        </Card>
        {res && !res.ok && <Alert kind="error">{res.error}</Alert>}
        {res?.ok && (
          <>
            <p className="text-xs text-muted">{res.rows.length} row(s) · scanned {res.stats.rowsScanned} · {res.stats.durationMs} ms</p>
            {res.chart && numCol && timeCol && <Card className="p-4"><LineChart label={`${numCol} over ${timeCol}`} series={[...res.rows].sort((a: Any, b: Any) => a[timeCol].localeCompare(b[timeCol])).map((r: Any) => ({ t: r[timeCol], v: Math.round(r[numCol] * 10) / 10 }))} /></Card>}
            {res.chart && numCol && !timeCol && labelCol && <Card className="p-4"><Bars data={res.rows.slice(0, 15).map((r: Any) => ({ label: String(r[labelCol]), value: Number(r[numCol]) }))} /></Card>}
            <Card><Table><thead><tr>{res.columns.map((c: string) => <Th key={c}>{c}</Th>)}</tr></thead><tbody>{res.rows.slice(0, 200).map((r: Any, i: number) => <tr key={i}>{res.columns.map((c: string) => <Td key={c} className="whitespace-nowrap text-xs">{Array.isArray(r[c]) ? r[c].join(", ") : String(r[c] ?? "")}</Td>)}</tr>)}</tbody></Table></Card>
          </>
        )}
      </div>
      <Card><CardHeader title="Example queries" /><ul className="divide-y divide-line">{examples.map((e) => <li key={e.title}><button className="w-full px-3 py-2 text-left text-sm hover:bg-subtle" onClick={() => setQuery(e.query)}>{e.title}</button></li>)}</ul></Card>
    </div>
  );
}

export function AppInsightsSummary() {
  const sites = useResources([T.SITE]);
  const [res, setRes] = useState<Any>(null);
  useEffect(() => {
    api("/api/kql", { body: { query: "AppRequests | summarize Requests = count(), Failures = countif(Success == false), P95 = percentile(DurationMs, 95) by AppRoleName" } }).then(setRes).catch(() => undefined);
  }, []);
  return (
    <Card><CardHeader title="Application performance (last 24h)" subtitle={`${(sites.rows ?? []).length} web app(s) in your subscription`} />
      {res?.ok ? <Table><thead><tr><Th>App</Th><Th>Requests</Th><Th>Failures</Th><Th>Failure rate</Th><Th>P95 duration</Th></tr></thead><tbody>{res.rows.map((r: Any) => <tr key={r.AppRoleName}><Td>{r.AppRoleName}</Td><Td>{r.Requests}</Td><Td>{r.Failures}</Td><Td>{((r.Failures / r.Requests) * 100).toFixed(1)}%</Td><Td>{r.P95} ms</Td></tr>)}</tbody></Table> : <p className="p-4 text-sm text-muted">Loading…</p>}
    </Card>
  );
}

export function CostView() {
  const [c, setC] = useState<Any>(null);
  const [key, setKey] = useState(0);
  useEffect(() => {
    api("/api/cost").then(setC).catch(() => undefined);
  }, [key]);
  if (!c) return <p className="text-sm text-muted">Loading…</p>;
  return (
    <div className="grid gap-4">
      <Alert kind="info">{c.disclaimer}</Alert>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4"><p className="text-xs text-muted">Forecast (this month)</p><p className="text-2xl font-semibold">${c.total.toFixed(2)}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted">Month to date</p><p className="text-2xl font-semibold">${c.monthToDate.toFixed(2)}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted">Budgets breached</p><p className="text-2xl font-semibold">{c.budgets.filter((b: Any) => b.breached.length).length} / {c.budgets.length}</p></Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader title="Cost by resource group" /><div className="p-4"><Bars unit="$" data={Object.entries(c.byGroup).map(([label, value]) => ({ label, value: value as number })).sort((a, b) => b.value - a.value)} /></div></Card>
        <Card><CardHeader title="Cost by service" /><div className="p-4"><Bars unit="$" data={Object.entries(c.byType).map(([label, value]) => ({ label: TYPE_LABELS[label] ?? label, value: value as number })).sort((a, b) => b.value - a.value)} /></div></Card>
      </div>
      <Card><CardHeader title="Budgets" />
        <Table><thead><tr><Th>Name</Th><Th>Scope</Th><Th>Amount</Th><Th>Actual (MTD)</Th><Th>Forecast</Th><Th>Alerts</Th></tr></thead><tbody>{c.budgets.map((b: Any) => <tr key={b.id}><Td>{b.name}</Td><Td>{b.scope}</Td><Td>${b.amount}</Td><Td>${b.actual}</Td><Td>${b.forecast}</Td><Td>{b.breached.length ? <Badge color="red">{b.breached.map((x: number) => `${x}%`).join(", ")} exceeded</Badge> : <Badge color="green">OK</Badge>}</Td></tr>)}</tbody></Table>
      </Card>
      <div onClick={() => setTimeout(() => setKey((k) => k + 1), 800)}><Section which="budgets" /></div>
      <Card><CardHeader title="Top resources by cost" /><Table><thead><tr><Th>Resource</Th><Th>Type</Th><Th>Resource group</Th><Th>Est. monthly</Th></tr></thead><tbody>{c.items.slice(0, 20).map((i: Any) => <tr key={i.id}><Td><Link className="text-brand hover:underline" href={`/resources/${i.id}`}>{i.name}</Link></Td><Td>{TYPE_LABELS[i.type] ?? i.type}</Td><Td>{i.resourceGroup}</Td><Td>${i.monthly.toFixed(2)}</Td></tr>)}</tbody></Table></Card>
    </div>
  );
}
