"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { Alert, Badge, Card, Empty, statusColor, Table, Td, Th } from "@/components/ui/misc";
import { CreateBlade } from "./create-blade";
import { VmWizard } from "./vm-wizard";
import { useResources, ResRow } from "./hooks";
import { T, TYPE_LABELS } from "@/lib/sim/types";
import { CREATE_FORMS } from "./forms";

export type Column = { label: string; get: (r: ResRow) => React.ReactNode };

export function ResourceList({ types, title, columns = [], createTypes, emptyHint, resourceGroup }: { types: string[]; title?: string; columns?: Column[]; createTypes?: string[]; emptyHint?: string; resourceGroup?: string }) {
  const { rows, error, reload } = useResources(types, resourceGroup);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const router = useRouter();
  const filtered = useMemo(() => (rows ?? []).filter((r) => !q || `${r.name} ${r.resourceGroup} ${r.location} ${r.type}`.toLowerCase().includes(q.toLowerCase())), [rows, q]);
  const ct = createTypes ?? types.filter((t) => CREATE_FORMS[t] || t === T.VM);

  const del = async () => {
    const targets = (rows ?? []).filter((r) => selected.has(r.id));
    if (!targets.length) return;
    const cascadeNeeded = targets.some((t) => t.type === T.RG);
    const typed = cascadeNeeded ? window.prompt(`Deleting a resource group deletes EVERYTHING in it. Type "${targets.map((t) => t.name).join(", ")}" to confirm.`) : window.confirm(`Delete ${targets.length} resource(s)? This cannot be undone.`) ? "ok" : null;
    if (!typed || (cascadeNeeded && typed !== targets.map((t) => t.name).join(", "))) return;
    const errors: string[] = [];
    for (const t of targets) {
      try {
        await api(`/api/resources/${t.id}?cascade=${t.type === T.RG}`, { method: "DELETE" });
      } catch (e) {
        errors.push(`${t.name}: ${(e as Error).message}`);
      }
    }
    setSelected(new Set());
    setMsg(errors.length ? { kind: "error", text: errors.join(" ") } : { kind: "success", text: `Deleted ${targets.length} resource(s).` });
    reload();
  };

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        {ct.map((t) => (
          <Button key={t} size="sm" onClick={() => setCreating(t)}><Plus />{ct.length > 1 ? (CREATE_FORMS[t]?.title.replace(/^Create (a |an )?/, "") ?? TYPE_LABELS[t]) : "Create"}</Button>
        ))}
        <Button size="sm" variant="secondary" onClick={reload}><RefreshCw />Refresh</Button>
        <Button size="sm" variant="secondary" disabled={!selected.size} onClick={del}><Trash2 />Delete</Button>
        <div className="ml-auto w-full sm:w-64">
          <label className="sr-only" htmlFor={`filter-${title}`}>Filter</label>
          <Input id={`filter-${title}`} placeholder="Filter by name, group, region…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      {title && <p className="px-3 pt-2 text-xs text-muted">{title} · {filtered.length} record(s)</p>}
      {msg && <Alert kind={msg.kind} className="m-3">{msg.text}</Alert>}
      {error && <Alert kind="error" className="m-3">{error}</Alert>}
      {rows === null ? (
        <p className="px-3 py-6 text-sm text-muted">Loading…</p>
      ) : filtered.length === 0 ? (
        <Empty title={q ? "No matching resources" : `No ${title?.toLowerCase() ?? "resources"} to display`}>{emptyHint ?? "Create one to get started."}</Empty>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th className="w-8"><input type="checkbox" aria-label="Select all" className="accent-brand" checked={selected.size === filtered.length} onChange={(e) => setSelected(e.target.checked ? new Set(filtered.map((r) => r.id)) : new Set())} /></Th>
              <Th>Name</Th>
              {types.length > 1 && <Th>Type</Th>}
              {!types.every((t) => [T.ENTRA_USER, T.ENTRA_GROUP, T.ROLE_ASSIGNMENT, T.BUDGET, T.RG].includes(t as never)) && <Th>Resource group</Th>}
              <Th>Location</Th>
              {columns.map((c) => <Th key={c.label}>{c.label}</Th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-subtle">
                <Td><input type="checkbox" aria-label={`Select ${r.name}`} className="accent-brand" checked={selected.has(r.id)} onChange={(e) => setSelected((s) => { const n = new Set(s); if (e.target.checked) n.add(r.id); else n.delete(r.id); return n; })} /></Td>
                <Td><Link href={`/resources/${r.id}`} className="font-medium text-brand hover:underline">{r.name}</Link></Td>
                {types.length > 1 && <Td className="text-muted">{TYPE_LABELS[r.type] ?? r.type}</Td>}
                {!types.every((t) => [T.ENTRA_USER, T.ENTRA_GROUP, T.ROLE_ASSIGNMENT, T.BUDGET, T.RG].includes(t as never)) && <Td>{r.resourceGroup}</Td>}
                <Td>{r.location}</Td>
                {columns.map((c) => <Td key={c.label}>{c.get(r)}</Td>)}
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {creating === T.VM && <VmWizard onClose={() => setCreating(null)} onCreated={(r) => { setCreating(null); router.push(`/resources/${r.id}`); }} />}
      {creating && creating !== T.VM && <CreateBlade type={creating} onClose={() => setCreating(null)} onCreated={(r) => { setCreating(null); setMsg({ kind: "success", text: `Deployment succeeded: ${r.name}` }); reload(); }} defaults={resourceGroup ? { resourceGroup } : undefined} />}
    </Card>
  );
}

export const statusBadge = (s: string) => <Badge color={statusColor(s)}>{s}</Badge>;
