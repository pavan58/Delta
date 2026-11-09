"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { Alert, Badge, Card, CardHeader, KV, Pre, statusColor, Table, Td, Th } from "@/components/ui/misc";
import { LineChart } from "@/components/charts";
import { PageHeader } from "@/components/page";
import { T } from "@/lib/sim/types";
import { timeAgo } from "@/lib/utils";
import { PANELS } from "./panels";

export type Detail = any; // eslint-disable-line @typescript-eslint/no-explicit-any

function ActivityTab({ id }: { id: string }) {
  const [logs, setLogs] = useState<Detail[] | null>(null);
  useEffect(() => {
    api(`/api/activity?resourceId=${id}&take=100`).then((r) => setLogs(r.logs)).catch(() => setLogs([]));
  }, [id]);
  if (!logs) return <p className="p-4 text-sm text-muted">Loading…</p>;
  return (
    <Table>
      <thead><tr><Th>Operation</Th><Th>Status</Th><Th>Time</Th><Th>Event initiated by</Th><Th>Source</Th></tr></thead>
      <tbody>
        {logs.length === 0 && <tr><Td colSpan={5} className="text-muted">No activity recorded.</Td></tr>}
        {logs.map((l) => (
          <tr key={l.id}><Td>{l.operation}</Td><Td><Badge color={statusColor(l.status)}>{l.status}</Badge></Td><Td title={l.createdAt}>{timeAgo(l.createdAt)}</Td><Td className="break-all">{l.caller}</Td><Td>{l.source}</Td></tr>
        ))}
      </tbody>
    </Table>
  );
}

