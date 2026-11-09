"use client";
import Link from "next/link";
import { useState } from "react";
import { Download, Play, RotateCcw, Square, Upload, Globe } from "lucide-react";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Alert, Badge, Card, CardHeader, KV, Pre, statusColor, Table, Td, Th } from "@/components/ui/misc";
import { CodeEditor } from "@/components/code-editor";
import { action, useAction } from "./hooks";
import { ActionResult } from "./panels-compute";
import type { Detail } from "./detail";
import { timeAgo } from "@/lib/utils";

type P = { d: Detail; reload: () => void };
const fmtBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(2)} MB`);

// ---------------- Storage ----------------
function Containers({ d, reload }: P) {
  const p = d.resource.properties;
  const [name, setName] = useState("");
  const [access, setAccess] = useState("none");
  const [open, setOpen] = useState<string | null>(p.containers[0]?.name ?? null);
  const [blobName, setBlobName] = useState("");
  const [blobText, setBlobText] = useState("");
  const a = useAction();
  const cont = (p.containers as Detail[]).find((c) => c.name === open);
  const uploadFile = async (file: File) => {
    if (file.size > 256 * 1024) return a.setError("Simulated blobs are limited to 256 KB.");
    const buf = new Uint8Array(await file.arrayBuffer());
    let bin = "";
    buf.forEach((b) => (bin += String.fromCharCode(b)));
    await a.run(() => action(d.resource.id, "uploadBlob", { container: open, name: file.name, content: btoa(bin), encoding: "base64", contentType: file.type || "application/octet-stream" }));
    reload();
  };
  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <Card>
        <CardHeader title="Containers" />
        <ul className="divide-y divide-line">
          {(p.containers as Detail[]).map((c) => (
            <li key={c.name}><button onClick={() => setOpen(c.name)} className={`flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-subtle ${open === c.name ? "bg-brand-bg font-semibold" : ""}`}><span>{c.name}</span><span className="text-xs text-muted">{c.publicAccess === "none" ? "Private" : c.publicAccess}</span></button></li>
          ))}
          {!p.containers.length && <li className="px-3 py-3 text-sm text-muted">No containers.</li>}
        </ul>
        <div className="grid gap-2 border-t border-line p-3">
          <Input aria-label="New container name" placeholder="container name" value={name} onChange={(e) => setName(e.target.value)} />
          <Select aria-label="Public access level" value={access} onChange={(e) => setAccess(e.target.value)}><option value="none">Private (no anonymous access)</option><option value="blob">Blob (anonymous read for blobs)</option><option value="container">Container (anonymous read + list)</option></Select>
          <Button size="sm" onClick={() => a.run(() => action(d.resource.id, "createContainer", { name, publicAccess: access })).then((r) => { if (r) { setOpen(name); setName(""); } reload(); })}>Create container</Button>
        </div>
      </Card>
      <Card>
        <CardHeader title={cont ? `Blobs in ${cont.name}` : "Select a container"} actions={cont && <>
          <label className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-sm border border-line px-2 text-xs hover:bg-subtle"><Upload className="size-3.5" />Upload file<input type="file" className="sr-only" onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])} /></label>
          <Button size="sm" variant="secondary" onClick={() => a.run(() => action(d.resource.id, "deleteContainer", { name: cont.name })).then(() => { setOpen(null); reload(); })}>Delete container</Button>
        </>} />
        <div className="p-3"><ActionResult a={a} /></div>
        {cont && (
          <>
            <Table><thead><tr><Th>Name</Th><Th>Size</Th><Th>Tier</Th><Th>Modified</Th><Th /></tr></thead><tbody>
              {(cont.blobs as Detail[]).map((b) => (
                <tr key={b.name}><Td className="break-all">{b.name}</Td><Td>{fmtBytes(b.size)}</Td>
                  <Td><Select aria-label={`Tier for ${b.name}`} className="h-7 w-28" value={b.tier} onChange={(e) => a.run(() => action(d.resource.id, "setBlobTier", { container: cont.name, name: b.name, tier: e.target.value })).then(reload)}>{["Hot", "Cool", "Cold", "Archive"].map((t) => <option key={t}>{t}</option>)}</Select></Td>
                  <Td>{timeAgo(b.lastModified)}</Td>
                  <Td className="whitespace-nowrap"><a className="inline-flex items-center gap-1 px-2 text-xs text-brand hover:underline" href={`/api/resources/${d.resource.id}/blob?container=${encodeURIComponent(cont.name)}&name=${encodeURIComponent(b.name)}`}><Download className="size-3.5" />Download</a><Button size="sm" variant="ghost" onClick={() => a.run(() => action(d.resource.id, "deleteBlob", { container: cont.name, name: b.name })).then(reload)}>Delete</Button></Td></tr>
              ))}
              {!cont.blobs.length && <tr><Td colSpan={5} className="text-muted">No blobs. Upload a file or create a text blob below.</Td></tr>}
            </tbody></Table>
            <div className="grid gap-2 border-t border-line p-3">
              <p className="text-xs font-semibold">Create a text blob</p>
              <Input aria-label="Blob name" placeholder="notes/readme.txt" value={blobName} onChange={(e) => setBlobName(e.target.value)} />
              <Textarea aria-label="Blob content" rows={3} value={blobText} onChange={(e) => setBlobText(e.target.value)} />
              <div><Button size="sm" onClick={() => a.run(() => action(d.resource.id, "uploadBlob", { container: cont.name, name: blobName, content: blobText })).then((r) => { if (r) { setBlobName(""); setBlobText(""); } reload(); })}>Upload</Button></div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function StorageConfig({ d, reload }: P) {
  const p = d.resource.properties;
  const [c, setC] = useState({ accessTier: p.accessTier, allowBlobPublicAccess: p.allowBlobPublicAccess, minimumTlsVersion: p.minimumTlsVersion, httpsOnly: p.supportsHttpsTrafficOnly, allowSharedKeyAccess: p.allowSharedKeyAccess, sku: p.sku });
  const a = useAction();
  return (
    <Card className="grid gap-4 p-4">
      <KV items={[["Performance", p.performance], ["Kind", p.kind], ["Used capacity", fmtBytes(d.usageBytes ?? 0)], ["Blob endpoint", p.primaryEndpoints.blob]]} />
      <Field label="Redundancy" htmlFor="sc-sku"><Select id="sc-sku" value={c.sku} onChange={(e) => setC({ ...c, sku: e.target.value })}>{["Standard_LRS", "Standard_ZRS", "Standard_GRS", "Standard_RAGRS", "Standard_GZRS", "Premium_LRS", "Premium_ZRS"].filter((s) => s.split("_")[0] === p.performance).map((s) => <option key={s}>{s}</option>)}</Select></Field>
      <Field label="Default access tier" htmlFor="sc-tier"><Select id="sc-tier" value={c.accessTier} onChange={(e) => setC({ ...c, accessTier: e.target.value })}><option>Hot</option><option>Cool</option><option>Cold</option></Select></Field>
      <Field label="Minimum TLS version" htmlFor="sc-tls"><Select id="sc-tls" value={c.minimumTlsVersion} onChange={(e) => setC({ ...c, minimumTlsVersion: e.target.value })}><option>TLS1_2</option><option>TLS1_1</option><option>TLS1_0</option></Select></Field>
      {([["allowBlobPublicAccess", "Allow Blob anonymous access"], ["httpsOnly", "Secure transfer required"], ["allowSharedKeyAccess", "Allow storage account key access"]] as const).map(([k, l]) => <Field key={k} label={l} htmlFor={`sc-${k}`}><input id={`sc-${k}`} type="checkbox" className="mt-2 size-4 accent-brand" checked={!!c[k]} onChange={(e) => setC({ ...c, [k]: e.target.checked })} /></Field>)}
      <div className="flex gap-2"><Button onClick={() => a.run(() => action(d.resource.id, "updateConfig", c)).then(reload)}>Save</Button><Button variant="secondary" onClick={() => a.run(() => action(d.resource.id, "rotateKey")).then(reload)}>Rotate access key</Button></div>
      <ActionResult a={a} />
    </Card>
  );
}

function StorageNetworking({ d, reload }: P) {
  const nr = d.resource.properties.networkRules;
  const [mode, setMode] = useState(nr.defaultAction);
  const [ips, setIps] = useState((nr.ipRules as string[]).join(", "));
  const a = useAction();
  return (
    <Card className="grid gap-4 p-4">
      <Field label="Public network access" htmlFor="sn-mode"><Select id="sn-mode" value={mode} onChange={(e) => setMode(e.target.value)}><option value="Allow">Enabled from all networks</option><option value="Deny">Enabled from selected IP addresses</option></Select></Field>
      <Field label="Allowed IP addresses" htmlFor="sn-ips" help="Comma separated. The portal itself connects from 198.51.100.25."><Input id="sn-ips" value={ips} onChange={(e) => setIps(e.target.value)} /></Field>
      <div><Button onClick={() => a.run(() => action(d.resource.id, "updateConfig", { networkDefaultAction: mode, ipRules: ips.split(",").map((x) => x.trim()).filter(Boolean) })).then(reload)}>Save</Button></div>
      <ActionResult a={a} />
    </Card>
  );
}

function StorageAccessTest({ d }: P) {
  const [f, setF] = useState({ container: d.resource.properties.containers[0]?.name ?? "", operation: "read", method: "entraId", principal: "sneha.kulkarni", clientIp: "198.51.100.25" });
  const a = useAction();
  return (
    <Card className="grid gap-3 p-4">
      <p className="text-sm text-muted">Simulates a data-plane request and explains each authorization layer: firewall, anonymous access, shared key, RBAC data roles.</p>
      <div className="grid gap-2 sm:grid-cols-5">
        <div className="grid gap-1"><label className="text-xs font-semibold" htmlFor="sat-c">Container</label><Input id="sat-c" value={f.container} onChange={(e) => setF({ ...f, container: e.target.value })} /></div>
        <div className="grid gap-1"><label className="text-xs font-semibold" htmlFor="sat-o">Operation</label><Select id="sat-o" value={f.operation} onChange={(e) => setF({ ...f, operation: e.target.value })}><option>read</option><option>write</option></Select></div>
        <div className="grid gap-1"><label className="text-xs font-semibold" htmlFor="sat-m">Auth method</label><Select id="sat-m" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}><option value="entraId">Entra ID</option><option value="accountKey">Account key</option><option value="anonymous">Anonymous</option></Select></div>
        <div className="grid gap-1"><label className="text-xs font-semibold" htmlFor="sat-p">Principal</label><Input id="sat-p" value={f.principal} onChange={(e) => setF({ ...f, principal: e.target.value })} /></div>
        <div className="grid gap-1"><label className="text-xs font-semibold" htmlFor="sat-ip">Client IP</label><Input id="sat-ip" value={f.clientIp} onChange={(e) => setF({ ...f, clientIp: e.target.value })} /></div>
      </div>
      <div><Button onClick={() => a.run(() => action(d.resource.id, "testAccess", f))}>Test access</Button></div>
      <ActionResult a={a} />
      {a.result && <><Alert kind={a.result.result.allowed ? "success" : "error"}>{a.result.result.result}</Alert><Table><tbody>{a.result.result.steps.map((s: Detail, i: number) => <tr key={i}><Td>{s.check}</Td><Td><Badge color={s.result === "Pass" ? "green" : "red"}>{s.result}</Badge></Td><Td>{s.detail}</Td></tr>)}</tbody></Table></>}
    </Card>
  );
}

export const STORAGE_PANEL = {
  tabs: ["Containers", "Configuration", "Networking", "Access test"],
  render: ({ tab, d, reload }: P & { tab: string }) => tab === "Containers" ? <Containers d={d} reload={reload} /> : tab === "Configuration" ? <StorageConfig d={d} reload={reload} /> : tab === "Networking" ? <StorageNetworking d={d} reload={reload} /> : <StorageAccessTest d={d} reload={reload} />,
};

// ---------------- Entra ----------------
export const USER_PANEL = {
  tabs: ["Sign-in logs", "Groups & roles"],
  overview: ({ d, reload }: P) => {
    const a = useAction();
    const p = d.resource.properties;
    return (
      <Card>
        <CardHeader title="User" actions={<>
          <Button size="sm" variant="secondary" onClick={() => a.run(() => action(d.resource.id, p.accountEnabled ? "disable" : "enable")).then(reload)}>{p.accountEnabled ? "Block sign-in" : "Unblock sign-in"}</Button>
          <Button size="sm" variant="secondary" onClick={() => a.run(() => action(d.resource.id, "resetPassword")).then(reload)}>Reset password</Button>
          <Button size="sm" variant="secondary" onClick={() => a.run(() => action(d.resource.id, "signIn", {})).then(reload)}>Simulate sign-in</Button>
          <Button size="sm" variant="secondary" onClick={() => a.run(() => action(d.resource.id, "signIn", { correctPassword: false })).then(reload)}>Simulate failed sign-in</Button>
        </>} />
        <div className="grid gap-3 p-4"><ActionResult a={a} /><KV items={[["Display name", p.displayName], ["User principal name", p.userPrincipalName], ["Object ID", <span key="o" className="font-mono text-xs">{p.objectId}</span>], ["Department", p.department], ["Job title", p.jobTitle], ["Account enabled", p.accountEnabled ? "Yes" : "No"]]} /></div>
      </Card>
    );
  },
  render: ({ tab, d }: P & { tab: string }) => tab === "Sign-in logs" ? (
    <Card><Table><thead><tr><Th>Date</Th><Th>Application</Th><Th>Status</Th><Th>Location</Th><Th>Failure reason</Th></tr></thead><tbody>{(d.resource.properties.signIns ?? []).map((s: Detail, i: number) => <tr key={i}><Td>{new Date(s.time).toLocaleString()}</Td><Td>{s.app}</Td><Td><Badge color={s.result === "Success" ? "green" : "red"}>{s.result}</Badge></Td><Td>{s.location}</Td><Td>{s.code ? `${s.code}: ${s.reason}` : ""}</Td></tr>)}{!(d.resource.properties.signIns ?? []).length && <tr><Td colSpan={5} className="text-muted">No sign-ins yet.</Td></tr>}</tbody></Table></Card>
  ) : (
    <Card className="grid gap-4 p-4"><div><p className="mb-1 text-xs font-semibold text-muted">Groups</p><p className="text-sm">{(d.groups ?? []).join(", ") || "None"}</p></div><div><p className="mb-1 text-xs font-semibold text-muted">Role assignments</p>{(d.roleAssignments ?? []).map((r: Detail, i: number) => <p key={i} className="text-sm">{r.roleDefinitionName} at <span className="font-mono text-xs">{r.scope}</span></p>)}{!(d.roleAssignments ?? []).length && <p className="text-sm text-muted">None (group-inherited roles not shown)</p>}</div></Card>
  ),
};

export const GROUP_PANEL = {
  tabs: ["Members"],
  render: ({ d, reload }: P & { tab: string }) => {
    const [user, setUser] = useState(""); // eslint-disable-line react-hooks/rules-of-hooks
    const a = useAction(); // eslint-disable-line react-hooks/rules-of-hooks
    return (
      <Card>
        <Table><thead><tr><Th>Name</Th><Th>User principal name</Th><Th /></tr></thead><tbody>{(d.memberDetails ?? []).map((m: Detail) => <tr key={m.name}><Td>{m.displayName}</Td><Td>{m.name}</Td><Td><Button size="sm" variant="ghost" onClick={() => a.run(() => action(d.resource.id, "removeMember", { user: m.name })).then(reload)}>Remove</Button></Td></tr>)}{!(d.memberDetails ?? []).length && <tr><Td colSpan={3} className="text-muted">No members.</Td></tr>}</tbody></Table>
        <div className="flex gap-2 border-t border-line p-4"><Input aria-label="User to add" placeholder="user name, e.g. priya.nair" value={user} onChange={(e) => setUser(e.target.value)} /><Button onClick={() => a.run(() => action(d.resource.id, "addMember", { user })).then(reload)}>Add member</Button></div>
        <div className="px-4 pb-4"><ActionResult a={a} /></div>
      </Card>
    );
  },
};

// ---------------- App Service ----------------
function SiteOverview({ d, reload }: P) {
  const a = useAction();
  const b = useAction();
  const p = d.resource.properties;
  const run = (n: string) => a.run(() => action(d.resource.id, n)).then(reload);
  return (
    <Card>
      <CardHeader title="Web app" actions={<>
        <Button size="sm" variant="secondary" onClick={() => b.run(() => action(d.resource.id, "browse", { path: "/" })).then(reload)}><Globe />Browse</Button>
        <Button size="sm" variant="secondary" disabled={p.state === "Running"} onClick={() => run("start")}><Play />Start</Button>
        <Button size="sm" variant="secondary" disabled={p.state !== "Running"} onClick={() => run("stop")}><Square />Stop</Button>
        <Button size="sm" variant="secondary" onClick={() => run("restart")}><RotateCcw />Restart</Button>
      </>} />
      <div className="grid gap-3 p-4">
        <ActionResult a={a} />
        {b.result && <Alert kind={b.result.result.status < 400 ? "success" : "error"}>GET {b.result.result.url} → <strong>HTTP {b.result.result.status}</strong><Pre className="mt-2">{b.result.result.body}</Pre></Alert>}
        {b.error && <Alert kind="error">{b.error}</Alert>}
        <KV items={[["State", <Badge key="s" color={statusColor(p.state)}>{p.state}</Badge>], ["Default domain", p.defaultHostName], ["Runtime stack", p.runtime], ["App Service plan", p.planName], ["Active package", p.activePackage ?? "None (default page)"], ["HTTPS only", p.httpsOnly ? "On" : "Off"], ["Managed identity", p.identity ? p.identity.principalName : "Off"]]} />
      </div>
    </Card>
  );
}

function Deployment({ d, reload }: P) {
  const [pkg, setPkg] = useState("hello-node");
  const a = useAction();
  return (
    <Card>
      <CardHeader title="Deployment Center" subtitle="Deploy a sample package (zip deploy) or wire up a pipeline in Azure DevOps." />
      <div className="flex flex-wrap gap-2 p-4"><Select aria-label="Package" className="w-56" value={pkg} onChange={(e) => setPkg(e.target.value)}>{["hello-node", "todo-api", "flask-hello", "dotnet-weather"].map((x) => <option key={x}>{x}</option>)}</Select><Button onClick={() => a.run(() => action(d.resource.id, "deploy", { package: pkg })).then(reload)}>Deploy</Button></div>
      <div className="px-4"><ActionResult a={a} /></div>
      <Table><thead><tr><Th>Time</Th><Th>Status</Th><Th>Source</Th><Th>Package</Th><Th>Log</Th></tr></thead><tbody>{(d.resource.properties.deployments as Detail[]).map((x) => <tr key={x.id}><Td>{timeAgo(x.time)}</Td><Td><Badge color={statusColor(x.status)}>{x.status}</Badge></Td><Td>{x.source}</Td><Td>{x.package}</Td><Td><details><summary className="cursor-pointer text-xs text-brand">View</summary><Pre>{x.log.join("\n")}</Pre></details></Td></tr>)}</tbody></Table>
    </Card>
  );
}

function AppSettings({ d, reload }: P) {
  const [rows, setRows] = useState<[string, string][]>(Object.entries(d.resource.properties.appSettings ?? {}));
  const a = useAction();
  const original = Object.keys(d.resource.properties.appSettings ?? {});
  const save = () => {
    const settings = Object.fromEntries(rows.filter(([k]) => k.trim()));
    return a.run(() => action(d.resource.id, "setAppSettings", { settings, remove: original.filter((k) => !(k in settings)) })).then(reload);
  };
  return (
    <Card className="grid gap-2 p-4">
      <p className="text-sm text-muted">Key Vault references use <code className="font-mono text-xs">@Microsoft.KeyVault(VaultName=…;SecretName=…)</code> and require a managed identity with access.</p>
      {rows.map(([k, v], i) => (
        <div key={i} className="grid grid-cols-[1fr_2fr_auto] gap-2"><Input aria-label="Setting name" value={k} onChange={(e) => setRows(rows.map((r, j) => (j === i ? [e.target.value, r[1]] : r)))} /><Input aria-label="Setting value" value={v} onChange={(e) => setRows(rows.map((r, j) => (j === i ? [r[0], e.target.value] : r)))} /><Button variant="ghost" size="sm" onClick={() => setRows(rows.filter((_, j) => j !== i))}>Remove</Button></div>
      ))}
      <div className="flex gap-2"><Button variant="secondary" size="sm" onClick={() => setRows([...rows, ["", ""]])}>New setting</Button><Button size="sm" onClick={save}>Save</Button></div>
      <ActionResult a={a} />
    </Card>
  );
}

export const SITE_PANEL = {
  tabs: ["Deployment Center", "Configuration", "Log stream", "Identity"],
  overview: SiteOverview,
  render: ({ tab, d, reload }: P & { tab: string }) => {
    if (tab === "Deployment Center") return <Deployment d={d} reload={reload} />;
    if (tab === "Configuration") return <AppSettings d={d} reload={reload} />;
    if (tab === "Log stream") return <Pre>{(d.resource.properties.logs ?? []).slice(-80).join("\n") || "No log entries yet."}</Pre>;
    return <IdentityTab d={d} reload={reload} />;
  },
};

function IdentityTab({ d, reload }: P) {
  const a = useAction();
  const on = !!d.resource.properties.identity;
  return <Card className="grid gap-3 p-4"><p className="text-sm">System assigned managed identity: <strong>{on ? `On (${d.resource.properties.identity.principalName})` : "Off"}</strong></p><div><Button onClick={() => a.run(() => action(d.resource.id, "setIdentity", { enabled: !on })).then(reload)}>{on ? "Turn off" : "Turn on"}</Button></div><ActionResult a={a} /></Card>;
}

// ---------------- Functions ----------------
function Functions({ d, reload }: P) {
  const [f, setF] = useState({ name: "", template: "HttpHello", authLevel: "function" });
  const a = useAction();
  return (
    <Card>
      <Table><thead><tr><Th>Name</Th><Th>Template</Th><Th>Auth level</Th><Th>URL</Th><Th>Function key</Th><Th>Status</Th></tr></thead><tbody>
        {(d.resource.properties.functions as Detail[]).map((x) => <tr key={x.name}><Td>{x.name}</Td><Td>{x.template}</Td><Td>{x.authLevel}</Td><Td className="break-all font-mono text-xs">{x.invokeUrl}</Td><Td className="font-mono text-xs">{x.key}</Td><Td><Button size="sm" variant="ghost" onClick={() => a.run(() => action(d.resource.id, x.disabled ? "enableFunction" : "disableFunction", { name: x.name })).then(reload)}>{x.disabled ? "Enable" : "Disable"}</Button></Td></tr>)}
      </tbody></Table>
      <div className="flex flex-wrap gap-2 border-t border-line p-4">
        <Input aria-label="Function name" className="w-40" placeholder="Greet" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Select aria-label="Template" className="w-44" value={f.template} onChange={(e) => setF({ ...f, template: e.target.value })}>{["HttpHello", "HttpEcho", "HttpEnvReader", "HttpCalculator"].map((t) => <option key={t}>{t}</option>)}</Select>
        <Select aria-label="Authorization level" className="w-36" value={f.authLevel} onChange={(e) => setF({ ...f, authLevel: e.target.value })}><option>anonymous</option><option>function</option><option>admin</option></Select>
        <Button onClick={() => a.run(() => action(d.resource.id, "createFunction", f)).then(reload)}>Create function</Button>
      </div>
      <div className="px-4 pb-4"><ActionResult a={a} /></div>
    </Card>
  );
}

function TestRun({ d, reload }: P) {
  const fns = d.resource.properties.functions as Detail[];
  const [f, setF] = useState({ name: fns[0]?.name ?? "", method: "GET", query: "name=Contoso", body: "", useKey: true });
  const a = useAction();
  const fn = fns.find((x) => x.name === f.name);
  return (
    <Card className="grid gap-3 p-4">
      <div className="grid gap-2 sm:grid-cols-4">
        <Select aria-label="Function" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })}>{fns.map((x) => <option key={x.name}>{x.name}</option>)}</Select>
        <Select aria-label="HTTP method" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>{["GET", "POST", "PUT", "DELETE"].map((m) => <option key={m}>{m}</option>)}</Select>
        <Input aria-label="Query string" placeholder="a=1&b=2" value={f.query} onChange={(e) => setF({ ...f, query: e.target.value })} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-brand" checked={f.useKey} onChange={(e) => setF({ ...f, useKey: e.target.checked })} />Send function key</label>
      </div>
      <Textarea aria-label="Request body" rows={3} placeholder='{"name":"Contoso"}' value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
      <div><Button disabled={!fn} onClick={() => a.run(() => action(d.resource.id, "invoke", { name: f.name, method: f.method, query: Object.fromEntries(new URLSearchParams(f.query)), body: f.body, key: f.useKey ? fn?.key : undefined })).then(reload)}>Run</Button></div>
      <ActionResult a={a} />
      {a.result && <><Alert kind={a.result.result.status < 400 ? "success" : "error"}>HTTP {a.result.result.status}</Alert><Pre>{a.result.result.body}</Pre><Pre>{a.result.result.invocation.logs.join("\n")}</Pre></>}
    </Card>
  );
}

export const FUNCTION_PANEL = {
  tabs: ["Functions", "Code + Test", "Invocations", "Configuration"],
  render: ({ tab, d, reload }: P & { tab: string }) => tab === "Functions" ? <Functions d={d} reload={reload} /> : tab === "Code + Test" ? <TestRun d={d} reload={reload} /> : tab === "Configuration" ? <AppSettings d={d} reload={reload} /> : (
    <Card><Table><thead><tr><Th>Time</Th><Th>Function</Th><Th>Status</Th><Th>Duration</Th></tr></thead><tbody>{(d.resource.properties.invocations as Detail[]).map((x) => <tr key={x.id}><Td>{timeAgo(x.time)}</Td><Td>{x.function}</Td><Td><Badge color={x.status < 400 ? "green" : "red"}>{x.status}</Badge></Td><Td>{x.durationMs} ms</Td></tr>)}</tbody></Table></Card>
  ),
};

// ---------------- SQL ----------------
function SqlNetworking({ d, reload }: P) {
  const p = d.resource.properties;
  const [rule, setRule] = useState({ name: "", startIp: "", endIp: "" });
  const a = useAction();
  return (
    <Card className="grid gap-3 p-4">
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" className="accent-brand" checked={p.publicNetworkAccess === "Enabled"} onChange={(e) => a.run(() => action(d.resource.id, "updateNetwork", { publicNetworkAccess: e.target.checked ? "Enabled" : "Disabled" })).then(reload)} />Public network access</label>
        <label className="flex items-center gap-2"><input type="checkbox" className="accent-brand" checked={!!p.allowAzureServices} onChange={(e) => a.run(() => action(d.resource.id, "updateNetwork", { allowAzureServices: e.target.checked })).then(reload)} />Allow Azure services and resources to access this server</label>
      </div>
      <Table><thead><tr><Th>Rule name</Th><Th>Start IP</Th><Th>End IP</Th><Th /></tr></thead><tbody>{(p.firewallRules as Detail[]).map((r) => <tr key={r.name}><Td>{r.name}</Td><Td>{r.startIp}</Td><Td>{r.endIp}</Td><Td><Button size="sm" variant="ghost" onClick={() => a.run(() => action(d.resource.id, "deleteFirewallRule", { name: r.name })).then(reload)}>Delete</Button></Td></tr>)}</tbody></Table>
      <div className="flex flex-wrap gap-2"><Input aria-label="Rule name" className="w-36" placeholder="office" value={rule.name} onChange={(e) => setRule({ ...rule, name: e.target.value })} /><Input aria-label="Start IP" className="w-36" placeholder="203.0.113.50" value={rule.startIp} onChange={(e) => setRule({ ...rule, startIp: e.target.value })} /><Input aria-label="End IP" className="w-36" placeholder="203.0.113.50" value={rule.endIp} onChange={(e) => setRule({ ...rule, endIp: e.target.value })} /><Button onClick={() => a.run(() => action(d.resource.id, "addFirewallRule", rule)).then(reload)}>Add firewall rule</Button></div>
      <ActionResult a={a} />
      <h3 className="mt-2 text-sm font-semibold">Databases</h3>
      {(d.databases ?? []).map((x: Detail) => <Link key={x.id} className="text-sm text-brand hover:underline" href={`/resources/${x.id}`}>{x.name} ({x.sku})</Link>)}
    </Card>
  );
}

function QueryEditor({ d, reload }: P) {
  const [sql, setSql] = useState("SELECT c.Name, c.Tier, SUM(o.Amount) AS Total\nFROM Customers c JOIN Orders o ON o.CustomerId = c.CustomerId\nGROUP BY c.Name, c.Tier\nORDER BY Total DESC;");
  const a = useAction();
  const r = a.result?.result;
  return (
    <Card className="grid gap-3 p-4">
      <CodeEditor label="SQL query" language="sql" value={sql} onChange={setSql} height={180} />
      <div className="flex items-center gap-3"><Button onClick={() => a.run(() => action(d.resource.id, "query", { sql })).then(reload)}><Play />Run</Button><span className="text-xs text-muted">Sandbox: isolated in-memory engine, 2s timeout, 500 row limit.</span></div>
      <ActionResult a={a} />
      {r && !r.ok && <Alert kind="error">{r.error}</Alert>}
      {r && r.ok && (r.isRead ? (
        <Table><thead><tr>{r.columns.map((c: string) => <Th key={c}>{c}</Th>)}</tr></thead><tbody>{r.rows.map((row: Detail, i: number) => <tr key={i}>{r.columns.map((c: string) => <Td key={c}>{String(row[c] ?? "NULL")}</Td>)}</tr>)}</tbody></Table>
      ) : <Alert kind="success">Query succeeded: {r.changes} row(s) affected ({r.durationMs} ms).</Alert>)}
    </Card>
  );
}

export const SQL_SERVER_PANEL = { tabs: ["Networking"], render: (props: P & { tab: string }) => <SqlNetworking {...props} /> };
export const SQL_DB_PANEL = {
  tabs: ["Query editor", "Query history"],
  render: ({ tab, d, reload }: P & { tab: string }) => tab === "Query editor" ? <QueryEditor d={d} reload={reload} /> : <Card><Table><thead><tr><Th>Time</Th><Th>Status</Th><Th>Duration</Th><Th>Query</Th></tr></thead><tbody>{(d.resource.properties.history as Detail[]).map((h, i) => <tr key={i}><Td>{timeAgo(h.time)}</Td><Td><Badge color={h.ok ? "green" : "red"}>{h.ok ? "Succeeded" : "Failed"}</Badge></Td><Td>{h.durationMs} ms</Td><Td className="font-mono text-xs">{h.sql}</Td></tr>)}</tbody></Table></Card>,
};

// ---------------- Key Vault ----------------
function Secrets({ d, reload }: P) {
  const [f, setF] = useState({ name: "", value: "", expires: "" });
  const [shown, setShown] = useState<Record<string, string>>({});
  const a = useAction();
  const p = d.resource.properties;
  return (
    <Card>
      <Table><thead><tr><Th>Name</Th><Th>Versions</Th><Th>Latest</Th><Th>Expires</Th><Th>Value</Th><Th /></tr></thead><tbody>
        {(p.secrets as Detail[]).map((s) => {
          const v = s.versions[0];
          return (
            <tr key={s.name}>
              <Td>{s.name}</Td><Td>
                <details><summary className="cursor-pointer text-xs text-brand">{s.versions.length} version(s)</summary>{s.versions.map((x: Detail) => <div key={x.version} className="flex items-center gap-2 text-xs"><span className="font-mono">{x.version.slice(0, 8)}</span><Badge color={!x.enabled ? "gray" : x.expired ? "red" : "green"}>{!x.enabled ? "Disabled" : x.expired ? "Expired" : "Enabled"}</Badge><button className="text-brand hover:underline" onClick={() => a.run(() => action(d.resource.id, x.enabled ? "disableVersion" : "enableVersion", { name: s.name, version: x.version })).then(reload)}>{x.enabled ? "Disable" : "Enable"}</button></div>)}</details>
              </Td>
              <Td><Badge color={!v?.enabled ? "gray" : v?.expired ? "red" : "green"}>{!v?.enabled ? "Disabled" : v?.expired ? "Expired" : "Enabled"}</Badge></Td>
              <Td>{v?.expires ? new Date(v.expires).toLocaleString() : "Never"}</Td>
              <Td className="font-mono text-xs">{shown[s.name] ?? <button className="text-brand hover:underline" onClick={() => a.run(() => action(d.resource.id, "getSecret", { name: s.name })).then((r) => r && setShown({ ...shown, [s.name]: r.result.value }))}>Show secret value</button>}</Td>
              <Td><Button size="sm" variant="ghost" onClick={() => a.run(() => action(d.resource.id, "deleteSecret", { name: s.name })).then(reload)}>Delete</Button></Td>
            </tr>
          );
        })}
      </tbody></Table>
      {(p.deletedSecrets as Detail[]).length > 0 && <div className="border-t border-line p-4 text-sm"><p className="mb-1 font-semibold">Deleted (soft-deleted, recoverable)</p>{(p.deletedSecrets as Detail[]).map((s) => <div key={s.name} className="flex items-center gap-2">{s.name}<Button size="sm" variant="ghost" onClick={() => a.run(() => action(d.resource.id, "recoverSecret", { name: s.name })).then(reload)}>Recover</Button><Button size="sm" variant="ghost" onClick={() => a.run(() => action(d.resource.id, "purgeSecret", { name: s.name })).then(reload)}>Purge</Button></div>)}</div>}
      <div className="grid gap-2 border-t border-line p-4 sm:grid-cols-4">
        <Input aria-label="Secret name" placeholder="DbPassword" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Input aria-label="Secret value" type="password" placeholder="value" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} />
        <Input aria-label="Expiration date" type="datetime-local" value={f.expires} onChange={(e) => setF({ ...f, expires: e.target.value })} />
        <Button onClick={() => a.run(() => action(d.resource.id, "setSecret", { name: f.name, value: f.value, expires: f.expires ? new Date(f.expires).toISOString() : null })).then((r) => { if (r) setF({ name: "", value: "", expires: "" }); reload(); })}>Generate/Import (new version)</Button>
      </div>
      <div className="px-4 pb-4"><ActionResult a={a} /></div>
    </Card>
  );
}

function AccessPolicies({ d, reload }: P) {
  const p = d.resource.properties;
  const [principal, setPrincipal] = useState("");
  const [perms, setPerms] = useState<string[]>(["get", "list"]);
  const a = useAction();
  return (
    <Card className="grid gap-3 p-4">
      <div className="flex items-center gap-3 text-sm">Permission model: <strong>{p.enableRbacAuthorization ? "Azure role-based access control" : "Vault access policy"}</strong><Button size="sm" variant="secondary" onClick={() => a.run(() => action(d.resource.id, "setPermissionModel", { rbac: !p.enableRbacAuthorization })).then(reload)}>Switch</Button></div>
      {!p.enableRbacAuthorization && <>
        <Table><thead><tr><Th>Principal</Th><Th>Secret permissions</Th><Th /></tr></thead><tbody>{(p.accessPolicies as Detail[]).map((ap) => <tr key={ap.principal}><Td>{ap.principal}</Td><Td>{ap.secretPermissions.join(", ")}</Td><Td><Button size="sm" variant="ghost" onClick={() => a.run(() => action(d.resource.id, "setAccessPolicy", { principal: ap.principal, secretPermissions: [] })).then(reload)}>Remove</Button></Td></tr>)}</tbody></Table>
        <div className="flex flex-wrap items-center gap-2"><Input aria-label="Principal" className="w-60" placeholder="sneha.kulkarni or app@msi" value={principal} onChange={(e) => setPrincipal(e.target.value)} />{["get", "list", "set", "delete", "recover", "purge"].map((x) => <label key={x} className="flex items-center gap-1 text-sm"><input type="checkbox" className="accent-brand" checked={perms.includes(x)} onChange={(e) => setPerms(e.target.checked ? [...perms, x] : perms.filter((y) => y !== x))} />{x}</label>)}<Button onClick={() => a.run(() => action(d.resource.id, "setAccessPolicy", { principal, secretPermissions: perms })).then(reload)}>Save policy</Button></div>
      </>}
      {p.enableRbacAuthorization && <Alert kind="info">Assign roles such as Key Vault Secrets User in Microsoft Entra ID &gt; Role assignments, scoped to this vault.</Alert>}
      <ActionResult a={a} />
    </Card>
  );
}

function Retrieval({ d }: P) {
  const [f, setF] = useState({ principal: "sneha.kulkarni", name: d.resource.properties.secrets[0]?.name ?? "" });
  const a = useAction();
  return (
    <Card className="grid gap-3 p-4"><div className="flex flex-wrap gap-2"><Input aria-label="Principal" className="w-60" value={f.principal} onChange={(e) => setF({ ...f, principal: e.target.value })} /><Input aria-label="Secret name" className="w-48" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /><Button onClick={() => a.run(() => action(d.resource.id, "testRetrieval", f))}>Test retrieval</Button></div><ActionResult a={a} />{a.result && <Alert kind={a.result.result.allowed ? "success" : "error"}>{a.result.result.detail}</Alert>}</Card>
  );
}

export const KV_PANEL = {
  tabs: ["Secrets", "Access configuration", "Test retrieval", "Audit history"],
  render: ({ tab, d, reload }: P & { tab: string }) => tab === "Secrets" ? <Secrets d={d} reload={reload} /> : tab === "Access configuration" ? <AccessPolicies d={d} reload={reload} /> : tab === "Test retrieval" ? <Retrieval d={d} reload={reload} /> : (
    <Card><Table><thead><tr><Th>Time</Th><Th>Operation</Th><Th>Caller</Th><Th>Secret</Th><Th>Result</Th></tr></thead><tbody>{(d.resource.properties.audit as Detail[]).map((x, i) => <tr key={i}><Td>{timeAgo(x.time)}</Td><Td>{x.operation}</Td><Td className="break-all">{x.caller}</Td><Td>{x.secret ?? x.principal ?? ""}</Td><Td><Badge color={x.result === "Success" ? "green" : "red"}>{x.result}</Badge></Td></tr>)}</tbody></Table></Card>
  ),
};

export function AlertOverview({ d, reload }: P) {
  const a = useAction();
  const p = d.resource.properties;
  return (
    <Card>
      <CardHeader title="Alert rule" actions={<Button size="sm" variant="secondary" onClick={() => a.run(() => action(d.resource.id, p.enabled ? "disable" : "enable")).then(reload)}>{p.enabled ? "Disable" : "Enable"}</Button>} />
      <div className="grid gap-3 p-4"><ActionResult a={a} /><KV items={[["Target", p.targetName], ["Condition", `${p.aggregation} ${p.metric} ${p.operator} ${p.threshold}`], ["Window", `${p.windowMinutes} min`], ["Severity", `Sev${p.severity}`], ["State", <Badge key="s" color={p.state === "Fired" ? "red" : "green"}>{p.state}</Badge>], ["Enabled", p.enabled ? "Yes" : "No"]]} />
        <h3 className="text-sm font-semibold">History</h3>
        <Table><thead><tr><Th>Time</Th><Th>State</Th><Th>Value</Th></tr></thead><tbody>{(p.history as Detail[]).map((h, i) => <tr key={i}><Td>{new Date(h.time).toLocaleString()}</Td><Td><Badge color={h.state === "Fired" ? "red" : "green"}>{h.state}</Badge></Td><Td>{h.value}</Td></tr>)}{!p.history.length && <tr><Td colSpan={3} className="text-muted">No state changes yet (open Monitor to evaluate).</Td></tr>}</tbody></Table>
      </div>
    </Card>
  );
}

export function SimpleProps({ d }: P) {
  const entries = Object.entries(d.resource.properties).filter(([, v]) => v === null || typeof v !== "object").slice(0, 16) as [string, unknown][];
  return <Card className="p-4"><KV items={entries.map(([k, v]) => [k, String(v ?? "-")])} /></Card>;
}

export { api };
