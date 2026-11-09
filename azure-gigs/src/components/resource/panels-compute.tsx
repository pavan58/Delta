"use client";
import Link from "next/link";
import { useState } from "react";
import { Play, RotateCcw, Square, PowerOff, Plug, Terminal as TermIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Alert, Badge, Card, CardHeader, KV, Pre, statusColor, Table, Td, Th } from "@/components/ui/misc";
import { action, useAction, useResources } from "./hooks";
import { T } from "@/lib/sim/types";
import { VM_SIZES } from "@/lib/sim/catalog";
import type { Detail } from "./detail";

type P = { d: Detail; reload: () => void };

export function ActionResult({ a }: { a: { error: string; busy: boolean } }) {
  if (a.busy) return <p className="text-sm text-muted">Working…</p>;
  if (a.error) return <Alert kind="error">{a.error}</Alert>;
  return null;
}

export function VmOverview({ d, reload }: P) {
  const r = d.resource;
  const a = useAction();
  const p = r.properties;
  const run = (name: string) => a.run(() => action(r.id, name)).then(reload);
  const running = p.powerState === "VM running";
  return (
    <Card>
      <CardHeader title="Virtual machine" actions={<>
        <Button size="sm" variant="secondary" disabled={running || a.busy} onClick={() => run("start")}><Play />Start</Button>
        <Button size="sm" variant="secondary" disabled={!running || a.busy} onClick={() => run("restart")}><RotateCcw />Restart</Button>
        <Button size="sm" variant="secondary" disabled={!running || a.busy} onClick={() => run("stop")}><Square />Stop</Button>
        <Button size="sm" variant="secondary" disabled={p.powerState === "VM deallocated" || a.busy} onClick={() => run("deallocate")}><PowerOff />Deallocate</Button>
      </>} />
      <div className="grid gap-3 p-4">
        <ActionResult a={a} />
        <KV items={[
          ["Power state", <Badge key="p" color={statusColor(p.powerState)}>{p.powerState}</Badge>], ["Operating system", `${p.osType} (${p.image.display})`],
          ["Size", `${p.vmSize} (${p.vcpus} vCPU, ${p.memoryGiB} GiB memory)`], ["Public IP address", d.network?.publicIp ?? "None"],
          ["Private IP address", d.network?.privateIp], ["Virtual network/subnet", d.network?.vnet ? <Link key="v" className="text-brand hover:underline" href={`/resources/${d.network.vnet.id}`}>{d.network.vnet.name}/{d.network.subnet}</Link> : "-"],
          ["NIC NSG", d.network?.nicNsg ? <Link key="n" className="text-brand hover:underline" href={`/resources/${d.network.nicNsg.id}`}>{d.network.nicNsg.name}</Link> : "None"], ["Subnet NSG", d.network?.subnetNsg ? <Link key="s" className="text-brand hover:underline" href={`/resources/${d.network.subnetNsg.id}`}>{d.network.subnetNsg.name}</Link> : "None"],
          ["Admin username", p.adminUsername], ["Authentication", p.authenticationType === "ssh" ? `SSH key (${p.sshKeyFingerprint?.slice(0, 20)}…)` : "Password (not stored)"],
          ["Availability zone", p.zone ?? "None"], ["Guest services", Object.entries(p.services ?? {}).map(([k, s]: [string, Detail]) => `${k}: ${s.state}`).join(", ")],
        ]} />
      </div>
    </Card>
  );
}

