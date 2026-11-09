"use client";
import { useMemo, useState } from "react";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { Alert } from "@/components/ui/misc";
import { Blade } from "./create-blade";
import { LOCATION_OPTIONS } from "./forms";
import { useResources } from "./hooks";
import { T } from "@/lib/sim/types";
import { VM_IMAGES, VM_SIZES } from "@/lib/sim/catalog";

const TABS = ["Basics", "Disks", "Networking", "Management", "Review + create"] as const;

export function VmWizard({ onClose, onCreated }: { onClose: () => void; onCreated: (r: { id: string; name: string }) => void }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Basics");
  const [v, setV] = useState({
    resourceGroup: "", name: "", location: "", image: "Ubuntu2204", size: "Standard_B2s", zone: "",
    authenticationType: "ssh", adminUsername: "azureuser", adminPassword: "", sshPublicKey: "",
    osDiskType: "Premium_LRS", osDiskSizeGB: "", dataDiskGB: "",
    vnetName: "", subnetName: "", publicIp: true, nsgMode: "basic" as "none" | "basic" | "existing", nsgName: "", nsgRule: "NONE",
    installWebServer: false, bootDiagnostics: true, tags: "",
  });
  const set = (k: keyof typeof v, val: unknown) => setV((s) => ({ ...s, [k]: val }));
  const rgs = useResources([T.RG]);
  const vnets = useResources([T.VNET]);
  const nsgs = useResources([T.NSG]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const image = VM_IMAGES.find((i) => i.alias === v.image)!;
  const size = VM_SIZES.find((s) => s.name === v.size)!;
  const vnet = (vnets.rows ?? []).find((x) => x.name === v.vnetName);
  const rg = (rgs.rows ?? []).find((r) => r.name === v.resourceGroup);
  const region = v.location || rg?.location || "";
  const regionVnets = (vnets.rows ?? []).filter((x) => !region || x.location === region);
  const monthly = useMemo(() => Math.round(size.hourly * 730 * (image.os === "Windows" ? 1.45 : 1) * 100) / 100, [size, image]);
  const problems: string[] = [];
  if (!v.resourceGroup) problems.push("Resource group is required (Basics).");
  if (!v.name) problems.push("Virtual machine name is required (Basics).");
  if (image.os === "Windows" && v.authenticationType === "ssh") problems.push("Windows images require password authentication.");
  if (v.authenticationType === "password" && v.adminPassword.length < 12) problems.push("Password must be 12+ characters with 3 of: upper, lower, digit, symbol.");
  if (v.vnetName && !v.subnetName) problems.push("Select a subnet (Networking).");
  if (v.nsgMode === "existing" && !v.nsgName) problems.push("Select an existing NSG (Networking).");

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const tags = Object.fromEntries(v.tags.split(",").map((t) => t.trim()).filter(Boolean).map((t) => [t.split("=")[0].trim(), (t.split("=")[1] ?? "").trim()]));
      const r = await api("/api/resources", {
        body: {
          type: T.VM,
          input: {
            resourceGroup: v.resourceGroup, name: v.name, location: v.location || undefined, image: v.image, size: v.size, zone: v.zone || undefined,
            authenticationType: v.authenticationType, adminUsername: v.adminUsername, adminPassword: v.authenticationType === "password" ? v.adminPassword : undefined,
            sshPublicKey: v.sshPublicKey || undefined, generateSshKeys: !v.sshPublicKey, osDiskType: v.osDiskType, osDiskSizeGB: v.osDiskSizeGB ? Number(v.osDiskSizeGB) : undefined,
            dataDisks: v.dataDiskGB ? [{ sizeGB: Number(v.dataDiskGB), sku: "Premium_LRS" }] : [],
            vnetName: v.vnetName || undefined, subnetName: v.subnetName || undefined, publicIp: v.publicIp,
            nsgName: v.nsgMode === "existing" ? v.nsgName : v.nsgMode === "none" ? null : undefined, createNsg: v.nsgMode === "basic", nsgRule: v.nsgRule,
            installWebServer: v.installWebServer, bootDiagnostics: v.bootDiagnostics, tags,
          },
        },
      });
      onCreated(r.resource);
    } catch (e) {
      setError((e as Error).message);
      setTab("Review + create");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Blade title="Create a virtual machine" onClose={onClose} wide>
      <div role="tablist" className="mb-4 flex flex-wrap gap-4 border-b border-line text-sm">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`-mb-px border-b-2 px-1 pb-2 ${tab === t ? "border-brand font-semibold text-brand" : "border-transparent text-muted hover:text-ink"}`}>{t}</button>
        ))}
      </div>
      {error && <Alert kind="error" className="mb-3">{error}</Alert>}
      <div className="grid gap-4">
        {tab === "Basics" && (
          <>
            <h3 className="text-sm font-semibold">Project details</h3>
            <Field label="Resource group" htmlFor="vm-rg" required><Select id="vm-rg" value={v.resourceGroup} onChange={(e) => set("resourceGroup", e.target.value)}><option value="">Select a resource group</option>{(rgs.rows ?? []).map((r) => <option key={r.id} value={r.name}>{r.name} ({r.location})</option>)}</Select></Field>
            <h3 className="text-sm font-semibold">Instance details</h3>
            <Field label="Virtual machine name" htmlFor="vm-name" required><Input id="vm-name" value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="vm-web-01" /></Field>
            <Field label="Region" htmlFor="vm-loc"><Select id="vm-loc" value={v.location} onChange={(e) => set("location", e.target.value)}><option value="">Same as resource group{rg ? ` (${rg.location})` : ""}</option>{LOCATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></Field>
            <Field label="Availability zone" htmlFor="vm-zone"><Select id="vm-zone" value={v.zone} onChange={(e) => set("zone", e.target.value)}><option value="">No infrastructure redundancy required</option><option value="1">Zone 1</option><option value="2">Zone 2</option><option value="3">Zone 3</option></Select></Field>
            <Field label="Image" htmlFor="vm-image"><Select id="vm-image" value={v.image} onChange={(e) => { set("image", e.target.value); const win = e.target.value.startsWith("Win"); set("authenticationType", win ? "password" : "ssh"); }}>{VM_IMAGES.map((i) => <option key={i.alias} value={i.alias}>{i.display}</option>)}</Select></Field>
            <Field label="Size" htmlFor="vm-size" help={`${size.vcpus} vCPU, ${size.memoryGiB} GiB RAM · est. $${monthly}/month (simulated price)`}><Select id="vm-size" value={v.size} onChange={(e) => set("size", e.target.value)}>{VM_SIZES.map((s) => <option key={s.name} value={s.name}>{s.name} - {s.vcpus} vCPU, {s.memoryGiB} GiB</option>)}</Select></Field>
            <h3 className="text-sm font-semibold">Administrator account</h3>
            <Field label="Authentication type" htmlFor="vm-auth"><Select id="vm-auth" value={v.authenticationType} onChange={(e) => set("authenticationType", e.target.value)}>{image.os === "Linux" && <option value="ssh">SSH public key</option>}<option value="password">Password</option></Select></Field>
            <Field label="Username" htmlFor="vm-user"><Input id="vm-user" value={v.adminUsername} onChange={(e) => set("adminUsername", e.target.value)} /></Field>
            {v.authenticationType === "password" ? (
              <Field label="Password" htmlFor="vm-pass" help="12-123 chars, 3 of: lowercase, uppercase, digit, symbol. Never stored - only validated."><Input id="vm-pass" type="password" autoComplete="new-password" value={v.adminPassword} onChange={(e) => set("adminPassword", e.target.value)} /></Field>
            ) : (
              <Field label="SSH public key" htmlFor="vm-ssh" help="Leave empty to generate a new key pair."><Input id="vm-ssh" value={v.sshPublicKey} onChange={(e) => set("sshPublicKey", e.target.value)} placeholder="ssh-ed25519 AAAA…" /></Field>
            )}
          </>
        )}
        {tab === "Disks" && (
          <>
            <Field label="OS disk type" htmlFor="vm-disk"><Select id="vm-disk" value={v.osDiskType} onChange={(e) => set("osDiskType", e.target.value)}><option value="Premium_LRS">Premium SSD (locally-redundant)</option><option value="StandardSSD_LRS">Standard SSD</option><option value="Standard_LRS">Standard HDD</option></Select></Field>
            <Field label="OS disk size (GiB)" htmlFor="vm-disksize" help={`Default: ${image.os === "Windows" ? 127 : 30} GiB`}><Input id="vm-disksize" type="number" value={v.osDiskSizeGB} onChange={(e) => set("osDiskSizeGB", e.target.value)} /></Field>
            <Field label="Data disk (GiB, optional)" htmlFor="vm-data"><Input id="vm-data" type="number" value={v.dataDiskGB} onChange={(e) => set("dataDiskGB", e.target.value)} /></Field>
          </>
        )}
        {tab === "Networking" && (
          <>
            <Field label="Virtual network" htmlFor="vm-vnet" help="Leave empty to create <vm>VNET (10.0.0.0/16) automatically."><Select id="vm-vnet" value={v.vnetName} onChange={(e) => { set("vnetName", e.target.value); set("subnetName", ""); }}><option value="">(new) {v.name || "vm"}VNET</option>{regionVnets.map((x) => <option key={x.id} value={x.name}>{x.name} ({x.resourceGroup})</option>)}</Select></Field>
            {vnet && (
              <Field label="Subnet" htmlFor="vm-subnet"><Select id="vm-subnet" value={v.subnetName} onChange={(e) => set("subnetName", e.target.value)}><option value="">Select a subnet</option>{(vnet.properties.subnets as { name: string; addressPrefix: string }[]).map((s) => <option key={s.name} value={s.name}>{s.name} ({s.addressPrefix})</option>)}</Select></Field>
            )}
            <Field label="Public IP" htmlFor="vm-pip"><input id="vm-pip" type="checkbox" className="mt-2 size-4 accent-brand" checked={v.publicIp} onChange={(e) => set("publicIp", e.target.checked)} /></Field>
            <Field label="NIC network security group" htmlFor="vm-nsgmode"><Select id="vm-nsgmode" value={v.nsgMode} onChange={(e) => set("nsgMode", e.target.value)}><option value="none">None</option><option value="basic">Basic (create new)</option><option value="existing">Advanced (select existing)</option></Select></Field>
            {v.nsgMode === "basic" && <Field label="Public inbound ports" htmlFor="vm-ports" help="Opening SSH/RDP to the Internet is flagged by the grader."><Select id="vm-ports" value={v.nsgRule} onChange={(e) => set("nsgRule", e.target.value)}><option value="NONE">None</option><option value={image.os === "Windows" ? "RDP" : "SSH"}>Allow {image.os === "Windows" ? "RDP (3389)" : "SSH (22)"}</option></Select></Field>}
            {v.nsgMode === "existing" && <Field label="Network security group" htmlFor="vm-nsg"><Select id="vm-nsg" value={v.nsgName} onChange={(e) => set("nsgName", e.target.value)}><option value="">Select an NSG</option>{(nsgs.rows ?? []).filter((n) => !region || n.location === region).map((n) => <option key={n.id} value={n.name}>{n.name} ({n.resourceGroup})</option>)}</Select></Field>}
          </>
        )}
        {tab === "Management" && (
          <>
            <Field label="Boot diagnostics" htmlFor="vm-bd"><input id="vm-bd" type="checkbox" className="mt-2 size-4 accent-brand" checked={v.bootDiagnostics} onChange={(e) => set("bootDiagnostics", e.target.checked)} /></Field>
            <Field label="Install web server" htmlFor="vm-web" help="cloud-init installs nginx (Linux) or IIS (Windows) listening on port 80."><input id="vm-web" type="checkbox" className="mt-2 size-4 accent-brand" checked={v.installWebServer} onChange={(e) => set("installWebServer", e.target.checked)} /></Field>
            <Field label="Tags" htmlFor="vm-tags" help="key=value, comma separated"><Input id="vm-tags" value={v.tags} onChange={(e) => set("tags", e.target.value)} placeholder="env=dev, owner=me" /></Field>
          </>
        )}
        {tab === "Review + create" && (
          <div className="grid gap-3 text-sm">
            {problems.length ? <Alert kind="error">Validation failed:<ul className="ml-4 list-disc">{problems.map((p) => <li key={p}>{p}</li>)}</ul></Alert> : <Alert kind="success">Validation passed.</Alert>}
            <Alert kind="info">Estimated cost: <strong>${monthly}/month</strong> (simulated - no charges in Virtual Azure Mode).</Alert>
            {[
              ["Resource group", v.resourceGroup], ["Name", v.name], ["Region", region], ["Image", image.display], ["Size", `${size.name} (${size.vcpus} vCPU, ${size.memoryGiB} GiB)`], ["Authentication", v.authenticationType],
              ["Virtual network", v.vnetName || `(new) ${v.name}VNET`], ["Subnet", v.subnetName || "(default)"], ["Public IP", v.publicIp ? "Yes" : "No"], ["NIC NSG", v.nsgMode === "existing" ? v.nsgName : v.nsgMode === "basic" ? `(new) ${v.name}NSG, inbound: ${v.nsgRule}` : "None"], ["Web server", v.installWebServer ? "Yes" : "No"],
            ].map(([k, val]) => <div key={k} className="grid grid-cols-[180px_1fr] gap-2"><span className="text-muted">{k}</span><span>{val || "-"}</span></div>)}
          </div>
        )}
      </div>
      <div className="sticky bottom-0 mt-6 flex flex-wrap gap-2 border-t border-line bg-surface pt-3">
        {tab !== "Review + create" ? <Button onClick={() => setTab("Review + create")}>Review + create</Button> : <Button onClick={submit} disabled={busy || problems.length > 0}>{busy ? "Deploying…" : "Create"}</Button>}
        {tab !== "Basics" && <Button variant="secondary" onClick={() => setTab(TABS[TABS.indexOf(tab) - 1])}>Previous</Button>}
        {tab !== "Review + create" && <Button variant="secondary" onClick={() => setTab(TABS[TABS.indexOf(tab) + 1])}>Next: {TABS[TABS.indexOf(tab) + 1]}</Button>}
      </div>
    </Blade>
  );
}
