/** Simulated Azure PowerShell (Az module). Cmdlets map onto the same simulator services as the CLI. */
import { AppError } from "@/lib/errors";
import { armId, deleteResource, findAnyByName, findByName, listResources, Props, Res } from "@/lib/sim/engine";
import { T } from "@/lib/sim/types";
import { createByType, runAction } from "@/lib/sim/registry";
import { REGIONS, VM_SIZES } from "@/lib/sim/catalog";
import { vmView } from "@/lib/sim/services/compute";
import { BUILTIN_ROLES } from "@/lib/sim/services/rbac";
import { splitTopLevel, tokenize } from "./parse";
import { CliError, CmdResult, Term } from "./types";

type Obj = Record<string, unknown>;
type Params = { named: Record<string, string>; switches: Set<string>; positional: string[] };

function parseParams(tokens: string[]): Params {
  const named: Record<string, string> = {};
  const switches = new Set<string>();
  const positional: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const tk = tokens[i];
    if (/^-[A-Za-z]/.test(tk)) {
      const name = tk.slice(1).replace(/:$/, "").toLowerCase();
      if (tk.endsWith(":") || (i + 1 < tokens.length && !/^-[A-Za-z]/.test(tokens[i + 1]))) named[name] = tokens[++i] ?? "";
      else switches.add(name);
    } else positional.push(tk);
  }
  return { named, switches, positional };
}

const req = (p: Params, name: string, pos?: number) => {
  const v = p.named[name.toLowerCase()] ?? (pos !== undefined ? p.positional[pos] : undefined);
  if (v === undefined || v === "") throw new CliError(`Cannot process command because of one or more missing mandatory parameters: ${name}.`);
  return v;
};
const opt = (p: Params, name: string) => p.named[name.toLowerCase()];

function psView(t: Term, r: Res, extra: Obj = {}): Obj {
  const base: Obj = { ResourceGroupName: r.resourceGroup, Name: r.name, Location: r.location, Id: armId(t.sub.subscriptionId, r), ProvisioningState: r.status, Tags: Object.entries(r.tags ?? {}).map(([k, v]) => `${k}=${v}`).join(";") };
  switch (r.type) {
    case T.RG: return { ResourceGroupName: r.name, Location: r.location, ProvisioningState: "Succeeded", Tags: base.Tags, ResourceId: base.Id };
    case T.VM: return { ...base, VmSize: r.properties.vmSize, OsType: r.properties.osType, PowerState: r.properties.powerState, ...extra };
    case T.STORAGE: return { StorageAccountName: r.name, ResourceGroupName: r.resourceGroup, PrimaryLocation: r.location, SkuName: r.properties.sku, Kind: r.properties.kind, AccessTier: r.properties.accessTier, ProvisioningState: "Succeeded" };
    case T.VNET: return { ...base, AddressSpace: (r.properties.addressSpace.addressPrefixes as string[]).join(","), Subnets: (r.properties.subnets as Props[]).map((s) => s.name).join(",") };
    case T.NSG: return { ...base, SecurityRules: (r.properties.securityRules as Props[]).map((s) => s.name).join(",") };
    case T.KEYVAULT: return { VaultName: r.name, ResourceGroupName: r.resourceGroup, Location: r.location, VaultUri: r.properties.vaultUri, EnableRbacAuthorization: r.properties.enableRbacAuthorization };
    case T.SITE: return { Name: r.name, State: r.properties.state, ResourceGroup: r.resourceGroup, DefaultHostName: r.properties.defaultHostName, Location: r.location };
    default: return base;
  }
}

async function rgExists(t: Term, name: string) {
  const g = await findByName(t.ctx, T.RG, name, name);
  if (!g) throw new CliError(`Provided resource group does not exist.`);
  return g;
}
async function vmBy(t: Term, p: Params) {
  const g = req(p, "ResourceGroupName");
  const n = req(p, "Name", 0);
  const vm = await findByName(t.ctx, T.VM, g, n);
  if (!vm) throw new CliError(`The Resource 'Microsoft.Compute/virtualMachines/${n}' under resource group '${g}' was not found.\nErrorCode: ResourceNotFound`);
  return vm;
}
const ok = (op: string): Obj => ({ OperationId: crypto.randomUUID(), Status: "Succeeded", StartTime: new Date().toISOString(), EndTime: new Date().toISOString(), Error: null, Name: op });