function Connectivity({ d }: P) {
  const [port, setPort] = useState("80");
  const [source, setSource] = useState("Internet");
  const a = useAction();
  return (
    <Card>
      <CardHeader title="Connection troubleshoot (Network Watcher)" subtitle="Checks power state, public IP, subnet & NIC NSGs and the guest OS listener." />
      <div className="grid gap-3 p-4">
        <div className="flex flex-wrap items-end gap-2">
          <div><label className="text-xs font-semibold" htmlFor="ct-src">Source</label><Input id="ct-src" className="w-56" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Internet, IP or VM name" /></div>
          <div><label className="text-xs font-semibold" htmlFor="ct-port">Destination port</label><Input id="ct-port" className="w-28" value={port} onChange={(e) => setPort(e.target.value)} /></div>
          <Button onClick={() => a.run(() => action(d.resource.id, "testConnectivity", { port: Number(port), source }))}><Plug />Run check</Button>
        </div>
        <ActionResult a={a} />
        {a.result && (
          <div className="grid gap-2" data-testid="connectivity-result">
            <p className="text-sm">Result: <Badge color={statusColor(a.result.result.status)}>{a.result.result.status}</Badge> {a.result.result.source} → {a.result.result.destination}</p>
            <Table><thead><tr><Th>Hop</Th><Th>Result</Th><Th>Detail</Th></tr></thead><tbody>{a.result.result.hops.map((h: Detail, i: number) => <tr key={i}><Td>{h.step}</Td><Td><Badge color={h.result === "Pass" ? "green" : h.result === "Fail" ? "red" : "gray"}>{h.result}</Badge></Td><Td>{h.detail}</Td></tr>)}</tbody></Table>
          </div>
        )}
      </div>
    </Card>
  );
}

function RunCommand({ d, reload }: P) {
  const linux = d.resource.properties.osType === "Linux";
  const [script, setScript] = useState(linux ? "systemctl status nginx\ndf -h" : "Get-Service");
  const a = useAction();
  return (
    <Card>
      <CardHeader title={`Run command (${linux ? "RunShellScript" : "RunPowerShellScript"})`} subtitle="Executes inside the simulated guest OS via the VM agent." />
      <div className="grid gap-2 p-4">
        <Textarea aria-label="Script" rows={4} className="font-mono text-xs" value={script} onChange={(e) => setScript(e.target.value)} />
        <div><Button onClick={() => a.run(() => action(d.resource.id, "runCommand", { script })).then(reload)}><TermIcon />Run</Button></div>
        <ActionResult a={a} />
        {a.result && <Pre>{a.result.output}</Pre>}
      </div>
    </Card>
  );
}

function NetworkingTab({ d, reload }: P) {
  const nsgs = useResources([T.NSG]);
  const [nsg, setNsg] = useState(d.network?.nicNsg?.name ?? "");
  const a = useAction();
  return (
    <Card>
      <CardHeader title="Network settings" />
      <div className="grid gap-3 p-4">
        <KV items={[["Network interface", d.network?.nic?.name], ["Private IP", d.network?.privateIp], ["Public IP", d.network?.publicIp ?? "None"], ["Subnet NSG", d.network?.subnetNsg?.name ?? "None"]]} />
        <Field label="NIC network security group" htmlFor="nic-nsg">
          <div className="flex gap-2">
            <Select id="nic-nsg" value={nsg} onChange={(e) => setNsg(e.target.value)}><option value="">None</option>{(nsgs.rows ?? []).filter((n) => n.location === d.resource.location).map((n) => <option key={n.id} value={n.name}>{n.name}</option>)}</Select>
            <Button onClick={() => a.run(() => action(d.resource.id, "attachNsg", { nsgName: nsg || null })).then(reload)}>Save</Button>
          </div>
        </Field>
        {!d.network?.publicIp && <div><Button variant="secondary" onClick={() => a.run(() => action(d.resource.id, "attachPublicIp")).then(reload)}>Associate a public IP</Button></div>}
        <ActionResult a={a} />
      </div>
    </Card>
  );
}

