"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Button } from "./ui/button";
import { Input } from "./ui/form";
import { Alert, Badge, Card, CardHeader, statusColor, Table, Td, Th } from "./ui/misc";
import { Section } from "./sections";
import { timeAgo } from "@/lib/utils";

type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any

function CheckAccess() {
  const [f, setF] = useState({ principal: "sneha.kulkarni", action: "Microsoft.Compute/virtualMachines/write", scope: "/resourceGroups/rg-web-dev" });
  const [r, setR] = useState<Any>(null);
  const [err, setErr] = useState("");
  const presets = ["Microsoft.Compute/virtualMachines/write", "Microsoft.Compute/virtualMachines/read", "Microsoft.Network/virtualNetworks/write", "Microsoft.Storage/storageAccounts/blobServices/containers/blobs/read", "Microsoft.KeyVault/vaults/secrets/getSecret/action", "Microsoft.Authorization/roleAssignments/write"];
  return (
    <Card>
      <CardHeader title="Check access" subtitle="Evaluates role assignments (direct and via groups) with scope inheritance - including access-denied scenarios." />
      <div className="grid gap-2 p-4 sm:grid-cols-3">
        <div className="grid gap-1"><label className="text-xs font-semibold" htmlFor="ca-p">Principal</label><Input id="ca-p" value={f.principal} onChange={(e) => setF({ ...f, principal: e.target.value })} /></div>
        <div className="grid gap-1"><label className="text-xs font-semibold" htmlFor="ca-a">Action</label><Input id="ca-a" list="ca-actions" value={f.action} onChange={(e) => setF({ ...f, action: e.target.value })} /><datalist id="ca-actions">{presets.map((p) => <option key={p} value={p} />)}</datalist></div>
        <div className="grid gap-1"><label className="text-xs font-semibold" htmlFor="ca-s">Scope</label><Input id="ca-s" value={f.scope} onChange={(e) => setF({ ...f, scope: e.target.value })} /></div>
      </div>
      <div className="grid gap-2 px-4 pb-4"><div><Button onClick={() => api("/api/rbac/check", { body: f }).then((x) => { setR(x); setErr(""); }).catch((e) => setErr(e.message))}>Check access</Button></div>
        {err && <Alert kind="error">{err}</Alert>}
        {r && <Alert kind={r.allowed ? "success" : "error"}><strong>{r.allowed ? "Allowed" : "Denied"}</strong> - {r.reason}</Alert>}
      </div>
    </Card>
  );
}

function Logs({ kind }: { kind: "signin" | "audit" }) {
  const [logs, setLogs] = useState<Any[]>([]);
  useEffect(() => {
    api("/api/activity?take=300").then((r) => setLogs(r.logs.filter((l: Any) => (kind === "signin" ? l.operation === "Sign-in activity" : /Microsoft\.(Entra|Authorization)/.test(l.resourceType ?? "") && l.operation !== "Sign-in activity")))).catch(() => undefined);
  }, [kind]);
  return (
    <Card><Table><thead><tr><Th>Time</Th>{kind === "signin" ? <><Th>User</Th><Th>Application</Th><Th>Status</Th><Th>Location</Th></> : <><Th>Activity</Th><Th>Target</Th><Th>Initiated by</Th><Th>Result</Th></>}</tr></thead>
      <tbody>{logs.map((l) => kind === "signin" ? <tr key={l.id}><Td>{timeAgo(l.createdAt)}</Td><Td>{l.resourceName}</Td><Td>{l.details.app}</Td><Td><Badge color={statusColor(l.status)}>{l.status}</Badge>{l.details.reason ? ` ${l.details.reason}` : ""}</Td><Td>{l.details.location}</Td></tr> : <tr key={l.id}><Td>{timeAgo(l.createdAt)}</Td><Td>{l.operation}</Td><Td className="break-all">{l.resourceName}</Td><Td className="break-all text-xs">{l.caller}</Td><Td><Badge color={statusColor(l.status)}>{l.status}</Badge></Td></tr>)}{!logs.length && <tr><Td colSpan={5} className="text-muted">No entries yet.{kind === "signin" ? " Open a user and use 'Simulate sign-in'." : ""}</Td></tr>}</tbody>
    </Table></Card>
  );
}

export function EntraView() {
  const [tab, setTab] = useState("Users");
  const tabs = ["Users", "Groups", "Role assignments", "Check access", "Sign-in logs", "Audit logs"];
  return (
    <div>
      <div role="tablist" className="mb-3 flex gap-1 overflow-x-auto border-b border-line">{tabs.map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm ${tab === t ? "border-brand font-semibold text-brand" : "border-transparent text-muted"}`}>{t}</button>)}</div>
      {tab === "Users" && <Section which="users" />}
      {tab === "Groups" && <Section which="groups" />}
      {tab === "Role assignments" && <Section which="roles" />}
      {tab === "Check access" && <CheckAccess />}
      {tab === "Sign-in logs" && <Logs kind="signin" />}
      {tab === "Audit logs" && <Logs kind="audit" />}
    </div>
  );
}