function TagsTab({ d, reload }: { d: Detail; reload: () => void }) {
  const [rows, setRows] = useState<[string, string][]>(Object.entries(d.resource.tags ?? {}));
  const [msg, setMsg] = useState("");
  const save = async () => {
    try {
      await api(`/api/resources/${d.resource.id}`, { method: "PATCH", body: { tags: Object.fromEntries(rows.filter(([k]) => k.trim())) } });
      setMsg("Tags saved.");
      reload();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };
  return (
    <div className="grid gap-2 p-4">
      {rows.map(([k, v], i) => (
        <div key={i} className="flex gap-2">
          <Input aria-label="Tag name" value={k} onChange={(e) => setRows(rows.map((r, j) => (j === i ? [e.target.value, r[1]] : r)))} placeholder="Name" />
          <Input aria-label="Tag value" value={v} onChange={(e) => setRows(rows.map((r, j) => (j === i ? [r[0], e.target.value] : r)))} placeholder="Value" />
          <Button variant="ghost" size="icon" aria-label="Remove tag" onClick={() => setRows(rows.filter((_, j) => j !== i))}><Trash2 /></Button>
        </div>
      ))}
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={() => setRows([...rows, ["", ""]])}>Add tag</Button>
        <Button size="sm" onClick={save}>Apply</Button>
      </div>
      {msg && <p className="text-sm text-muted">{msg}</p>}
    </div>
  );
}

export function ResourceDetail({ id }: { id: string }) {
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("Overview");
  const router = useRouter();
  const load = useCallback(async () => {
    try {
      setD(await api(`/api/resources/${id}`));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);
  if (error) return <Alert kind="error">{error} <Link className="underline" href="/home">Back to Home</Link></Alert>;
  if (!d) return <p className="text-sm text-muted">Loading resource…</p>;
  const r = d.resource;
  const panel = PANELS[r.type];
  const tabs = ["Overview", ...(panel?.tabs ?? []), ...(d.metrics?.length ? ["Monitoring"] : []), "Activity log", "Tags", "JSON View"];
  const del = async () => {
    const isRg = r.type === T.RG;
    const answer = window.prompt(`Type the name "${r.name}" to delete it${isRg ? " and every resource inside it" : ""}.${d.usedBy?.length ? `\nWARNING: in use by ${d.usedBy.map((u: Detail) => u.name).join(", ")} - they will be deleted too.` : ""}`);
    if (answer !== r.name) return;
    try {
      await api(`/api/resources/${r.id}?cascade=${isRg || d.usedBy?.length > 0}`, { method: "DELETE" });
      router.push(isRg ? "/resource-groups" : "/home");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const health = d.health?.state ?? "Unknown";
  return (
    <div>
      <PageHeader
        title={r.name}
        subtitle={`${d.typeLabel}${r.resourceGroup && r.type !== T.RG ? ` · ${r.resourceGroup}` : ""}`}
        crumbs={[...(r.resourceGroup && r.type !== T.RG ? [{ label: r.resourceGroup }] : []), { label: r.name }]}
        actions={<><Button variant="secondary" size="sm" onClick={load}><RefreshCw />Refresh</Button><Button variant="secondary" size="sm" onClick={del}><Trash2 />Delete</Button></>}
      />
      <div role="tablist" aria-label="Resource sections" className="mb-3 flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm ${tab === t ? "border-brand font-semibold text-brand" : "border-transparent text-muted hover:text-ink"}`}>{t}</button>
        ))}
      </div>
      {tab === "Overview" && (
        <div className="grid gap-4">
          <Card className="p-4">
            <KV items={[
              ["Resource group", r.resourceGroup || "(tenant)"], ["Status", <Badge key="s" color={statusColor(r.status)}>{r.status}</Badge>], ["Location", r.location], ["Health", <Badge key="h" color={statusColor(health)}>{health}</Badge>],
              ["Subscription ID", <span key="sub" className="font-mono text-xs">{d.subscriptionId}</span>], ["Est. monthly cost", `$${d.monthlyCost} (simulated)`],
              ["Tags", Object.entries(r.tags ?? {}).map(([k, v]) => `${k}: ${v}`).join(", ") || "None"], ["Created", new Date(r.createdAt).toLocaleString()],
            ]} />
            <p className="mt-3 break-all font-mono text-xs text-muted">{d.id}</p>
            {d.health?.reason && <p className="mt-2 text-sm text-muted">Resource health: {d.health.reason}</p>}
          </Card>
          {panel?.overview && <panel.overview d={d} reload={load} />}
          {(d.dependsOn?.length > 0 || d.usedBy?.length > 0) && (
            <Card>
              <CardHeader title="Dependencies" subtitle="Resources this one depends on, and resources that depend on it" />
              <div className="grid gap-4 p-4 sm:grid-cols-2">
                <div><p className="mb-1 text-xs font-semibold text-muted">Depends on</p>{d.dependsOn.map((x: Detail) => <p key={x.id + x.kind} className="text-sm"><Link href={`/resources/${x.id}`} className="text-brand hover:underline">{x.name}</Link> <span className="text-muted">({x.kind})</span></p>)}{!d.dependsOn.length && <p className="text-sm text-muted">None</p>}</div>
                <div><p className="mb-1 text-xs font-semibold text-muted">Used by</p>{d.usedBy.map((x: Detail) => <p key={x.id + x.kind} className="text-sm"><Link href={`/resources/${x.id}`} className="text-brand hover:underline">{x.name}</Link> <span className="text-muted">({x.kind})</span></p>)}{!d.usedBy.length && <p className="text-sm text-muted">None</p>}</div>
              </div>
            </Card>
          )}
        </div>
      )}
      {panel?.tabs?.includes(tab) && <panel.render tab={tab} d={d} reload={load} />}
      {tab === "Monitoring" && (
        <div className="grid gap-4 md:grid-cols-2">
          {d.metrics.map((m: Detail) => <Card key={m.name} className="p-4"><LineChart series={m.series} unit={m.unit === "%" ? "%" : ""} label={`${m.name}${m.unit !== "%" ? ` (${m.unit})` : ""}`} /></Card>)}
        </div>
      )}
      {tab === "Activity log" && <Card><ActivityTab id={r.id} /></Card>}
      {tab === "Tags" && <Card><TagsTab d={d} reload={load} /></Card>}
      {tab === "JSON View" && <Pre>{JSON.stringify({ id: d.id, name: r.name, type: r.type, location: r.location, tags: r.tags, properties: r.properties }, null, 2)}</Pre>}
    </div>
  );
}