function SizeTab({ d, reload }: P) {
  const [size, setSize] = useState(d.resource.properties.vmSize);
  const a = useAction();
  return (
    <Card className="p-4">
      <Field label="VM size" htmlFor="resize"><div className="flex gap-2"><Select id="resize" value={size} onChange={(e) => setSize(e.target.value)}>{VM_SIZES.map((s) => <option key={s.name} value={s.name}>{s.name} - {s.vcpus} vCPU, {s.memoryGiB} GiB (${(s.hourly * 730).toFixed(0)}/mo)</option>)}</Select><Button onClick={() => a.run(() => action(d.resource.id, "resize", { size })).then(reload)}>Resize</Button></div></Field>
      <div className="mt-2"><ActionResult a={a} /></div>
      <h3 className="mb-2 mt-6 text-sm font-semibold">Disks</h3>
      <Table><thead><tr><Th>Name</Th><Th>Type</Th><Th>Size</Th><Th>SKU</Th></tr></thead><tbody>{(d.network?.disks ?? []).map((x: Detail) => <tr key={x.id}><Td><Link className="text-brand hover:underline" href={`/resources/${x.id}`}>{x.name}</Link></Td><Td>{x.kind}</Td><Td>{x.sizeGB} GiB</Td><Td>{x.sku}</Td></tr>)}</tbody></Table>
    </Card>
  );
}

export const VM_PANEL = {
  tabs: ["Networking", "Connect & troubleshoot", "Run command", "Size & disks", "Boot diagnostics"],
  overview: VmOverview,
  render: ({ tab, d, reload }: P & { tab: string }) => {
    if (tab === "Networking") return <NetworkingTab d={d} reload={reload} />;
    if (tab === "Connect & troubleshoot") return <Connectivity d={d} reload={reload} />;
    if (tab === "Run command") return <RunCommand d={d} reload={reload} />;
    if (tab === "Size & disks") return <SizeTab d={d} reload={reload} />;
    return <Card className="p-4">{d.resource.properties.bootDiagnostics ? <Pre>{(d.resource.properties.bootLog ?? []).join("\n") || "No boot events yet. Restart the VM to capture a boot log."}</Pre> : <Alert kind="warning">Boot diagnostics is disabled for this VM.</Alert>}</Card>;
  },
};

