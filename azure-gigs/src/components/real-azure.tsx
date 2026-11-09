"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Button } from "./ui/button";
import { Input, Select } from "./ui/form";
import { Alert, Badge, Card, CardHeader, Table, Td, Th } from "./ui/misc";

type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any

export function RealAzure({ status }: { status?: string }) {
  const [info, setInfo] = useState<Any>(null);
  const [account, setAccount] = useState("");
  const [subs, setSubs] = useState<Any[]>([]);
  const [sub, setSub] = useState("");
  const [rgs, setRgs] = useState<Any[]>([]);
  const [rg, setRg] = useState("");
  const [res, setRes] = useState<Any[]>([]);
  const [err, setErr] = useState("");
  const [newRg, setNewRg] = useState({ name: "", location: "eastus" });
  const [sa, setSa] = useState({ name: "", sku: "Standard_LRS" });
  const [estimate, setEstimate] = useState<Any>(null);
  const [confirm, setConfirm] = useState(false);
  const [msg, setMsg] = useState("");
  const guard = (p: Promise<unknown>) => p.catch((e) => setErr((e as Error).message));
  const loadAccounts = () => guard(api("/api/azure/accounts").then((r) => { setInfo(r); if (r.accounts[0]) setAccount(r.accounts[0].id); }));
  useEffect(() => {
    loadAccounts();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (account) guard(api(`/api/azure/subscriptions?account=${account}`).then((r) => setSubs(r.subscriptions)));
  }, [account]); // eslint-disable-line react-hooks/exhaustive-deps
  const loadRgs = () => sub && guard(api(`/api/azure/resource-groups?account=${account}&subscription=${sub}`).then((r) => setRgs(r.resourceGroups)));
  useEffect(() => {
    loadRgs();
  }, [sub]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (rg) guard(api(`/api/azure/resources?account=${account}&subscription=${sub}&resourceGroup=${rg}`).then((r) => setRes(r.resources)));
  }, [rg]); // eslint-disable-line react-hooks/exhaustive-deps
  const region = rgs.find((g) => g.name === rg)?.location ?? "eastus";
  return (
    <div className="grid gap-4">
      <Alert kind="warning"><strong>Real Azure Mode</strong> acts on <em>your own Microsoft Azure subscription</em> using delegated permissions you grant. Resources created here are real and may incur charges billed by Microsoft. Everything else in Azure Gigs is simulated.</Alert>
      {status && <Alert kind={status === "connected" ? "success" : "error"}>{status === "connected" ? "Azure account connected." : status}</Alert>}
      {err && <Alert kind="error">{err}</Alert>}
      {info && !info.configured && <Alert kind="info">This deployment has no Microsoft Entra app registration configured, so Real Azure Mode is disabled. An administrator must set AZURE_AD_CLIENT_ID, AZURE_AD_CLIENT_SECRET and APP_URL (see docs/REAL_AZURE.md).</Alert>}
      <Card><CardHeader title="Connected accounts" actions={info?.configured && <a href="/api/azure/connect" className="inline-flex h-7 items-center rounded-sm bg-brand px-2 text-xs font-medium text-white">Connect with Microsoft</a>} />
        <Table><thead><tr><Th>Account</Th><Th>Tenant</Th><Th>Connected</Th><Th /></tr></thead><tbody>{(info?.accounts ?? []).map((a: Any) => <tr key={a.id}><Td>{a.accountUpn}</Td><Td className="font-mono text-xs">{a.tenantId}</Td><Td>{new Date(a.connectedAt).toLocaleString()}</Td><Td><Button size="sm" variant="ghost" onClick={() => guard(api("/api/azure/accounts", { method: "DELETE", body: { accountId: a.id } }).then(loadAccounts))}>Disconnect</Button></Td></tr>)}{info && !info.accounts.length && <tr><Td colSpan={4} className="text-muted">No accounts connected. Tokens are stored AES-256-GCM encrypted and never sent to the browser.</Td></tr>}</tbody></Table>
      </Card>
      {account && (
        <Card><CardHeader title="Subscription & resource groups" />
          <div className="grid gap-3 p-4">
            <Select aria-label="Subscription" value={sub} onChange={(e) => setSub(e.target.value)}><option value="">Select subscription</option>{subs.map((s) => <option key={s.subscriptionId} value={s.subscriptionId}>{s.displayName} ({s.subscriptionId})</option>)}</Select>
            {sub && <Table><thead><tr><Th>Resource group</Th><Th>Location</Th><Th>State</Th><Th /></tr></thead><tbody>{rgs.map((g) => <tr key={g.name}><Td><button className="text-brand hover:underline" onClick={() => setRg(g.name)}>{g.name}</button></Td><Td>{g.location}</Td><Td>{g.provisioningState}</Td><Td><Button size="sm" variant="ghost" onClick={() => { const c = window.prompt(`Type ${g.name} to permanently delete this REAL resource group and everything in it.`); if (c) guard(api("/api/azure/resource-groups", { method: "DELETE", body: { account, subscriptionId: sub, name: g.name, confirmName: c } }).then(() => { setMsg(`Deletion of ${g.name} accepted by Azure.`); loadRgs(); })); }}>Delete</Button></Td></tr>)}</tbody></Table>}
            {sub && <div className="flex flex-wrap gap-2"><Input aria-label="New resource group name" className="w-56" placeholder="rg-azuregigs-lab" value={newRg.name} onChange={(e) => setNewRg({ ...newRg, name: e.target.value })} /><Input aria-label="Location" className="w-36" value={newRg.location} onChange={(e) => setNewRg({ ...newRg, location: e.target.value })} /><Button onClick={() => guard(api("/api/azure/resource-groups", { body: { account, subscriptionId: sub, ...newRg } }).then(() => { setMsg("Resource group created (no cost)."); loadRgs(); }))}>Create resource group (free)</Button></div>}
          </div>
        </Card>
      )}
      {rg && (
        <Card><CardHeader title={`Resources in ${rg}`} />
          <Table><thead><tr><Th>Name</Th><Th>Type</Th><Th>Location</Th></tr></thead><tbody>{res.map((r) => <tr key={r.id}><Td>{r.name}</Td><Td>{r.type}</Td><Td>{r.location}</Td></tr>)}{!res.length && <tr><Td colSpan={3} className="text-muted">Empty.</Td></tr>}</tbody></Table>
          <div className="grid gap-2 border-t border-line p-4">
            <p className="text-sm font-semibold">Provision a storage account (chargeable)</p>
            <div className="flex flex-wrap gap-2"><Input aria-label="Storage account name" className="w-56" placeholder="stazuregigs123" value={sa.name} onChange={(e) => setSa({ ...sa, name: e.target.value })} /><Select aria-label="SKU" className="w-40" value={sa.sku} onChange={(e) => setSa({ ...sa, sku: e.target.value })}><option>Standard_LRS</option><option>Standard_ZRS</option><option>Standard_GRS</option></Select><Button variant="secondary" onClick={() => guard(api(`/api/azure/estimate?location=${region}&sku=${sa.sku}`).then(setEstimate))}>Estimate cost</Button></div>
            {estimate && <Alert kind="info">Estimated ${estimate.perGbMonth} per GB/month ({estimate.source}). Example: 10 GB ≈ ${estimate.example10GB}/month plus transactions. <label className="mt-2 flex items-center gap-2"><input type="checkbox" className="accent-brand" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />I understand this creates a real, billable resource in my subscription.</label></Alert>}
            <div><Button disabled={!estimate || !confirm} onClick={() => guard(api("/api/azure/storage", { body: { account, subscriptionId: sub, resourceGroup: rg, name: sa.name, location: region, sku: sa.sku, confirmCost: true } }).then(() => setMsg("Storage account provisioning accepted by Azure.")))}>Create in Azure</Button></div>
          </div>
        </Card>
      )}
      {msg && <Alert kind="success">{msg}</Alert>}
      <Card className="p-4 text-sm"><Badge color="blue">Security</Badge> Least privilege: Azure Gigs requests only the delegated <code className="font-mono">user_impersonation</code> scope; what you can do is limited by your own Azure RBAC. Disconnect at any time to delete stored tokens.</Card>
    </div>
  );
}