function secureString(raw: string | undefined) {
  if (!raw) return undefined;
  const m = /ConvertTo-SecureString\s+(?:-String\s+)?["']?([^"'\s]+)["']?/i.exec(raw);
  return m ? m[1] : raw;
}

const CMDLETS: Record<string, (t: Term, p: Params) => Promise<unknown>> = {
  "connect-azaccount": async (t) => { t.state.az = { ...t.state.az, loggedIn: true, identity: null }; return [{ Account: t.ctx.caller, SubscriptionName: t.sub.displayName, TenantId: "c0n70s0-0000-4000-8000-5im000000000", Environment: "AzureGigsSimulatedCloud" }]; },
  "disconnect-azaccount": async (t) => { t.state.az = { ...t.state.az, loggedIn: false, identity: null }; return undefined; },
  "get-azcontext": async (t) => ({ Name: `${t.sub.displayName} (${t.sub.subscriptionId})`, Account: t.ctx.caller, Environment: "AzureGigsSimulatedCloud", Subscription: t.sub.subscriptionId, Tenant: "c0n70s0-0000-4000-8000-5im000000000" }),
  "get-azsubscription": async (t) => [{ Name: t.sub.displayName, Id: t.sub.subscriptionId, State: t.sub.state }],
  "get-azlocation": async () => REGIONS.map((r) => ({ Location: r.name, DisplayName: r.displayName })),
  "get-azvmsize": async () => VM_SIZES.map((s) => ({ Name: s.name, NumberOfCores: s.vcpus, MemoryInMB: s.memoryGiB * 1024 })),
  "get-azresourcegroup": async (t, p) => {
    const n = opt(p, "name") ?? p.positional[0];
    const all = await listResources(t.ctx, { type: T.RG });
    if (n) { const g = all.find((x) => x.nameKey === n.toLowerCase()); if (!g) throw new CliError(`Get-AzResourceGroup : Provided resource group does not exist.`); return psView(t, g); }
    return all.map((g) => psView(t, g));
  },
  "new-azresourcegroup": async (t, p) => { const r = await createByType(t.ctx, T.RG, { name: req(p, "Name", 0), location: req(p, "Location", 1), tags: parseHashtable(opt(p, "tag")) }); t.changes.push(`Created resource group '${r.name}'`); return psView(t, r); },
  "remove-azresourcegroup": async (t, p) => { const g = await rgExists(t, req(p, "Name", 0)); if (!p.switches.has("force")) throw new CliError(`Confirm: Are you sure you want to remove resource group '${g.name}'? Interactive confirmation is not supported - re-run with -Force.`); await deleteResource(t.ctx, g, { cascade: true }); t.changes.push(`Deleted resource group '${g.name}'`); return true; },
  "get-azresource": async (t, p) => (await listResources(t.ctx, { resourceGroup: opt(p, "resourcegroupname") })).filter((r) => r.type !== T.RG && !r.type.startsWith("Microsoft.Entra") && r.type !== T.ROLE_ASSIGNMENT).map((r) => ({ Name: r.name, ResourceGroupName: r.resourceGroup, ResourceType: r.type, Location: r.location })),
  "get-azvm": async (t, p) => {
    const g = opt(p, "resourcegroupname");
    const n = opt(p, "name");
    let vms = await listResources(t.ctx, { type: T.VM, resourceGroup: g });
    if (n) vms = vms.filter((v) => v.nameKey === n.toLowerCase());
    if (n && !vms.length) throw new CliError(`The Resource 'Microsoft.Compute/virtualMachines/${n}' was not found.`);
    const out: Obj[] = [];
    for (const v of vms) { const nv = await vmView(t.ctx, v); out.push(psView(t, v, p.switches.has("status") ? { PowerState: v.properties.powerState, PrivateIp: nv.privateIp, PublicIp: nv.publicIp } : {})); }
    return n ? out[0] : out;
  },
  "new-azvm": async (t, p) => {
    if (opt(p, "credential")) throw new CliError("Get-Credential prompts are not available in the web terminal. Use -AdminUsername and -AdminPassword (simulator parameters) instead.");
    const r = await createByType(t.ctx, T.VM, { resourceGroup: req(p, "ResourceGroupName"), name: req(p, "Name"), location: opt(p, "location"), image: opt(p, "image") ?? "Ubuntu2204", size: opt(p, "size") ?? "Standard_B1s", adminUsername: opt(p, "adminusername") ?? "azureuser", adminPassword: secureString(opt(p, "adminpassword")), authenticationType: opt(p, "adminpassword") ? "password" : undefined, generateSshKeys: true, vnetName: opt(p, "virtualnetworkname"), subnetName: opt(p, "subnetname"), nsgName: opt(p, "securitygroupname"), publicIp: opt(p, "publicipaddressname") !== "" , createNsg: !opt(p, "securitygroupname") });
    t.changes.push(`Created virtual machine '${r.name}'`);
    return psView(t, r);
  },
  "start-azvm": async (t, p) => { const vm = await vmBy(t, p); await runAction(t.ctx, vm, "start", {}); t.changes.push(`Started VM '${vm.name}'`); return ok("Start"); },
  "stop-azvm": async (t, p) => { const vm = await vmBy(t, p); if (!p.switches.has("force")) throw new CliError("Virtual machine stop operation: Interactive confirmation is not supported - re-run with -Force."); await runAction(t.ctx, vm, p.switches.has("stayprovisioned") ? "stop" : "deallocate", {}); t.changes.push(`Stopped VM '${vm.name}'`); return ok("Stop"); },
  "restart-azvm": async (t, p) => { const vm = await vmBy(t, p); await runAction(t.ctx, vm, "restart", {}); t.changes.push(`Restarted VM '${vm.name}'`); return ok("Restart"); },
  "remove-azvm": async (t, p) => { const vm = await vmBy(t, p); if (!p.switches.has("force")) throw new CliError("Interactive confirmation is not supported - re-run with -Force."); await deleteResource(t.ctx, vm); t.changes.push(`Deleted VM '${vm.name}'`); return ok("Delete"); },
  "invoke-azvmruncommand": async (t, p) => { const vm = await vmBy(t, { ...p, named: { ...p.named, name: p.named.vmname ?? p.named.name } }); const r = (await runAction(t.ctx, vm, "runCommand", { script: req(p, "ScriptString") })) as Props; return { Value: [{ Code: "ComponentStatus/StdOut/succeeded", Message: r.output }] }; },
  "get-azstorageaccount": async (t, p) => (await listResources(t.ctx, { type: T.STORAGE, resourceGroup: opt(p, "resourcegroupname") })).filter((s) => !opt(p, "name") || s.nameKey === opt(p, "name")!.toLowerCase()).map((s) => psView(t, s)),
  "new-azstorageaccount": async (t, p) => { const r = await createByType(t.ctx, T.STORAGE, { resourceGroup: req(p, "ResourceGroupName"), name: req(p, "Name"), location: opt(p, "location"), sku: opt(p, "skuname") ?? "Standard_LRS", kind: opt(p, "kind") ?? "StorageV2", accessTier: opt(p, "accesstier") ?? "Hot", allowBlobPublicAccess: opt(p, "allowblobpublicaccess") === "$true" }); t.changes.push(`Created storage account '${r.name}'`); return psView(t, r); },
  "get-azvirtualnetwork": async (t, p) => (await listResources(t.ctx, { type: T.VNET, resourceGroup: opt(p, "resourcegroupname") })).filter((s) => !opt(p, "name") || s.nameKey === opt(p, "name")!.toLowerCase()).map((s) => psView(t, s)),
  "new-azvirtualnetwork": async (t, p) => { const r = await createByType(t.ctx, T.VNET, { resourceGroup: req(p, "ResourceGroupName"), name: req(p, "Name"), location: opt(p, "location"), addressPrefixes: req(p, "AddressPrefix").split(",") }); t.changes.push(`Created virtual network '${r.name}'`); return psView(t, r); },
  "add-azvirtualnetworksubnetconfig": async (t, p) => { const v = await findByName(t.ctx, T.VNET, req(p, "ResourceGroupName"), req(p, "VirtualNetworkName")); if (!v) throw new CliError("Virtual network not found."); const r = (await runAction(t.ctx, v, "addSubnet", { name: req(p, "Name"), addressPrefix: req(p, "AddressPrefix") })) as Res; t.changes.push(`Added subnet '${req(p, "Name")}'`); return psView(t, r); },
  "get-aznetworksecuritygroup": async (t, p) => (await listResources(t.ctx, { type: T.NSG, resourceGroup: opt(p, "resourcegroupname") })).filter((s) => !opt(p, "name") || s.nameKey === opt(p, "name")!.toLowerCase()).map((s) => psView(t, s)),
  "new-aznetworksecuritygroup": async (t, p) => { const r = await createByType(t.ctx, T.NSG, { resourceGroup: req(p, "ResourceGroupName"), name: req(p, "Name"), location: opt(p, "location") }); t.changes.push(`Created NSG '${r.name}'`); return psView(t, r); },
  "get-aznetworksecurityruleconfig": async (t, p) => { const nsg = await nsgBy(t, p); return (nsg.properties.securityRules as Props[]).map((r) => ({ Name: r.name, Priority: r.priority, Direction: r.direction, Access: r.access, Protocol: r.protocol, SourceAddressPrefix: r.sourceAddressPrefix, DestinationPortRange: r.destinationPortRange })); },
  "add-aznetworksecurityruleconfig": async (t, p) => { const nsg = await nsgBy(t, p); await runAction(t.ctx, nsg, "addRule", { name: req(p, "Name"), priority: req(p, "Priority"), direction: opt(p, "direction") ?? "Inbound", access: opt(p, "access") ?? "Allow", protocol: opt(p, "protocol") ?? "Tcp", sourceAddressPrefix: opt(p, "sourceaddressprefix") ?? "*", sourcePortRange: opt(p, "sourceportrange") ?? "*", destinationAddressPrefix: opt(p, "destinationaddressprefix") ?? "*", destinationPortRange: req(p, "DestinationPortRange") }); t.changes.push(`Added rule '${req(p, "Name")}' to NSG '${nsg.name}'`); return { Name: req(p, "Name"), ProvisioningState: "Succeeded" }; },
  "remove-aznetworksecurityruleconfig": async (t, p) => { const nsg = await nsgBy(t, p); await runAction(t.ctx, nsg, "deleteRule", { name: req(p, "Name") }); t.changes.push(`Removed rule '${req(p, "Name")}'`); return true; },
  "get-azroleassignment": async (t, p) => (await listResources(t.ctx, { type: T.ROLE_ASSIGNMENT })).filter((a) => !opt(p, "signinname") || a.properties.principalName.toLowerCase() === opt(p, "signinname")!.toLowerCase()).map((a) => ({ RoleAssignmentName: a.name, DisplayName: a.properties.principalName, RoleDefinitionName: a.properties.roleDefinitionName, Scope: a.properties.displayScope, ObjectType: a.properties.principalType })),
  "new-azroleassignment": async (t, p) => { const r = await createByType(t.ctx, T.ROLE_ASSIGNMENT, { principal: opt(p, "signinname") ?? opt(p, "objectid") ?? req(p, "SignInName"), role: req(p, "RoleDefinitionName"), scope: opt(p, "scope") ?? (opt(p, "resourcegroupname") ? `/resourceGroups/${opt(p, "resourcegroupname")}` : "/") }); t.changes.push(`Assigned '${r.properties.roleDefinitionName}'`); return { RoleAssignmentName: r.name, RoleDefinitionName: r.properties.roleDefinitionName, Scope: r.properties.displayScope, DisplayName: r.properties.principalName }; },
  "get-azroledefinition": async (_t, p) => BUILTIN_ROLES.filter((r) => !opt(p, "name") && !p.positional[0] || r.name.toLowerCase() === (opt(p, "name") ?? p.positional[0]).toLowerCase()).map((r) => ({ Name: r.name, Description: r.description, Actions: r.actions.join(", "), IsCustom: false })),
  "get-azaduser": async (t, p) => (await listResources(t.ctx, { type: T.ENTRA_USER })).filter((u) => !opt(p, "userprincipalname") || u.nameKey === opt(p, "userprincipalname")!.toLowerCase()).map((u) => ({ DisplayName: u.properties.displayName, UserPrincipalName: u.name, Id: u.properties.objectId, AccountEnabled: u.properties.accountEnabled })),
  "get-azadgroup": async (t) => (await listResources(t.ctx, { type: T.ENTRA_GROUP })).map((g) => ({ DisplayName: g.name, Id: g.properties.objectId, SecurityEnabled: true })),
  "get-azkeyvault": async (t, p) => (await listResources(t.ctx, { type: T.KEYVAULT, resourceGroup: opt(p, "resourcegroupname") })).filter((s) => !opt(p, "vaultname") || s.nameKey === opt(p, "vaultname")!.toLowerCase()).map((s) => psView(t, s)),
  "get-azkeyvaultsecret": async (t, p) => {
    const kv = await findAnyByName(t.ctx, T.KEYVAULT, req(p, "VaultName"));
    if (!kv) throw new CliError("Vault not found.");
    const n = opt(p, "name");
    if (!n) return (kv.properties.secrets as Props[]).map((s) => ({ VaultName: kv.name, Name: s.name, Version: s.versions[0]?.version, Enabled: s.versions[0]?.enabled, Expires: s.versions[0]?.expires }));
    const r = (await runAction(t.ctx, kv, "getSecret", { name: n })) as Props;
    return { VaultName: kv.name, Name: r.name, Version: r.version, SecretValue: "System.Security.SecureString", ...(p.switches.has("asplaintext") ? { SecretValueText: r.value } : {}) };
  },
  "set-azkeyvaultsecret": async (t, p) => {
    const kv = await findAnyByName(t.ctx, T.KEYVAULT, req(p, "VaultName"));
    if (!kv) throw new CliError("Vault not found.");
    const value = secureString(req(p, "SecretValue"));
    await runAction(t.ctx, kv, "setSecret", { name: req(p, "Name"), value, expires: opt(p, "expires") });
    t.changes.push(`Set secret '${req(p, "Name")}'`);
    return { VaultName: kv.name, Name: req(p, "Name"), Enabled: true };
  },
  "get-azwebapp": async (t, p) => (await listResources(t.ctx, { type: T.SITE, resourceGroup: opt(p, "resourcegroupname") })).filter((s) => !opt(p, "name") || s.nameKey === opt(p, "name")!.toLowerCase()).map((s) => psView(t, s)),
  "restart-azwebapp": async (t, p) => { const s = await findByName(t.ctx, T.SITE, req(p, "ResourceGroupName"), req(p, "Name")); if (!s) throw new CliError("Web app not found."); await runAction(t.ctx, s, "restart", {}); t.changes.push(`Restarted web app '${s.name}'`); return psView(t, s); },
  "stop-azwebapp": async (t, p) => { const s = await findByName(t.ctx, T.SITE, req(p, "ResourceGroupName"), req(p, "Name")); if (!s) throw new CliError("Web app not found."); await runAction(t.ctx, s, "stop", {}); t.changes.push(`Stopped web app '${s.name}'`); return psView(t, s); },
  "start-azwebapp": async (t, p) => { const s = await findByName(t.ctx, T.SITE, req(p, "ResourceGroupName"), req(p, "Name")); if (!s) throw new CliError("Web app not found."); await runAction(t.ctx, s, "start", {}); t.changes.push(`Started web app '${s.name}'`); return psView(t, s); },
  "get-command": async () => Object.keys(CMDLETS).map((c) => ({ CommandType: "Cmdlet", Name: c.split("-").map((x) => x.replace(/^az/, "Az").replace(/^./, (y) => y.toUpperCase())).join("-"), Source: "Az (simulated)" })),
  "get-help": async (_t, p) => `NAME\n    ${p.positional[0] ?? "Get-Help"}\n\nThe Azure Gigs PowerShell simulator supports the Az cmdlets listed by Get-Command.\nPipelines support: Where-Object, Select-Object, Sort-Object, Format-Table, Format-List, Measure-Object, ConvertTo-Json.`,
  "write-output": async (_t, p) => p.positional.join(" "),
  "write-host": async (_t, p) => p.positional.join(" "),
  "get-date": async () => new Date().toString(),
};