// ---------------- VNet ----------------
function Subnets({ d, reload }: P) {
  const p = d.resource.properties;
  const nsgs = useResources([T.NSG]);
  const [form, setForm] = useState({ name: "", addressPrefix: "", nsgName: "" });
  const a = useAction();
  return (
    <Card>
      <CardHeader title="Subnets" />
      <Table>
        <thead><tr><Th>Name</Th><Th>IPv4 range</Th><Th>Available IPs</Th><Th>Network security group</Th><Th>Actions</Th></tr></thead>
        <tbody>
          {(p.subnets as Detail[]).map((s) => {
            const used = (d.connected?.nics ?? []).filter((n: Detail) => n.properties.subnet.name === s.name).length;
            const size = 2 ** (32 - Number(s.addressPrefix.split("/")[1]));
            return (
              <tr key={s.name}>
                <Td>{s.name}</Td><Td className="font-mono text-xs">{s.addressPrefix}</Td><Td>{size - 5 - used}</Td>
                <Td><Select aria-label={`NSG for ${s.name}`} value={s.nsgName ?? ""} onChange={(e) => a.run(() => action(d.resource.id, "associateNsg", { subnet: s.name, nsgName: e.target.value || null })).then(reload)}><option value="">None</option>{(nsgs.rows ?? []).filter((n) => n.location === d.resource.location).map((n) => <option key={n.id} value={n.name}>{n.name}</option>)}</Select></Td>
                <Td><Button size="sm" variant="ghost" onClick={() => a.run(() => action(d.resource.id, "deleteSubnet", { name: s.name })).then(reload)}>Delete</Button></Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      <div className="grid gap-2 border-t border-line p-4">
        <h3 className="text-sm font-semibold">Add subnet</h3>
        <div className="flex flex-wrap gap-2">
          <Input aria-label="Subnet name" className="w-40" placeholder="snet-web" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input aria-label="Subnet address range" className="w-44" placeholder="10.0.1.0/24" value={form.addressPrefix} onChange={(e) => setForm({ ...form, addressPrefix: e.target.value })} />
          <Select aria-label="Subnet NSG" className="w-44" value={form.nsgName} onChange={(e) => setForm({ ...form, nsgName: e.target.value })}><option value="">No NSG</option>{(nsgs.rows ?? []).filter((n) => n.location === d.resource.location).map((n) => <option key={n.id} value={n.name}>{n.name}</option>)}</Select>
          <Button onClick={() => a.run(() => action(d.resource.id, "addSubnet", { ...form, nsgName: form.nsgName || null })).then((r) => { if (r) setForm({ name: "", addressPrefix: "", nsgName: "" }); reload(); })}>Add subnet</Button>
        </div>
        <ActionResult a={a} />
      </div>
    </Card>
  );
}

function Peerings({ d, reload }: P) {
  const vnets = useResources([T.VNET]);
  const [name, setName] = useState("");
  const [remote, setRemote] = useState("");
  const a = useAction();
  return (
    <Card>
      <CardHeader title="Peerings" />
      <Table><thead><tr><Th>Name</Th><Th>Remote virtual network</Th><Th>State</Th><Th /></tr></thead><tbody>
        {(d.resource.properties.peerings as Detail[]).map((p) => <tr key={p.name}><Td>{p.name}</Td><Td>{p.remoteVnetName}</Td><Td><Badge color={statusColor(p.peeringState)}>{p.peeringState}</Badge></Td><Td><Button size="sm" variant="ghost" onClick={() => a.run(() => action(d.resource.id, "removePeering", { name: p.name })).then(reload)}>Remove</Button></Td></tr>)}
      </tbody></Table>
      <div className="flex flex-wrap gap-2 border-t border-line p-4">
        <Input aria-label="Peering name" className="w-48" placeholder="hub-to-spoke1" value={name} onChange={(e) => setName(e.target.value)} />
        <Select aria-label="Remote VNet" className="w-56" value={remote} onChange={(e) => setRemote(e.target.value)}><option value="">Remote virtual network</option>{(vnets.rows ?? []).filter((v) => v.id !== d.resource.id).map((v) => <option key={v.id} value={v.name}>{v.name} ({v.properties.addressSpace.addressPrefixes.join(", ")})</option>)}</Select>
        <Button onClick={() => a.run(() => action(d.resource.id, "addPeering", { name, remoteVnet: remote })).then(reload)}>Add peering</Button>
      </div>
      <div className="px-4 pb-4"><ActionResult a={a} /></div>
    </Card>
  );
}

function AddressDns({ d, reload }: P) {
  const p = d.resource.properties;
  const [space, setSpace] = useState(p.addressSpace.addressPrefixes.join(", "));
  const [dns, setDns] = useState((p.dnsServers ?? []).join(", "));
  const a = useAction();
  const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
  return (
    <Card className="grid gap-4 p-4">
      <Field label="Address space" htmlFor="as" help="Comma separated CIDR blocks. Must still contain every subnet."><div className="flex gap-2"><Input id="as" value={space} onChange={(e) => setSpace(e.target.value)} /><Button onClick={() => a.run(() => action(d.resource.id, "updateAddressSpace", { addressPrefixes: list(space) })).then(reload)}>Save</Button></div></Field>
      <Field label="DNS servers" htmlFor="dns" help="Empty = Azure-provided DNS (168.63.129.16)."><div className="flex gap-2"><Input id="dns" value={dns} onChange={(e) => setDns(e.target.value)} placeholder="Azure-provided" /><Button onClick={() => a.run(() => action(d.resource.id, "setDnsServers", { dnsServers: list(dns) })).then(reload)}>Save</Button></div></Field>
      <ActionResult a={a} />
    </Card>
  );
}

export const VNET_PANEL = {
  tabs: ["Subnets", "Peerings", "Address space & DNS", "Connected devices"],
  render: ({ tab, d, reload }: P & { tab: string }) => {
    if (tab === "Subnets") return <Subnets d={d} reload={reload} />;
    if (tab === "Peerings") return <Peerings d={d} reload={reload} />;
    if (tab === "Address space & DNS") return <AddressDns d={d} reload={reload} />;
    return <Card><Table><thead><tr><Th>Device</Th><Th>Type</Th><Th>IP address</Th><Th>Subnet</Th></tr></thead><tbody>{(d.connected?.nics ?? []).map((n: Detail) => <tr key={n.id}><Td><Link className="text-brand hover:underline" href={`/resources/${n.properties.ownerId ?? n.id}`}>{n.properties.ownerName ?? n.name}</Link></Td><Td>Network interface</Td><Td>{n.properties.privateIpAddress}</Td><Td>{n.properties.subnet.name}</Td></tr>)}{!(d.connected?.nics ?? []).length && <tr><Td colSpan={4} className="text-muted">No connected devices.</Td></tr>}</tbody></Table></Card>;
  },
};

// ---------------- NSG ----------------
const EMPTY_RULE = { name: "", priority: "300", direction: "Inbound", access: "Allow", protocol: "Tcp", sourceAddressPrefix: "*", sourcePortRange: "*", destinationAddressPrefix: "*", destinationPortRange: "80" };

function Rules({ d, reload }: P) {
  const [form, setForm] = useState({ ...EMPTY_RULE });
  const [editing, setEditing] = useState<string | null>(null);
  const a = useAction();
  const rules = [...(d.resource.properties.securityRules as Detail[])].sort((x, y) => (x.direction === y.direction ? x.priority - y.priority : x.direction < y.direction ? -1 : 1));
  const save = () => a.run(() => action(d.resource.id, editing ? "updateRule" : "addRule", { ...form, name: editing ?? form.name, priority: Number(form.priority) })).then((r) => { if (r) { setForm({ ...EMPTY_RULE }); setEditing(null); } reload(); });
  const fields: [keyof typeof EMPTY_RULE, string, string[]?][] = [["name", "Name"], ["priority", "Priority"], ["direction", "Direction", ["Inbound", "Outbound"]], ["access", "Action", ["Allow", "Deny"]], ["protocol", "Protocol", ["Tcp", "Udp", "Icmp", "*"]], ["sourceAddressPrefix", "Source"], ["sourcePortRange", "Source ports"], ["destinationAddressPrefix", "Destination"], ["destinationPortRange", "Destination ports"]];
  return (
    <Card>
      <CardHeader title="Security rules" subtitle="Evaluated by priority (lowest first). Default rules are shown below custom rules." />
      <Table>
        <thead><tr><Th>Priority</Th><Th>Name</Th><Th>Direction</Th><Th>Port</Th><Th>Protocol</Th><Th>Source</Th><Th>Destination</Th><Th>Action</Th><Th /></tr></thead>
        <tbody>
          {rules.map((r) => (
            <tr key={r.name}><Td>{r.priority}</Td><Td>{r.name}</Td><Td>{r.direction}</Td><Td>{r.destinationPortRange}</Td><Td>{r.protocol}</Td><Td>{r.sourceAddressPrefix}</Td><Td>{r.destinationAddressPrefix}</Td><Td><Badge color={r.access === "Allow" ? "green" : "red"}>{r.access}</Badge></Td>
              <Td className="whitespace-nowrap"><Button size="sm" variant="ghost" onClick={() => { setEditing(r.name); setForm({ ...EMPTY_RULE, ...r, priority: String(r.priority) }); }}>Edit</Button><Button size="sm" variant="ghost" aria-label={`Delete rule ${r.name}`} onClick={() => a.run(() => action(d.resource.id, "deleteRule", { name: r.name })).then(reload)}>Delete</Button></Td></tr>
          ))}
          {[["65000", "AllowVnetInBound", "Inbound", "*", "VirtualNetwork", "Allow"], ["65001", "AllowAzureLoadBalancerInBound", "Inbound", "*", "AzureLoadBalancer", "Allow"], ["65500", "DenyAllInBound", "Inbound", "*", "*", "Deny"], ["65000", "AllowVnetOutBound", "Outbound", "*", "VirtualNetwork", "Allow"], ["65001", "AllowInternetOutBound", "Outbound", "*", "*", "Allow"], ["65500", "DenyAllOutBound", "Outbound", "*", "*", "Deny"]].map((r) => (
            <tr key={r[1]} className="text-muted"><Td>{r[0]}</Td><Td>{r[1]}</Td><Td>{r[2]}</Td><Td>{r[3]}</Td><Td>Any</Td><Td>{r[4]}</Td><Td>Any</Td><Td><Badge color={r[5] === "Allow" ? "green" : "red"}>{r[5]}</Badge></Td><Td /></tr>
          ))}
        </tbody>
      </Table>
      <div className="grid gap-3 border-t border-line p-4">
        <h3 className="text-sm font-semibold">{editing ? `Edit rule ${editing}` : "Add security rule"}</h3>
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {fields.map(([k, label, options]) => (
            <div key={k} className="grid gap-1">
              <label className="text-xs font-semibold" htmlFor={`rule-${k}`}>{label}</label>
              {options ? <Select id={`rule-${k}`} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })}>{options.map((o) => <option key={o}>{o}</option>)}</Select> : <Input id={`rule-${k}`} disabled={k === "name" && !!editing} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />}
            </div>
          ))}
        </div>
        <div className="flex gap-2"><Button onClick={save}>{editing ? "Save rule" : "Add rule"}</Button>{editing && <Button variant="secondary" onClick={() => { setEditing(null); setForm({ ...EMPTY_RULE }); }}>Cancel</Button>}</div>
        <ActionResult a={a} />
      </div>
    </Card>
  );
}

function FlowVerify({ d }: P) {
  const [f, setF] = useState({ direction: "Inbound", protocol: "Tcp", sourceIp: "203.0.113.10", destinationIp: "10.0.0.4", destinationPort: "80" });
  const a = useAction();
  return (
    <Card className="grid gap-3 p-4">
      <p className="text-sm text-muted">IP flow verify evaluates a single packet against this NSG's rules (custom + default).</p>
      <div className="grid gap-2 sm:grid-cols-5">
        {(Object.keys(f) as (keyof typeof f)[]).map((k) => (
          <div key={k} className="grid gap-1"><label className="text-xs font-semibold" htmlFor={`fv-${k}`}>{k}</label>
            {k === "direction" ? <Select id={`fv-${k}`} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })}><option>Inbound</option><option>Outbound</option></Select> : k === "protocol" ? <Select id={`fv-${k}`} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })}><option>Tcp</option><option>Udp</option><option>Icmp</option></Select> : <Input id={`fv-${k}`} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />}
          </div>
        ))}
      </div>
      <div><Button onClick={() => a.run(() => action(d.resource.id, "evaluate", { ...f, destinationPort: Number(f.destinationPort) }))}>Check</Button></div>
      <ActionResult a={a} />
      {a.result && <Alert kind={a.result.result.access === "Allow" ? "success" : "error"}>Access <strong>{a.result.result.access}</strong> - matched rule <strong>{a.result.result.ruleName}</strong> (priority {a.result.result.rule.priority}).</Alert>}
    </Card>
  );
}

export const NSG_PANEL = {
  tabs: ["Security rules", "IP flow verify"],
  render: ({ tab, d, reload }: P & { tab: string }) => (tab === "Security rules" ? <Rules d={d} reload={reload} /> : <FlowVerify d={d} reload={reload} />),
};

export function RgOverview({ d }: P) {
  return (
    <Card>
      <CardHeader title="Resources" subtitle={`${d.resources?.length ?? 0} resource(s) in this group`} />
      <Table><thead><tr><Th>Name</Th><Th>Type</Th><Th>Location</Th><Th>Status</Th></tr></thead><tbody>
        {(d.resources ?? []).map((r: Detail) => <tr key={r.id}><Td><Link className="text-brand hover:underline" href={`/resources/${r.id}`}>{r.name}</Link></Td><Td>{r.type}</Td><Td>{r.location}</Td><Td>{r.status}</Td></tr>)}
        {!(d.resources ?? []).length && <tr><Td colSpan={4} className="text-muted">This resource group is empty.</Td></tr>}
      </tbody></Table>
    </Card>
  );
}