async function nsgBy(t: Term, p: Params) {
  const n = opt(p, "networksecuritygroupname") ?? req(p, "NetworkSecurityGroupName");
  const nsg = opt(p, "resourcegroupname") ? await findByName(t.ctx, T.NSG, opt(p, "resourcegroupname")!, n) : await findAnyByName(t.ctx, T.NSG, n);
  if (!nsg) throw new CliError(`Network security group '${n}' not found. (Simulator: pass -NetworkSecurityGroupName instead of piping the NSG object.)`);
  return nsg;
}

function parseHashtable(raw?: string): Record<string, string> {
  if (!raw) return {};
  const m = /^@\{(.*)\}$/.exec(raw.trim());
  if (!m) return {};
  return Object.fromEntries(m[1].split(";").map((kv) => kv.split("=").map((s) => s.trim().replace(/^["']|["']$/g, ""))).filter((x) => x.length === 2 && x[0]));
}

function toArray(v: unknown): Obj[] {
  if (v === undefined || v === null) return [];
  return (Array.isArray(v) ? v : [v]).map((x) => (x && typeof x === "object" ? (x as Obj) : { Value: x }));
}

function fmtList(rows: Obj[]) {
  return rows.map((r) => { const w = Math.max(...Object.keys(r).map((k) => k.length)); return Object.entries(r).map(([k, v]) => `${k.padEnd(w)} : ${v ?? ""}`).join("\n"); }).join("\n\n");
}
function fmtTable(rows: Obj[]) {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const w = cols.map((c) => Math.min(48, Math.max(c.length, ...rows.map((r) => String(r[c] ?? "").length))));
  const line = (vals: string[]) => vals.map((v, i) => v.slice(0, w[i]).padEnd(w[i])).join(" ").trimEnd();
  return [line(cols), line(w.map((n) => "-".repeat(n))), ...rows.map((r) => line(cols.map((c) => String(r[c] ?? ""))))].join("\n");
}

function whereFilter(rows: Obj[], expr: string): Obj[] {
  const m = /^\{?\s*\$_\.(\w+)\s+-(eq|ne|like|notlike|gt|lt|match)\s+["']?([^"'}]*)["']?\s*\}?$/i.exec(expr.trim());
  if (!m) throw new CliError(`Where-Object: unsupported filter '${expr}'. Use { $_.Property -eq 'value' } (-eq, -ne, -like, -notlike, -gt, -lt, -match).`);
  const [, prop, op, val] = m;
  return rows.filter((r) => {
    const key = Object.keys(r).find((k) => k.toLowerCase() === prop.toLowerCase());
    const v = String(key ? r[key] ?? "" : "");
    const re = new RegExp("^" + val.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$", "i");
    switch (op.toLowerCase()) {
      case "eq": return v.toLowerCase() === val.toLowerCase();
      case "ne": return v.toLowerCase() !== val.toLowerCase();
      case "like": return re.test(v);
      case "notlike": return !re.test(v);
      case "gt": return Number(v) > Number(val);
      case "lt": return Number(v) < Number(val);
      case "match": return new RegExp(val, "i").test(v);
    }
    return false;
  });
}

export async function runPwsh(t: Term, line: string): Promise<CmdResult> {
  const { parts } = splitTopLevel(line, ["|"]);
  const [first, ...pipeline] = parts;
  try {
    const tokens = tokenize(first.replace(/\(ConvertTo-SecureString[^)]*\)/gi, (m) => JSON.stringify(m.slice(1, -1))));
    const name = (tokens[0] ?? "").toLowerCase();
    const alias: Record<string, string> = { ls: "get-azresource", echo: "write-output", gcm: "get-command", help: "get-help" };
    const cmd = CMDLETS[alias[name] ?? name];
    if (!cmd) return { stdout: "", stderr: `${tokens[0]} : The term '${tokens[0]}' is not recognized as a name of a cmdlet, function, script file, or executable program.\nCheck the spelling of the name, or if a path was included, verify that the path is correct and try again. (Run Get-Command for supported cmdlets.)`, exitCode: 1 };
    if (!["connect-azaccount", "get-command", "get-help", "write-output", "write-host", "get-date"].includes(alias[name] ?? name) && !t.state.az.loggedIn) return { stdout: "", stderr: `${tokens[0]}: Run Connect-AzAccount to login.`, exitCode: 1 };
    let data: unknown = await cmd(t, parseParams(tokens.slice(1)));
    let format: "list" | "table" | "json" | null = null;
    for (const stage of pipeline) {
      const [c, ...rest] = tokenize(stage.replace(/\{[^}]*\}/, (m) => JSON.stringify(m)));
      const lc = c.toLowerCase();
      let rows = toArray(data);
      if (["where-object", "where", "?"].includes(lc)) data = whereFilter(rows, rest.join(" "));
      else if (["select-object", "select"].includes(lc)) {
        const pp = parseParams(rest);
        const first = pp.named.first ? Number(pp.named.first) : undefined;
        const props = (pp.named.property ?? pp.positional.join(" ")).split(/\s*,\s*|\s+/).filter(Boolean);
        if (props.length) rows = rows.map((r) => Object.fromEntries(props.map((pr) => { const k = Object.keys(r).find((x) => x.toLowerCase() === pr.toLowerCase()); return [k ?? pr, k ? r[k] : null]; })));
        data = first !== undefined ? rows.slice(0, first) : rows;
      } else if (["sort-object", "sort"].includes(lc)) {
        const pp = parseParams(rest);
        const prop = pp.named.property ?? pp.positional[0];
        data = [...rows].sort((a, b) => String(a[prop] ?? "").localeCompare(String(b[prop] ?? ""), undefined, { numeric: true }) * (pp.switches.has("descending") ? -1 : 1));
      } else if (["format-table", "ft"].includes(lc)) {
        const props = rest.filter((r) => !r.startsWith("-")).join(" ").split(/\s*,\s*|\s+/).filter(Boolean);
        if (props.length) data = rows.map((r) => Object.fromEntries(props.map((pr) => { const k = Object.keys(r).find((x) => x.toLowerCase() === pr.toLowerCase()); return [k ?? pr, k ? r[k] : null]; })));
        format = "table";
      } else if (["format-list", "fl"].includes(lc)) format = "list";
      else if (lc === "measure-object" || lc === "measure") data = { Count: rows.length };
      else if (lc === "convertto-json") format = "json";
      else return { stdout: "", stderr: `${c} : pipeline cmdlet not supported by the simulator. Supported: Where-Object, Select-Object, Sort-Object, Format-Table, Format-List, Measure-Object, ConvertTo-Json.`, exitCode: 1 };
    }
    if (data === undefined) return { stdout: "" };
    if (typeof data === "string" || typeof data === "boolean" || typeof data === "number") return { stdout: String(data === true ? "True" : data === false ? "False" : data) };
    const rows = toArray(data);
    if (format === "json") return { stdout: JSON.stringify(Array.isArray(data) ? rows : rows[0], null, 2) };
    if (format === "table" || (!format && rows.length > 1 && Object.keys(rows[0]).length <= 6)) return { stdout: fmtTable(rows) };
    return { stdout: fmtList(rows) };
  } catch (e) {
    if (e instanceof CliError) return { stdout: "", stderr: e.message, exitCode: 1 };
    if (e instanceof AppError) return { stdout: "", stderr: `${e.message}\nErrorCode: ${e.code}\nStatusCode: ${e.status}`, exitCode: 1 };
    if (e && typeof e === "object" && "issues" in e) return { stdout: "", stderr: `Cannot validate argument: ${(e as { issues: { path: string[]; message: string }[] }).issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`, exitCode: 1 };
    throw e;
  }
}
