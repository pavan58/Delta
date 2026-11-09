/** Simulated Azure CLI. Every command operates on the learner's persistent simulator state. */
import { createHash } from "node:crypto";
import { AppError } from "@/lib/errors";
import { Ctx, deleteResource, findAnyByName, findByName, getById, getByName, listResources, Props, Res, armId } from "@/lib/sim/engine";
import { T, TYPE_LABELS } from "@/lib/sim/types";
import { createByType, runAction, resourceDetail, sanitize } from "@/lib/sim/registry";
import { REGIONS, VM_IMAGES, VM_SIZES } from "@/lib/sim/catalog";
import { checkAccess, BUILTIN_ROLES, normalizeScope, TENANT_DOMAIN } from "@/lib/sim/services/rbac";
import { vmView } from "@/lib/sim/services/compute";
import { downloadBlob } from "@/lib/sim/services/storage";
import { metricSeries, evaluateAlerts, METRICS } from "@/lib/sim/services/monitor";
import { runKql } from "@/lib/sim/kql";
import { buildTables } from "@/lib/sim/kqlData";
import { boolFlag, flag, flagList, flagReq, optBool, parseArgs, parseTags, Parsed } from "./parse";
import { render } from "./format";
import { CliError, CmdResult, Term } from "./types";
import { readFile, resolvePath, writeFile } from "./vfs";

const ALIASES: Record<string, string> = { g: "resource-group", n: "name", l: "location", o: "output", h: "help", y: "yes" };
/** Command-specific short flags (longest matching prefix wins). */
const CMD_ALIASES: [string, Record<string, string>][] = [
  ["account set", { s: "subscription" }],
  ["acr build", { r: "registry", t: "image", f: "file" }],
  ["webapp create", { p: "plan" }],
  ["sql server create", { u: "admin-user", p: "admin-password" }],
  ["sql server firewall-rule", { s: "server" }],
  ["sql db", { s: "server" }],
  ["storage blob", { c: "container-name", f: "file" }],
  ["monitor log-analytics query", { w: "workspace" }],
];

type Handler = (t: Term, p: Parsed) => Promise<unknown>;

const rg = (p: Parsed) => flagReq(p, "resource-group", "-g");
const nm = (p: Parsed) => flagReq(p, "name", "-n");

/** When signed in as a directory user, enforce RBAC like ARM would. */
async function authz(t: Term, type: string, verb: "read" | "write" | "delete" | string, resourceGroup?: string, name?: string) {
  const who = t.state.az.identity;
  if (!who) return;
  const action = ["read", "write", "delete"].includes(verb) ? `${type === T.FUNCTION_APP ? T.SITE : type}/${verb}` : `${type}/${verb}/action`;
  const scope = !resourceGroup ? "/" : name ? `/resourceGroups/${resourceGroup}/providers/${type}/${name}` : `/resourceGroups/${resourceGroup}`;
  const r = await checkAccess(t.ctx, who, action, scope);
  if (!r.allowed) {
    throw new CliError(`(AuthorizationFailed) The client '${who}' with object id '${who}' does not have authorization to perform action '${action}' over scope '/subscriptions/${t.sub.subscriptionId}${normalizeScope(scope) === "/" ? "" : scope}' or the scope is invalid. If access was recently granted, please refresh your credentials.\nCode: AuthorizationFailed`);
  }
}

function view(t: Term, r: Res, extra: Props = {}): Props {
  const base: Props = { id: armId(t.sub.subscriptionId, r), name: r.name, type: r.type === T.FUNCTION_APP ? T.SITE : r.type, location: r.location, resourceGroup: r.resourceGroup, tags: r.tags ?? {}, provisioningState: r.status };
  const p = sanitize(r).properties;
  switch (r.type) {
    case T.RG: return { id: base.id, location: r.location, managedBy: null, name: r.name, properties: { provisioningState: "Succeeded" }, tags: r.tags, type: r.type };
    case T.VM: return { ...base, vmId: p.vmId, hardwareProfile: { vmSize: p.vmSize }, storageProfile: { imageReference: { urn: p.image.urn }, osDisk: { osType: p.osType, name: `${r.name}_OsDisk_1` } }, osProfile: { computerName: p.computerName, adminUsername: p.adminUsername, linuxConfiguration: p.osType === "Linux" ? { disablePasswordAuthentication: p.authenticationType === "ssh" } : null }, networkProfile: { networkInterfaces: [{ id: p.nicId }] }, ...extra };
    case T.VNET: return { ...base, addressSpace: p.addressSpace, subnets: p.subnets.map((s: Props) => ({ name: s.name, addressPrefix: s.addressPrefix, networkSecurityGroup: s.nsgName ? { name: s.nsgName } : null })), virtualNetworkPeerings: p.peerings, dhcpOptions: { dnsServers: p.dnsServers } };
    case T.NSG: return { ...base, securityRules: p.securityRules };
    case T.STORAGE: return { ...base, sku: { name: p.sku, tier: p.performance }, kind: p.kind, accessTier: p.accessTier, allowBlobPublicAccess: p.allowBlobPublicAccess, minimumTlsVersion: p.minimumTlsVersion, enableHttpsTrafficOnly: p.supportsHttpsTrafficOnly, networkRuleSet: p.networkRules, primaryEndpoints: p.primaryEndpoints };
    case T.ENTRA_USER: return { id: p.objectId, displayName: p.displayName, userPrincipalName: p.userPrincipalName, accountEnabled: p.accountEnabled, department: p.department, jobTitle: p.jobTitle };
    case T.ENTRA_GROUP: return { id: p.objectId, displayName: p.displayName, description: p.description, securityEnabled: p.groupType === "Security" };
    case T.ROLE_ASSIGNMENT: return { id: base.id, name: r.name, principalId: p.principalId, principalName: p.principalName, principalType: p.principalType, roleDefinitionName: p.roleDefinitionName, scope: p.displayScope };
    case T.KEYVAULT: return { ...base, properties: { vaultUri: p.vaultUri, enableRbacAuthorization: p.enableRbacAuthorization, enableSoftDelete: true, softDeleteRetentionInDays: p.softDeleteRetentionDays, accessPolicies: p.accessPolicies, sku: { name: p.sku } } };
    case T.SITE: case T.FUNCTION_APP: return { ...base, kind: p.kind, state: p.state, defaultHostName: p.defaultHostName, httpsOnly: p.httpsOnly, siteConfig: { linuxFxVersion: p.runtime }, identity: p.identity };
    case T.SQL_SERVER: return { ...base, administratorLogin: p.administratorLogin, fullyQualifiedDomainName: p.fullyQualifiedDomainName, publicNetworkAccess: p.publicNetworkAccess, version: p.version };
    case T.SQL_DB: return { ...base, name: p.databaseName, sku: { name: p.sku }, maxSizeBytes: p.maxSizeGB * 1024 ** 3, status: "Online", collation: p.collation };
    case T.AKS: return { ...base, kubernetesVersion: p.kubernetesVersion, fqdn: p.fqdn, powerState: { code: p.powerState }, agentPoolProfiles: [{ name: "nodepool1", count: p.nodeCount, vmSize: p.nodeVmSize }] };
    case T.ACR: return { ...base, loginServer: p.loginServer, sku: { name: p.sku }, adminUserEnabled: p.adminUserEnabled };
    case T.ACI: return { ...base, containers: [{ name: r.name, image: p.image, resources: { requests: { cpu: p.cpu, memoryInGB: p.memoryGB } } }], ipAddress: { ip: p.ipAddress, ports: p.ports.map((x: number) => ({ port: x })), fqdn: p.fqdn }, instanceView: { state: p.state } };
    default: return { ...base, properties: p };
  }
}

function requireLogin(t: Term) {
  if (!t.state.az.loggedIn) throw new CliError("Please run 'az login' to setup account.");
}

async function rgName(t: Term, p: Parsed) {
  const name = rg(p);
  const g = await findByName(t.ctx, T.RG, name, name);
  if (!g) throw new CliError(`(ResourceGroupNotFound) Resource group '${name}' could not be found.\nCode: ResourceGroupNotFound`, 3);
  return g.name;
}

async function getRes(t: Term, type: string, p: Parsed, nameFlag = "name") {
  const group = await rgName(t, p);
  const name = flagReq(p, nameFlag);
  await authz(t, type, "read", group, name);
  const r = await findByName(t.ctx, type, group, name);
  if (!r) throw new CliError(`(ResourceNotFound) The Resource '${type}/${name}' under resource group '${group}' was not found.\nCode: ResourceNotFound`, 3);
  return r;
}

async function list(t: Term, type: string | string[], p: Parsed) {
  const group = flag(p, "resource-group");
  if (group) await rgName(t, p);
  await authz(t, Array.isArray(type) ? type[0] : type, "read", group);
  return listResources(t.ctx, { type, resourceGroup: group });
}

async function create(t: Term, type: string, input: Props) {
  await authz(t, type, "write", input.resourceGroup, input.name);
  const r = await createByType(t.ctx, type, input);
  t.changes.push(`Created ${TYPE_LABELS[type] ?? type} '${r.name}'`);
  return r;
}

async function act(t: Term, r: Res, action: string, payload: Props = {}, verb = "write") {
  await authz(t, r.type, verb === "write" ? "write" : action, r.resourceGroup, r.name);
  const out = await runAction(t.ctx, r, action, payload);
  t.changes.push(`${action} on ${TYPE_LABELS[r.type] ?? r.type} '${r.name}'`);
  return out;
}

async function del(t: Term, r: Res, p: Parsed) {
  await authz(t, r.type, "delete", r.resourceGroup, r.name);
  const deleted = await deleteResource(t.ctx, r, { cascade: r.type === T.RG });
  t.changes.push(`Deleted ${deleted.join(", ")}`);
  void p;
  return undefined;
}

function needYes(p: Parsed, what: string) {
  if (!boolFlag(p, "yes")) throw new CliError(`Are you sure you want to perform this operation? (y/n): \nInteractive prompts are not supported in this terminal. Re-run with --yes to confirm deletion of ${what}.`);
}

const fakeKey = (seed: string) => createHash("sha256").update(seed).digest("base64").slice(0, 43) + "==";

const COMMANDS: Record<string, Handler> = {
  // ---------- account ----------
  "login": async (t, p) => {
    const user = flag(p, "username") ?? flag(p, "u");
    if (user) {
      const upn = user.includes("@") ? user : `${user}@${TENANT_DOMAIN}`;
      const principal = await findAnyByName(t.ctx, T.ENTRA_USER, upn);
      if (!principal) throw new CliError(`AADSTS50034: The user account ${upn} does not exist in the Contoso directory.`);
      if (!principal.properties.accountEnabled) throw new CliError("AADSTS50057: The user account is disabled.");
      t.state.az = { ...t.state.az, loggedIn: true, identity: principal.name };
    } else t.state.az = { ...t.state.az, loggedIn: true, identity: null };
    const who = t.state.az.identity ?? t.ctx.caller;
    return [{ cloudName: "AzureGigsSimulatedCloud", id: t.sub.subscriptionId, isDefault: true, name: t.sub.displayName, state: "Enabled", tenantId: "c0n70s0-0000-4000-8000-5im000000000", user: { name: who, type: "user" } }];
  },
  "logout": async (t) => {
    t.state.az = { ...t.state.az, loggedIn: false, identity: null };
    return undefined;
  },
  "account show": async (t) => ({ environmentName: "AzureGigsSimulatedCloud", id: t.sub.subscriptionId, isDefault: true, name: t.sub.displayName, state: t.sub.state, tenantId: "c0n70s0-0000-4000-8000-5im000000000", user: { name: t.state.az.identity ?? t.ctx.caller, type: "user" } }),
  "account list": async (t) => [{ id: t.sub.subscriptionId, name: t.sub.displayName, state: t.sub.state, isDefault: true }],
  "account set": async (t, p) => {
    const s = flagReq(p, "subscription", "-s");
    if (s !== t.sub.subscriptionId && s.toLowerCase() !== t.sub.displayName.toLowerCase()) throw new CliError(`The subscription of '${s}' doesn't exist in cloud 'AzureGigsSimulatedCloud'.`);
    return undefined;
  },
  "account list-locations": async () => REGIONS.map((r) => ({ name: r.name, displayName: r.displayName, regionalDisplayName: r.displayName })),
  "version": async () => ({ "azure-cli": "2.67.0 (Azure Gigs simulator)", "azure-cli-core": "2.67.0", extensions: {} }),

  // ---------- resource groups ----------
  "group create": async (t, p) => view(t, await create(t, T.RG, { name: nm(p), location: flagReq(p, "location", "-l"), tags: parseTags(flagList(p, "tags")) })),
  "group list": async (t) => (await listResources(t.ctx, { type: T.RG })).map((r) => view(t, r)),
  "group show": async (t, p) => view(t, await getByName(t.ctx, T.RG, nm(p), nm(p)).catch(() => { throw new CliError(`(ResourceGroupNotFound) Resource group '${nm(p)}' could not be found.`, 3); })),
  "group exists": async (t, p) => !!(await findByName(t.ctx, T.RG, nm(p), nm(p))),
  "group delete": async (t, p) => {
    const g = await findByName(t.ctx, T.RG, nm(p), nm(p));
    if (!g) throw new CliError(`(ResourceGroupNotFound) Resource group '${nm(p)}' could not be found.`, 3);
    needYes(p, `resource group '${g.name}' and ALL resources in it`);
    return del(t, g, p);
  },
  "group update": async (t, p) => {
    const g = await getByName(t.ctx, T.RG, nm(p), nm(p));
    const { updateResource } = await import("@/lib/sim/engine");
    const tagArgs = flagList(p, "set").filter((x) => x.startsWith("tags.")).map((x) => x.slice(5));
    const tags = { ...g.tags, ...parseTags(flagList(p, "tags")), ...parseTags(tagArgs) };
    t.changes.push(`Updated tags on '${g.name}'`);
    return view(t, await updateResource(t.ctx, g, { tags }, "Update Resource Group", { tags }));
  },
  "resource list": async (t, p) => (await listResources(t.ctx, { resourceGroup: flag(p, "resource-group") })).filter((r) => ![T.RG, T.ENTRA_USER, T.ENTRA_GROUP, T.ENTRA_SP, T.ROLE_ASSIGNMENT].includes(r.type as never)).map((r) => ({ name: r.name, resourceGroup: r.resourceGroup, location: r.location, type: r.type === T.FUNCTION_APP ? T.SITE : r.type, id: armId(t.sub.subscriptionId, r) })),
  "tag list": async (t) => { const counts: Record<string, number> = {}; for (const r of await listResources(t.ctx)) for (const k of Object.keys(r.tags ?? {})) counts[k] = (counts[k] ?? 0) + 1; return Object.entries(counts).map(([tagName, count]) => ({ tagName, count })); },

  // ---------- compute ----------
  "vm create": async (t, p) => {
    const image = flagReq(p, "image");
    const auth = flag(p, "authentication-type");
    const vm = await create(t, T.VM, {
      resourceGroup: await rgName(t, p), name: nm(p), location: flag(p, "location"), image, size: flag(p, "size") ?? "Standard_DS1_v2".replace("DS1_v2", "B1s"),
      adminUsername: flag(p, "admin-username") ?? "azureuser", adminPassword: flag(p, "admin-password"), authenticationType: auth === "all" ? "password" : auth,
      sshPublicKey: flag(p, "ssh-key-values"), generateSshKeys: boolFlag(p, "generate-ssh-keys") || !flag(p, "ssh-key-values"),
      vnetName: flag(p, "vnet-name"), subnetName: flag(p, "subnet"), publicIp: flag(p, "public-ip-address") !== "", nsgName: flag(p, "nsg") === "" ? null : flag(p, "nsg"),
      createNsg: flag(p, "nsg") === undefined ? true : false, nsgRule: (flag(p, "nsg-rule") as "SSH" | "RDP" | "NONE" | undefined), osDiskSizeGB: flag(p, "os-disk-size-gb"), osDiskType: flag(p, "storage-sku"),
      dataDisks: flagList(p, "data-disk-sizes-gb").map((s) => ({ sizeGB: Number(s) })), installWebServer: !!flag(p, "custom-data")?.includes("nginx"), tags: parseTags(flagList(p, "tags")), zone: flag(p, "zone"),
    });
    const v = await vmView(t.ctx, vm);
    return { fqdns: "", id: armId(t.sub.subscriptionId, vm), location: vm.location, macAddress: "00-0D-3A-" + vm.id.slice(-6).toUpperCase().match(/../g)!.join("-"), powerState: vm.properties.powerState, privateIpAddress: v.privateIp, publicIpAddress: v.publicIp ?? "", resourceGroup: vm.resourceGroup, zones: vm.properties.zone ?? "" };
  },
  "vm list": async (t, p) => {
    const vms = await list(t, T.VM, p);
    const out: Props[] = [];
    for (const vm of vms) {
      if (boolFlag(p, "show-details") || boolFlag(p, "d")) {
        const v = await vmView(t.ctx, vm);
        out.push({ ...view(t, vm), powerState: vm.properties.powerState, privateIps: v.privateIp, publicIps: v.publicIp ?? "", fqdns: "" });
      } else out.push(view(t, vm));
    }
    return out;
  },
  "vm show": async (t, p) => {
    const vm = await getRes(t, T.VM, p);
    if (boolFlag(p, "show-details") || boolFlag(p, "d")) {
      const v = await vmView(t.ctx, vm);
      return { ...view(t, vm), powerState: vm.properties.powerState, privateIps: v.privateIp, publicIps: v.publicIp ?? "" };
    }
    return view(t, vm);
  },
  "vm get-instance-view": async (t, p) => {
    const vm = await getRes(t, T.VM, p);
    return { ...view(t, vm), instanceView: { computerName: vm.properties.computerName, osName: vm.properties.image.display, statuses: [{ code: "ProvisioningState/succeeded", displayStatus: "Provisioning succeeded" }, { code: `PowerState/${String(vm.properties.powerState).split(" ")[1]}`, displayStatus: vm.properties.powerState }], vmAgent: { vmAgentVersion: "2.11.1.12", statuses: [{ displayStatus: vm.properties.powerState === "VM running" ? "Ready" : "Not Ready" }] } } };
  },
  "vm start": async (t, p) => { await act(t, await getRes(t, T.VM, p), "start", {}, "start"); return undefined; },
  "vm stop": async (t, p) => { await act(t, await getRes(t, T.VM, p), "stop", {}, "powerOff"); return undefined; },
  "vm restart": async (t, p) => { await act(t, await getRes(t, T.VM, p), "restart", {}, "restart"); return undefined; },
  "vm deallocate": async (t, p) => { await act(t, await getRes(t, T.VM, p), "deallocate", {}, "deallocate"); return undefined; },
  "vm delete": async (t, p) => { const vm = await getRes(t, T.VM, p); needYes(p, `VM '${vm.name}'`); return del(t, vm, p); },
  "vm resize": async (t, p) => view(t, (await act(t, await getRes(t, T.VM, p), "resize", { size: flagReq(p, "size") })) as Res),
  "vm list-sizes": async () => VM_SIZES.map((s) => ({ name: s.name, numberOfCores: s.vcpus, memoryInMB: s.memoryGiB * 1024, maxDataDiskCount: s.vcpus * 2, osDiskSizeInMB: 1047552 })),
  "vm image list": async () => VM_IMAGES.map((i) => ({ urnAlias: i.alias, urn: i.urn, offer: i.urn.split(":")[1], publisher: i.urn.split(":")[0], sku: i.urn.split(":")[2], version: "latest" })),
  "vm list-ip-addresses": async (t, p) => {
    const vms = await list(t, T.VM, p);
    const out: Props[] = [];
    for (const vm of vms) if (!flag(p, "name") || vm.nameKey === flag(p, "name")!.toLowerCase()) { const v = await vmView(t.ctx, vm); out.push({ virtualMachine: { name: vm.name, resourceGroup: vm.resourceGroup, network: { privateIpAddresses: [v.privateIp], publicIpAddresses: v.publicIp ? [{ ipAddress: v.publicIp }] : [] } } }); }
    return out;
  },
  "vm open-port": async (t, p) => {
    const vm = await getRes(t, T.VM, p);
    const v = await vmView(t.ctx, vm);
    if (!v.nicNsg) throw new CliError("The VM's NIC has no network security group. Create one and attach it first.");
    const nsg = await getById(t.ctx, v.nicNsg.id);
    const port = flagReq(p, "port");
    const priority = Number(flag(p, "priority") ?? 900);
    await act(t, nsg, "addRule", { name: `open-port-${port.replace(/[^0-9]/g, "-")}`, priority, destinationPortRange: port, protocol: "*", access: "Allow", direction: "Inbound" });
    return view(t, await getById(t.ctx, nsg.id));
  },
  "vm run-command invoke": async (t, p) => {
    const vm = await getRes(t, T.VM, p);
    const scripts = flagList(p, "scripts").join("\n");
    if (!scripts) throw new CliError("the following arguments are required: --scripts");
    const r = (await act(t, vm, "runCommand", { script: scripts }, "runCommand")) as { output: string };
    return { value: [{ code: "ProvisioningState/succeeded", displayStatus: "Provisioning succeeded", level: "Info", message: `Enable succeeded: \n[stdout]\n${r.output}\n\n[stderr]\n` }] };
  },
  "vm boot-diagnostics get-boot-log": async (t, p) => {
    const vm = await getRes(t, T.VM, p);
    if (!vm.properties.bootDiagnostics) throw new CliError("Boot diagnostics is not enabled for this VM.");
    return { __raw: ((vm.properties.bootLog ?? []) as string[]).join("\n") || "No boot log yet." };
  },
  "vm nic list": async (t, p) => { const vm = await getRes(t, T.VM, p, "vm-name"); return [{ id: vm.properties.nicId, primary: true }]; },

  // ---------- network ----------
  "network vnet create": async (t, p) => {
    const prefixes = flagList(p, "address-prefixes").length ? flagList(p, "address-prefixes") : flagList(p, "address-prefix").length ? flagList(p, "address-prefix") : ["10.0.0.0/16"];
    const subnetName = flag(p, "subnet-name");
    const subnetPrefix = flag(p, "subnet-prefixes") ?? flag(p, "subnet-prefix");
    const r = await create(t, T.VNET, { resourceGroup: await rgName(t, p), name: nm(p), location: flag(p, "location"), addressPrefixes: prefixes, subnets: subnetName ? [{ name: subnetName, addressPrefix: subnetPrefix ?? prefixes[0].replace(/\/\d+$/, "/24") }] : [], tags: parseTags(flagList(p, "tags")), dnsServers: flagList(p, "dns-servers") });
    return { newVNet: view(t, r) };
  },
  "network vnet list": async (t, p) => (await list(t, T.VNET, p)).map((r) => view(t, r)),
  "network vnet show": async (t, p) => view(t, await getRes(t, T.VNET, p)),
  "network vnet delete": async (t, p) => del(t, await getRes(t, T.VNET, p), p),
  "network vnet update": async (t, p) => {
    const v = await getRes(t, T.VNET, p);
    if (flagList(p, "address-prefixes").length) await act(t, v, "updateAddressSpace", { addressPrefixes: flagList(p, "address-prefixes") });
    if (p.flags["dns-servers"]) await act(t, await getById(t.ctx, v.id), "setDnsServers", { dnsServers: flagList(p, "dns-servers") });
    return view(t, await getById(t.ctx, v.id));
  },
  "network vnet subnet create": async (t, p) => {
    const v = await getRes(t, T.VNET, p, "vnet-name");
    const prefix = flag(p, "address-prefixes") ?? flagReq(p, "address-prefix");
    const r = (await act(t, v, "addSubnet", { name: nm(p), addressPrefix: prefix, nsgName: flag(p, "network-security-group") ?? flag(p, "nsg") })) as Res;
    const s = (r.properties.subnets as Props[]).find((x) => x.name === nm(p))!;
    return { name: s.name, addressPrefix: s.addressPrefix, networkSecurityGroup: s.nsgName ? { name: s.nsgName } : null, provisioningState: "Succeeded", resourceGroup: v.resourceGroup };
  },
  "network vnet subnet list": async (t, p) => ((await getRes(t, T.VNET, p, "vnet-name")).properties.subnets as Props[]).map((s) => ({ name: s.name, addressPrefix: s.addressPrefix, networkSecurityGroup: s.nsgName ?? null })),
  "network vnet subnet show": async (t, p) => {
    const s = ((await getRes(t, T.VNET, p, "vnet-name")).properties.subnets as Props[]).find((x) => x.name.toLowerCase() === nm(p).toLowerCase());
    if (!s) throw new CliError(`Subnet '${nm(p)}' not found.`, 3);
    return { name: s.name, addressPrefix: s.addressPrefix, networkSecurityGroup: s.nsgName ? { name: s.nsgName } : null };
  },
  "network vnet subnet update": async (t, p) => {
    const v = await getRes(t, T.VNET, p, "vnet-name");
    const nsg = flag(p, "network-security-group") ?? flag(p, "nsg");
    if (nsg === undefined) throw new CliError("Nothing to update. Use --network-security-group <name> (or \"\" to remove).");
    await act(t, v, "associateNsg", { subnet: nm(p), nsgName: nsg || null });
    return { name: nm(p), networkSecurityGroup: nsg ? { name: nsg } : null };
  },
  "network vnet subnet delete": async (t, p) => { await act(t, await getRes(t, T.VNET, p, "vnet-name"), "deleteSubnet", { name: nm(p) }); return undefined; },
  "network vnet peering create": async (t, p) => {
    const v = await getRes(t, T.VNET, p, "vnet-name");
    const remote = flagReq(p, "remote-vnet").split("/").pop()!;
    await act(t, v, "addPeering", { name: nm(p), remoteVnet: remote, allowForwardedTraffic: boolFlag(p, "allow-forwarded-traffic") });
    return { name: nm(p), peeringState: "Connected", remoteVirtualNetwork: { id: remote } };
  },
  "network vnet peering list": async (t, p) => (await getRes(t, T.VNET, p, "vnet-name")).properties.peerings,
  "network vnet peering delete": async (t, p) => { await act(t, await getRes(t, T.VNET, p, "vnet-name"), "removePeering", { name: nm(p) }); return undefined; },
  "network nsg create": async (t, p) => ({ NewNSG: view(t, await create(t, T.NSG, { resourceGroup: await rgName(t, p), name: nm(p), location: flag(p, "location"), tags: parseTags(flagList(p, "tags")) })) }),
  "network nsg list": async (t, p) => (await list(t, T.NSG, p)).map((r) => view(t, r)),
  "network nsg show": async (t, p) => view(t, await getRes(t, T.NSG, p)),
  "network nsg delete": async (t, p) => del(t, await getRes(t, T.NSG, p), p),
  "network nsg rule create": async (t, p) => {
    const nsg = await getRes(t, T.NSG, p, "nsg-name");
    const r = (await act(t, nsg, "addRule", {
      name: nm(p), priority: flagReq(p, "priority"), direction: flag(p, "direction") ?? "Inbound", access: flag(p, "access") ?? "Allow", protocol: flag(p, "protocol") ?? "*",
      sourceAddressPrefix: flagList(p, "source-address-prefixes").join(",") || "*", sourcePortRange: flagList(p, "source-port-ranges").join(",") || "*",
      destinationAddressPrefix: flagList(p, "destination-address-prefixes").join(",") || "*", destinationPortRange: flagList(p, "destination-port-ranges").join(",") || "*", description: flag(p, "description"),
    })) as Res;
    return (r.properties.securityRules as Props[]).find((x) => x.name === nm(p));
  },
  "network nsg rule list": async (t, p) => {
    const nsg = await getRes(t, T.NSG, p, "nsg-name");
    const rules = [...(nsg.properties.securityRules as Props[])];
    if (boolFlag(p, "include-default")) rules.push(...(await import("@/lib/sim/net")).DEFAULT_RULES);
    return rules.sort((a, b) => a.priority - b.priority);
  },
  "network nsg rule show": async (t, p) => {
    const r = ((await getRes(t, T.NSG, p, "nsg-name")).properties.securityRules as Props[]).find((x) => x.name.toLowerCase() === nm(p).toLowerCase());
    if (!r) throw new CliError(`(NotFound) Security rule ${nm(p)} not found.`, 3);
    return r;
  },
  "network nsg rule update": async (t, p) => {
    const nsg = await getRes(t, T.NSG, p, "nsg-name");
    const patch: Props = { priority: flag(p, "priority"), access: flag(p, "access"), direction: flag(p, "direction"), protocol: flag(p, "protocol"), description: flag(p, "description") };
    if (p.flags["source-address-prefixes"]) patch.sourceAddressPrefix = flagList(p, "source-address-prefixes").join(",");
    if (p.flags["destination-port-ranges"]) patch.destinationPortRange = flagList(p, "destination-port-ranges").join(",");
    if (p.flags["source-port-ranges"]) patch.sourcePortRange = flagList(p, "source-port-ranges").join(",");
    if (p.flags["destination-address-prefixes"]) patch.destinationAddressPrefix = flagList(p, "destination-address-prefixes").join(",");
    const r = (await act(t, nsg, "updateRule", { ...patch, name: nm(p) })) as Res;
    return (r.properties.securityRules as Props[]).find((x) => x.name.toLowerCase() === nm(p).toLowerCase());
  },
  "network nsg rule delete": async (t, p) => { await act(t, await getRes(t, T.NSG, p, "nsg-name"), "deleteRule", { name: nm(p) }); return undefined; },
  "network nic list": async (t, p) => (await list(t, T.NIC, p)).map((n) => ({ name: n.name, resourceGroup: n.resourceGroup, privateIpAddress: n.properties.privateIpAddress, networkSecurityGroup: n.properties.nsgName, subnet: `${n.properties.subnet.vnetName}/${n.properties.subnet.name}`, virtualMachine: n.properties.ownerName ?? null })),
  "network nic show": async (t, p) => { const n = await getRes(t, T.NIC, p); return { name: n.name, ipConfigurations: [{ privateIPAddress: n.properties.privateIpAddress, subnet: { id: `${n.properties.subnet.vnetName}/subnets/${n.properties.subnet.name}` } }], networkSecurityGroup: n.properties.nsgName ? { name: n.properties.nsgName } : null }; },
  "network nic update": async (t, p) => {
    const nic = await getRes(t, T.NIC, p);
    if (!nic.properties.ownerId) throw new CliError("This NIC is not attached to a VM.");
    const vm = await getById(t.ctx, nic.properties.ownerId);
    const nsg = flag(p, "network-security-group");
    if (nsg === undefined) throw new CliError("Use --network-security-group <name> (or \"\" to remove).");
    await act(t, vm, "attachNsg", { nsgName: nsg || null });
    return { name: nic.name, networkSecurityGroup: nsg ? { name: nsg } : null };
  },
  "network public-ip list": async (t, p) => (await list(t, T.PIP, p)).map((r) => ({ name: r.name, resourceGroup: r.resourceGroup, ipAddress: r.properties.ipAddress, publicIPAllocationMethod: r.properties.publicIPAllocationMethod, sku: { name: r.properties.sku } })),
  "network public-ip create": async (t, p) => ({ publicIp: view(t, await create(t, T.PIP, { resourceGroup: await rgName(t, p), name: nm(p), location: flag(p, "location"), sku: flag(p, "sku") ?? "Standard", allocationMethod: flag(p, "allocation-method") })) }),
  "network watcher test-ip-flow": async (t, p) => {
    const vmName = flagReq(p, "vm");
    const vm = await findByName(t.ctx, T.VM, await rgName(t, p), vmName);
    if (!vm) throw new CliError(`VM '${vmName}' not found.`, 3);
    const v = await vmView(t.ctx, vm);
    const nsgId = v.nicNsg?.id ?? v.subnetNsg?.id;
    const [local, remote] = [flagReq(p, "local", "ip:port"), flagReq(p, "remote", "ip:port")];
    const [, lport] = local.split(":");
    const [rip, rport] = remote.split(":");
    if (!nsgId) return { access: "Allow", ruleName: "No NSG associated" };
    const dir = flag(p, "direction") ?? "Inbound";
    const r = (await runAction(t.ctx, await getById(t.ctx, nsgId), "evaluate", { direction: dir, protocol: flag(p, "protocol") ?? "TCP".replace("TCP", "Tcp"), sourceIp: dir === "Inbound" ? rip : v.privateIp, destinationIp: dir === "Inbound" ? v.privateIp : rip, destinationPort: dir === "Inbound" ? Number(lport) : Number(rport) })) as Props;
    return { access: r.access, ruleName: `securityRules/${r.ruleName}` };
  },
  "network watcher test-connectivity": async (t, p) => {
    const dest = flagReq(p, "dest-resource");
    const vm = await findByName(t.ctx, T.VM, await rgName(t, p), dest.split("/").pop()!);
    if (!vm) throw new CliError(`Destination VM '${dest}' not found.`, 3);
    const r = (await runAction(t.ctx, vm, "testConnectivity", { port: Number(flagReq(p, "dest-port")), source: flag(p, "source-resource")?.split("/").pop() ?? "Internet" })) as Props;
    return { connectionStatus: r.status, hops: r.hops };
  },

  // ---------- storage ----------
  "storage account create": async (t, p) => view(t, await create(t, T.STORAGE, { resourceGroup: await rgName(t, p), name: nm(p), location: flag(p, "location"), sku: flag(p, "sku") ?? "Standard_RAGRS", kind: flag(p, "kind") ?? "StorageV2", accessTier: flag(p, "access-tier") ?? "Hot", allowBlobPublicAccess: optBool(p, "allow-blob-public-access") ?? false, minimumTlsVersion: flag(p, "min-tls-version") ?? "TLS1_2", httpsOnly: optBool(p, "https-only") ?? true, tags: parseTags(flagList(p, "tags")) })),
  "storage account list": async (t, p) => (await list(t, T.STORAGE, p)).map((r) => view(t, r)),
  "storage account show": async (t, p) => view(t, await getRes(t, T.STORAGE, p)),
  "storage account delete": async (t, p) => { const r = await getRes(t, T.STORAGE, p); needYes(p, `storage account '${r.name}'`); return del(t, r, p); },
  "storage account update": async (t, p) => view(t, (await act(t, await getRes(t, T.STORAGE, p), "updateConfig", { accessTier: flag(p, "access-tier"), allowBlobPublicAccess: optBool(p, "allow-blob-public-access"), minimumTlsVersion: flag(p, "min-tls-version"), httpsOnly: optBool(p, "https-only"), sku: flag(p, "sku"), networkDefaultAction: flag(p, "default-action"), allowSharedKeyAccess: optBool(p, "allow-shared-key-access") })) as Res),
  "storage account keys list": async (t, p) => { const r = await getRes(t, T.STORAGE, p, flag(p, "account-name") ? "account-name" : "name"); return [{ keyName: "key1", permissions: "FULL", value: fakeKey(`${r.id}:${r.properties.keyRotatedAt}:1`) }, { keyName: "key2", permissions: "FULL", value: fakeKey(`${r.id}:${r.properties.keyRotatedAt}:2`) }]; },
  "storage account network-rule add": async (t, p) => { const r = await getRes(t, T.STORAGE, p, "account-name"); const ip = flagReq(p, "ip-address"); return view(t, (await act(t, r, "updateConfig", { ipRules: [...new Set([...(r.properties.networkRules.ipRules as string[]), ip])] })) as Res); },
  "storage container create": async (t, p) => { const sa = await storageAcc(t, p); await act(t, sa, "createContainer", { name: nm(p), publicAccess: flag(p, "public-access") ?? "none" }); return { created: true }; },
  "storage container list": async (t, p) => ((await storageAcc(t, p)).properties.containers as Props[]).map((c) => ({ name: c.name, properties: { publicAccess: c.publicAccess === "none" ? null : c.publicAccess, lastModified: c.createdAt } })),
  "storage container delete": async (t, p) => { await act(t, await storageAcc(t, p), "deleteContainer", { name: nm(p) }); return { deleted: true }; },
  "storage container set-permission": async (t, p) => { await act(t, await storageAcc(t, p), "setContainerAccess", { name: nm(p), publicAccess: flag(p, "public-access") ?? "off".replace("off", "none") }); return { lastModified: new Date().toISOString() }; },
  "storage blob upload": async (t, p) => {
    const sa = await storageAcc(t, p);
    const file = flagReq(p, "file", "-f");
    const content = readFile(t.state, resolvePath(t.state, file));
    const name = flag(p, "name") ?? file.split("/").pop()!;
    await act(t, sa, "uploadBlob", { container: flagReq(p, "container-name", "-c"), name, content, overwrite: boolFlag(p, "overwrite") || true, tier: flag(p, "tier") });
    return { etag: `"0x8D${Date.now().toString(16).toUpperCase()}"`, lastModified: new Date().toISOString() };
  },
  "storage blob list": async (t, p) => {
    const sa = await storageAcc(t, p);
    const c = (sa.properties.containers as Props[]).find((x) => x.name === flagReq(p, "container-name", "-c"));
    if (!c) throw new CliError(`The specified container does not exist.\nErrorCode:ContainerNotFound`, 3);
    return (c.blobs as Props[]).map((b) => ({ name: b.name, properties: { contentLength: b.size, contentSettings: { contentType: b.contentType }, blobTier: b.tier, lastModified: b.lastModified } }));
  },
  "storage blob download": async (t, p) => {
    const sa = await storageAcc(t, p);
    const r = await downloadBlob(t.ctx, sa, flagReq(p, "container-name", "-c"), nm(p));
    const file = flagReq(p, "file", "-f");
    writeFile(t.state, resolvePath(t.state, file), r.content.toString("utf8"));
    t.changes.push(`Downloaded ${r.name} to ${file}`);
    return { name: r.name, properties: { contentLength: r.size } };
  },
  "storage blob delete": async (t, p) => { await act(t, await storageAcc(t, p), "deleteBlob", { container: flagReq(p, "container-name", "-c"), name: nm(p) }); return undefined; },
  "storage blob set-tier": async (t, p) => { await act(t, await storageAcc(t, p), "setBlobTier", { container: flagReq(p, "container-name", "-c"), name: nm(p), tier: flagReq(p, "tier") }); return undefined; },

  // ---------- Entra ID / RBAC ----------
  "ad user create": async (t, p) => {
    const upn = flagReq(p, "user-principal-name");
    const nick = upn.split("@")[0];
    return view(t, await create(t, T.ENTRA_USER, { displayName: flagReq(p, "display-name"), mailNickname: nick, password: flagReq(p, "password"), department: flag(p, "department"), accountEnabled: optBool(p, "account-enabled") ?? true }));
  },
  "ad user list": async (t) => (await listResources(t.ctx, { type: T.ENTRA_USER })).map((r) => view(t, r)),
  "ad user show": async (t, p) => { const u = await userBy(t, flagReq(p, "id")); return view(t, u); },
  "ad user delete": async (t, p) => del(t, await userBy(t, flagReq(p, "id")), p),
  "ad user update": async (t, p) => { const u = await userBy(t, flagReq(p, "id")); const en = optBool(p, "account-enabled"); if (en === undefined) throw new CliError("Use --account-enabled true|false"); await act(t, u, en ? "enable" : "disable"); return undefined; },
  "ad group create": async (t, p) => view(t, await create(t, T.ENTRA_GROUP, { name: flagReq(p, "display-name"), description: flag(p, "description") })),
  "ad group list": async (t) => (await listResources(t.ctx, { type: T.ENTRA_GROUP })).map((r) => view(t, r)),
  "ad group member add": async (t, p) => { const g = await groupBy(t, flagReq(p, "group")); await act(t, g, "addMember", { user: flagReq(p, "member-id") }); return undefined; },
  "ad group member list": async (t, p) => { const g = await groupBy(t, flagReq(p, "group")); const users = await listResources(t.ctx, { type: T.ENTRA_USER }); return users.filter((u) => (g.properties.members as string[]).includes(u.properties.objectId)).map((u) => view(t, u)); },
  "ad group member remove": async (t, p) => { const g = await groupBy(t, flagReq(p, "group")); await act(t, g, "removeMember", { user: flagReq(p, "member-id") }); return undefined; },
  "ad signed-in-user show": async (t) => ({ userPrincipalName: t.state.az.identity ?? t.ctx.caller, displayName: t.state.az.identity ? t.state.az.identity.split("@")[0] : t.userName }),
  "role assignment create": async (t, p) => {
    await authz(t, T.ROLE_ASSIGNMENT, "write");
    const scope = flag(p, "scope") ?? (flag(p, "resource-group") ? `/resourceGroups/${flag(p, "resource-group")}` : "/");
    const r = await createByType(t.ctx, T.ROLE_ASSIGNMENT, { principal: flagReq(p, "assignee"), role: flagReq(p, "role"), scope });
    t.changes.push(`Assigned '${r.properties.roleDefinitionName}' to ${r.properties.principalName}`);
    return view(t, r);
  },
  "role assignment list": async (t, p) => {
    const all = await listResources(t.ctx, { type: T.ROLE_ASSIGNMENT });
    const who = flag(p, "assignee")?.toLowerCase();
    const scope = flag(p, "scope") ? normalizeScope(flag(p, "scope")!) : flag(p, "resource-group") ? normalizeScope(`/resourceGroups/${flag(p, "resource-group")}`) : null;
    return all.filter((a) => (!who || a.properties.principalName.toLowerCase().startsWith(who)) && (!scope || a.properties.scope === scope || boolFlag(p, "all"))).map((a) => view(t, a));
  },
  "role assignment delete": async (t, p) => {
    const all = await listResources(t.ctx, { type: T.ROLE_ASSIGNMENT });
    const who = flagReq(p, "assignee").toLowerCase();
    const role = flag(p, "role")?.toLowerCase();
    const matches = all.filter((a) => a.properties.principalName.toLowerCase().startsWith(who) && (!role || a.properties.roleDefinitionName.toLowerCase() === role));
    if (!matches.length) throw new CliError("No matched assignments were found to delete", 3);
    for (const m of matches) await deleteResource(t.ctx, m);
    t.changes.push(`Deleted ${matches.length} role assignment(s)`);
    return undefined;
  },
  "role definition list": async (t, p) => BUILTIN_ROLES.filter((r) => !flag(p, "name") || r.name.toLowerCase() === flag(p, "name")!.toLowerCase()).map((r) => ({ roleName: r.name, description: r.description, roleType: "BuiltInRole", permissions: [{ actions: r.actions, notActions: r.notActions ?? [], dataActions: r.dataActions ?? [] }] })),

  // ---------- Key Vault ----------
  "keyvault create": async (t, p) => view(t, await create(t, T.KEYVAULT, { resourceGroup: await rgName(t, p), name: nm(p), location: flag(p, "location"), enableRbacAuthorization: optBool(p, "enable-rbac-authorization") ?? false, softDeleteRetentionDays: flag(p, "retention-days"), enablePurgeProtection: optBool(p, "enable-purge-protection") ?? false })),
  "keyvault list": async (t, p) => (await list(t, T.KEYVAULT, p)).map((r) => view(t, r)),
  "keyvault show": async (t, p) => view(t, await getRes(t, T.KEYVAULT, p)),
  "keyvault delete": async (t, p) => del(t, await getRes(t, T.KEYVAULT, p), p),
  "keyvault set-policy": async (t, p) => view(t, (await act(t, await vaultBy(t, nm(p)), "setAccessPolicy", { principal: flag(p, "upn") ?? flag(p, "object-id") ?? flagReq(p, "spn"), secretPermissions: flagList(p, "secret-permissions") })) as Res),
  "keyvault secret set": async (t, p) => {
    const kv = await vaultBy(t, flagReq(p, "vault-name"));
    const value = flag(p, "value") ?? (flag(p, "file") ? readFile(t.state, resolvePath(t.state, flag(p, "file")!)) : undefined);
    if (value === undefined) throw new CliError("the following arguments are required: --value");
    const r = (await act(t, kv, "setSecret", { name: nm(p), value, expires: flag(p, "expires"), contentType: flag(p, "content-type") })) as Res;
    const s = (r.properties.secrets as Props[]).find((x) => x.name === nm(p))!;
    return { id: `${kv.properties.vaultUri}secrets/${nm(p)}/${s.versions[0].version}`, name: nm(p), attributes: { enabled: true, expires: s.versions[0].expires, created: s.versions[0].created }, value: "***" };
  },
  "keyvault secret show": async (t, p) => {
    const kv = await vaultBy(t, flagReq(p, "vault-name"));
    const r = (await runAction(t.ctx, kv, "getSecret", { name: nm(p), version: flag(p, "version"), principal: t.state.az.identity ?? undefined })) as Props;
    return { id: `${kv.properties.vaultUri}secrets/${r.name}/${r.version}`, name: r.name, value: r.value, attributes: { enabled: true, expires: r.expires, created: r.created } };
  },
  "keyvault secret list": async (t, p) => { const kv = await vaultBy(t, flagReq(p, "vault-name")); return (sanitize(kv).properties.secrets as Props[]).map((s) => ({ name: s.name, attributes: { enabled: s.versions[0]?.enabled, expires: s.versions[0]?.expires }, id: `${kv.properties.vaultUri}secrets/${s.name}` })); },
  "keyvault secret list-versions": async (t, p) => { const kv = await vaultBy(t, flagReq(p, "vault-name")); const s = (sanitize(kv).properties.secrets as Props[]).find((x) => x.name === nm(p)); if (!s) throw new CliError(`Secret not found: ${nm(p)}`, 3); return s.versions; },
  "keyvault secret delete": async (t, p) => { await act(t, await vaultBy(t, flagReq(p, "vault-name")), "deleteSecret", { name: nm(p) }); return { name: nm(p), recoveryId: `deletedsecrets/${nm(p)}` }; },
  "keyvault secret recover": async (t, p) => { await act(t, await vaultBy(t, flagReq(p, "vault-name")), "recoverSecret", { name: nm(p) }); return { name: nm(p) }; },
  "keyvault secret purge": async (t, p) => { await act(t, await vaultBy(t, flagReq(p, "vault-name")), "purgeSecret", { name: nm(p) }); return undefined; },

  // ---------- App Service & Functions ----------
  "appservice plan create": async (t, p) => view(t, await create(t, T.PLAN, { resourceGroup: await rgName(t, p), name: nm(p), location: flag(p, "location"), sku: flag(p, "sku") ?? "B1", os: boolFlag(p, "is-linux") ? "Linux" : "Windows" })),
  "appservice plan list": async (t, p) => (await list(t, T.PLAN, p)).map((r) => view(t, r)),
  "webapp create": async (t, p) => view(t, await create(t, T.SITE, { resourceGroup: await rgName(t, p), name: nm(p), planName: flagReq(p, "plan", "-p"), runtime: (flag(p, "runtime") ?? "NODE|20-lts").replace(":", "|").toUpperCase().replace("NODE|20LTS", "NODE|20-lts").replace(/-LTS$/, "-lts"), identity: boolFlag(p, "assign-identity") })),
  "webapp list": async (t, p) => (await list(t, T.SITE, p)).map((r) => view(t, r)),
  "webapp show": async (t, p) => view(t, await getRes(t, T.SITE, p)),
  "webapp start": async (t, p) => { await act(t, await getRes(t, T.SITE, p), "start"); return undefined; },
  "webapp stop": async (t, p) => { await act(t, await getRes(t, T.SITE, p), "stop"); return undefined; },
  "webapp restart": async (t, p) => { await act(t, await getRes(t, T.SITE, p), "restart"); return undefined; },
  "webapp delete": async (t, p) => del(t, await getRes(t, T.SITE, p), p),
  "webapp browse": async (t, p) => (await runAction(t.ctx, await getRes(t, T.SITE, p), "browse", { path: flag(p, "path") ?? "/" })),
  "webapp deploy": async (t, p) => { const r = (await act(t, await getRes(t, T.SITE, p), "deploy", { package: (flagReq(p, "src-path", "sample app name, e.g. hello-node")).replace(/\.zip$/, "").split("/").pop(), source: "az webapp deploy" })) as Props; if (r.deployment.status !== "Success") throw new CliError(r.deployment.log.join("\n")); return { status: 4, complete: true, deployer: "OneDeploy", log: r.deployment.log }; },
  "webapp config appsettings set": async (t, p) => { const r = (await act(t, await getRes(t, T.SITE, p), "setAppSettings", { settings: parseTags(flagList(p, "settings")) })) as Res; return Object.entries(r.properties.appSettings).map(([name, value]) => ({ name, value, slotSetting: false })); },
  "webapp config appsettings list": async (t, p) => Object.entries((await getRes(t, T.SITE, p)).properties.appSettings).map(([name, value]) => ({ name, value, slotSetting: false })),
  "webapp config appsettings delete": async (t, p) => { await act(t, await getRes(t, T.SITE, p), "setAppSettings", { settings: {}, remove: flagList(p, "setting-names") }); return undefined; },
  "webapp identity assign": async (t, p) => { const r = (await act(t, await getRes(t, T.SITE, p), "setIdentity", { enabled: true })) as Res; return { type: "SystemAssigned", principalName: r.properties.identity.principalName }; },
  "webapp log tail": async (t, p) => ({ __raw: ((await getRes(t, T.SITE, p)).properties.logs as string[]).slice(-40).join("\n") || "No log entries." }),
  "webapp deployment list": async (t, p) => (await getRes(t, T.SITE, p)).properties.deployments.map((d: Props) => ({ id: d.id, status: d.status, time: d.time, source: d.source })),
  "functionapp create": async (t, p) => view(t, await create(t, T.FUNCTION_APP, { resourceGroup: await rgName(t, p), name: nm(p), location: flag(p, "consumption-plan-location") ?? flag(p, "location"), runtime: flag(p, "runtime") ?? "node", storageAccount: flagReq(p, "storage-account") })),
  "functionapp list": async (t, p) => (await list(t, T.FUNCTION_APP, p)).map((r) => view(t, r)),
  "functionapp show": async (t, p) => view(t, await getRes(t, T.FUNCTION_APP, p)),
  "functionapp delete": async (t, p) => del(t, await getRes(t, T.FUNCTION_APP, p), p),
  "functionapp function list": async (t, p) => ((await getRes(t, T.FUNCTION_APP, p)).properties.functions as Props[]).map((f) => ({ name: f.name, template: f.template, authLevel: f.authLevel, invokeUrlTemplate: f.invokeUrl, isDisabled: f.disabled })),
  "functionapp config appsettings set": async (t, p) => { await act(t, await getRes(t, T.FUNCTION_APP, p), "setAppSettings", { settings: parseTags(flagList(p, "settings")) }); return undefined; },

  // ---------- SQL ----------
  "sql server create": async (t, p) => view(t, await create(t, T.SQL_SERVER, { resourceGroup: await rgName(t, p), name: nm(p), location: flag(p, "location"), adminLogin: flagReq(p, "admin-user", "-u"), adminPassword: flagReq(p, "admin-password", "-p") })),
  "sql server list": async (t, p) => (await list(t, T.SQL_SERVER, p)).map((r) => view(t, r)),
  "sql server show": async (t, p) => view(t, await getRes(t, T.SQL_SERVER, p)),
  "sql server update": async (t, p) => view(t, (await act(t, await getRes(t, T.SQL_SERVER, p), "updateNetwork", { publicNetworkAccess: flag(p, "enable-public-network") === undefined ? undefined : optBool(p, "enable-public-network") ? "Enabled" : "Disabled" })) as Res),
  "sql server firewall-rule create": async (t, p) => { await act(t, await getRes(t, T.SQL_SERVER, p, "server"), "addFirewallRule", { name: nm(p), startIp: flagReq(p, "start-ip-address"), endIp: flagReq(p, "end-ip-address") }); return { name: nm(p), startIpAddress: flag(p, "start-ip-address"), endIpAddress: flag(p, "end-ip-address") }; },
  "sql server firewall-rule list": async (t, p) => (await getRes(t, T.SQL_SERVER, p, "server")).properties.firewallRules,
  "sql server firewall-rule delete": async (t, p) => { await act(t, await getRes(t, T.SQL_SERVER, p, "server"), "deleteFirewallRule", { name: nm(p) }); return undefined; },
  "sql db create": async (t, p) => view(t, await create(t, T.SQL_DB, { resourceGroup: await rgName(t, p), serverName: flagReq(p, "server", "-s"), name: nm(p), sku: flag(p, "service-objective") ?? "Basic" })),
  "sql db list": async (t, p) => (await listResources(t.ctx, { type: T.SQL_DB, resourceGroup: flag(p, "resource-group") })).filter((d) => d.properties.serverName === flagReq(p, "server", "-s")).map((r) => view(t, r)),
  "sql db show": async (t, p) => { const d = await findByName(t.ctx, T.SQL_DB, await rgName(t, p), `${flagReq(p, "server", "-s")}/${nm(p)}`); if (!d) throw new CliError(`(ResourceNotFound) Database '${nm(p)}' not found.`, 3); return view(t, d); },

  // ---------- Monitor ----------
  "monitor metrics list": async (t, p) => {
    const ref = flagReq(p, "resource");
    const r = (await listResources(t.ctx)).find((x) => x.id === ref || armId(t.sub.subscriptionId, x).toLowerCase() === ref.toLowerCase() || x.nameKey === ref.toLowerCase().split("/").pop());
    if (!r) throw new CliError(`Resource '${ref}' not found.`, 3);
    const metric = flag(p, "metric") ?? METRICS[r.type]?.[0]?.name;
    if (!metric || !METRICS[r.type]?.some((m) => m.name.toLowerCase() === metric.toLowerCase())) throw new CliError(`Metric '${metric}' is not supported. Available: ${(METRICS[r.type] ?? []).map((m) => m.name).join(", ")}`);
    const name = METRICS[r.type].find((m) => m.name.toLowerCase() === metric.toLowerCase())!.name;
    return { value: [{ name: { value: name }, timeseries: [{ data: metricSeries(r, name, 12).map((s) => ({ timeStamp: s.t, average: s.v })) }], unit: METRICS[r.type].find((m) => m.name === name)!.unit }] };
  },
  "monitor metrics alert create": async (t, p) => {
    const cond = flagList(p, "condition").join(" ");
    const m = /^(avg|max|min)\s+"?([^"]+?)"?\s*(>=|<=|>|<)\s*([\d.]+)$/i.exec(cond.trim());
    if (!m) throw new CliError(`Invalid --condition '${cond}'. Example: --condition "avg Percentage CPU > 80"`);
    const scope = flagReq(p, "scopes");
    const target = (await listResources(t.ctx)).find((x) => x.id === scope || x.nameKey === scope.toLowerCase().split("/").pop());
    if (!target) throw new CliError(`Scope resource '${scope}' not found.`, 3);
    const op = { ">": "GreaterThan", ">=": "GreaterThanOrEqual", "<": "LessThan", "<=": "LessThanOrEqual" }[m[3]]!;
    return view(t, await create(t, T.ALERT, { resourceGroup: await rgName(t, p), name: nm(p), targetResourceId: target.id, metric: m[2], operator: op, threshold: Number(m[4]), aggregation: { avg: "Average", max: "Maximum", min: "Minimum" }[m[1].toLowerCase() as "avg"], windowMinutes: Number((flag(p, "window-size") ?? "10m").replace(/m$/, "")), severity: flag(p, "severity") ?? 2 }));
  },
  "monitor metrics alert list": async (t, p) => { await evaluateAlerts(t.ctx); return (await list(t, T.ALERT, p)).map((a) => ({ name: a.name, resourceGroup: a.resourceGroup, enabled: a.properties.enabled, severity: a.properties.severity, state: a.properties.state, condition: `${a.properties.aggregation} ${a.properties.metric} ${a.properties.operator} ${a.properties.threshold}`, target: a.properties.targetName })); },
  "monitor log-analytics workspace create": async (t, p) => view(t, await create(t, T.WORKSPACE, { resourceGroup: await rgName(t, p), name: flag(p, "workspace-name") ?? nm(p), location: flag(p, "location") })),
  "monitor log-analytics workspace list": async (t, p) => (await list(t, T.WORKSPACE, p)).map((r) => view(t, r)),
  "monitor log-analytics query": async (t, p) => {
    const ws = flagReq(p, "workspace", "-w");
    if (!(await findAnyByName(t.ctx, T.WORKSPACE, ws)) && !(await listResources(t.ctx, { type: T.WORKSPACE })).some((w) => w.properties.customerId === ws)) throw new CliError(`Workspace '${ws}' not found.`, 3);
    const r = runKql(flagReq(p, "analytics-query"), await buildTables(t.ctx));
    return r.rows;
  },
  "monitor activity-log list": async (t, p) => {
    const { prisma } = await import("@/lib/db");
    const logs = await prisma.activityLog.findMany({ where: { userId: t.ctx.userId, ...(flag(p, "resource-group") ? { resourceGroup: { equals: flag(p, "resource-group"), mode: "insensitive" } } : {}) }, orderBy: { createdAt: "desc" }, take: Number(flag(p, "max-events") ?? 50) });
    return logs.map((l) => ({ eventTimestamp: l.createdAt, operationName: { value: l.operation }, status: { value: l.status }, caller: l.caller, resourceGroupName: l.resourceGroup, resourceId: l.resourceName }));
  },

  // ---------- Containers ----------
  "acr create": async (t, p) => view(t, await create(t, T.ACR, { resourceGroup: await rgName(t, p), name: nm(p), location: flag(p, "location"), sku: flag(p, "sku") ?? "Basic", adminUserEnabled: optBool(p, "admin-enabled") ?? false })),
  "acr list": async (t, p) => (await list(t, T.ACR, p)).map((r) => view(t, r)),
  "acr show": async (t, p) => view(t, await getRes(t, T.ACR, p)),
  "acr build": async (t, p) => {
    const acr = await acrBy(t, flagReq(p, "registry", "-r"));
    const dfPath = resolvePath(t.state, flag(p, "file") ?? "Dockerfile");
    const dockerfile = readFile(t.state, dfPath);
    const r = (await act(t, acr, "build", { image: flagReq(p, "image", "-t"), dockerfile })) as Props;
    if (r.status !== "Succeeded") throw new CliError(r.log.join("\n"));
    return { __raw: r.log.join("\n") + `\nRun ID: ca1 was successful` };
  },
  "acr repository list": async (t, p) => Object.keys((await acrBy(t, nm(p))).properties.repositories),
  "acr repository show-tags": async (t, p) => { const r = (await acrBy(t, nm(p))).properties.repositories[flagReq(p, "repository")]; if (!r) throw new CliError(`repository ${flag(p, "repository")} is not found`, 3); return (r as Props[]).map((x) => x.tag); },
  "acr repository delete": async (t, p) => { needYes(p, "the image"); await act(t, await acrBy(t, nm(p)), "deleteImage", { image: flag(p, "image") ?? flagReq(p, "repository") }); return undefined; },
  "container create": async (t, p) => view(t, await create(t, T.ACI, { resourceGroup: await rgName(t, p), name: nm(p), location: flag(p, "location"), image: flagReq(p, "image"), cpu: flag(p, "cpu") ?? 1, memoryGB: flag(p, "memory") ?? 1.5, ports: flagList(p, "ports").length ? flagList(p, "ports").map(Number) : [80], dnsNameLabel: flag(p, "dns-name-label"), environmentVariables: parseTags(flagList(p, "environment-variables")) })),
  "container list": async (t, p) => (await list(t, T.ACI, p)).map((r) => view(t, r)),
  "container show": async (t, p) => view(t, await getRes(t, T.ACI, p)),
  "container logs": async (t, p) => { const c = await getRes(t, T.ACI, p); return { __raw: ((c.properties.logs as string[]).join("\n") || (c.properties.events as Props[]).map((e) => `${e.type}: ${e.message}`).join("\n")) }; },
  "container delete": async (t, p) => { const c = await getRes(t, T.ACI, p); needYes(p, `container group '${c.name}'`); return del(t, c, p); },
  "container stop": async (t, p) => { await act(t, await getRes(t, T.ACI, p), "stop"); return undefined; },
  "container start": async (t, p) => { await act(t, await getRes(t, T.ACI, p), "start"); return undefined; },
  "aks create": async (t, p) => view(t, await create(t, T.AKS, { resourceGroup: await rgName(t, p), name: nm(p), location: flag(p, "location"), nodeCount: flag(p, "node-count") ?? 3, nodeVmSize: flag(p, "node-vm-size") ?? "Standard_D2s_v5", kubernetesVersion: flag(p, "kubernetes-version"), attachAcr: flag(p, "attach-acr"), networkPlugin: flag(p, "network-plugin") })),
  "aks list": async (t, p) => (await list(t, T.AKS, p)).map((r) => view(t, r)),
  "aks show": async (t, p) => view(t, await getRes(t, T.AKS, p)),
  "aks delete": async (t, p) => { const c = await getRes(t, T.AKS, p); needYes(p, `cluster '${c.name}'`); return del(t, c, p); },
  "aks get-credentials": async (t, p) => { const c = await getRes(t, T.AKS, p); t.state.az.aksContext = { cluster: c.name, resourceGroup: c.resourceGroup }; return { __raw: `Merged "${c.name}" as current context in /home/learner/.kube/config` }; },
  "aks stop": async (t, p) => { await act(t, await getRes(t, T.AKS, p), "stop"); return undefined; },
  "aks start": async (t, p) => { await act(t, await getRes(t, T.AKS, p), "start"); return undefined; },
  "aks scale": async (t, p) => view(t, (await act(t, await getRes(t, T.AKS, p), "scaleNodes", { count: flagReq(p, "node-count") })) as Res),
  "aks update": async (t, p) => { const acr = flag(p, "attach-acr"); if (!acr) throw new CliError("Only --attach-acr is supported by the simulator for 'aks update'."); return view(t, (await act(t, await getRes(t, T.AKS, p), "attachAcr", { acr })) as Res); },

  // ---------- Backup ----------
  "backup vault create": async (t, p) => view(t, await create(t, T.BACKUP_VAULT, { resourceGroup: await rgName(t, p), name: nm(p), location: flagReq(p, "location", "-l") })),
  "backup vault list": async (t, p) => (await list(t, T.BACKUP_VAULT, p)).map((r) => view(t, r)),
  "backup protection enable-for-vm": async (t, p) => { const v = await getRes(t, T.BACKUP_VAULT, p, "vault-name"); await act(t, v, "enableProtection", { vmName: flagReq(p, "vm").split("/").pop(), policy: flag(p, "policy-name") ?? "DefaultPolicy" }); return { status: "Completed", operation: "ConfigureBackup" }; },
  "backup protection backup-now": async (t, p) => { const v = await getRes(t, T.BACKUP_VAULT, p, "vault-name"); await act(t, v, "backupNow", { vmName: flagReq(p, "item-name") }); return { status: "Completed", operation: "Backup" }; },
  "backup job list": async (t, p) => (await getRes(t, T.BACKUP_VAULT, p, "vault-name")).properties.jobs,
  "backup recoverypoint list": async (t, p) => { const v = await getRes(t, T.BACKUP_VAULT, p, "vault-name"); const it = (v.properties.protectedItems as Props[]).find((i) => i.vmName.toLowerCase() === flagReq(p, "item-name").toLowerCase()); if (!it) throw new CliError("Item not found", 3); return (it.recoveryPoints as Props[]).map((r) => ({ name: r.id, recoveryPointTime: r.time, recoveryPointType: r.type })); },
};

async function storageAcc(t: Term, p: Parsed) {
  const name = flagReq(p, "account-name");
  const sa = await findAnyByName(t.ctx, T.STORAGE, name);
  if (!sa) throw new CliError(`The storage account '${name}' was not found.`, 3);
  await authz(t, T.STORAGE, "read", sa.resourceGroup, sa.name);
  return sa;
}
async function vaultBy(t: Term, name: string) {
  const kv = await findAnyByName(t.ctx, T.KEYVAULT, name);
  if (!kv) throw new CliError(`(VaultNotFound) The vault '${name}' could not be found.`, 3);
  return kv;
}
async function acrBy(t: Term, name: string) {
  const r = await findAnyByName(t.ctx, T.ACR, name);
  if (!r) throw new CliError(`The resource with name '${name}' and type '${T.ACR}' could not be found in subscription '${t.sub.displayName}'.`, 3);
  return r;
}
async function userBy(t: Term, id: string) {
  const all = await listResources(t.ctx, { type: T.ENTRA_USER });
  const u = all.find((x) => x.nameKey === id.toLowerCase() || x.properties.objectId === id || x.nameKey.split("@")[0] === id.toLowerCase());
  if (!u) throw new CliError(`Resource '${id}' does not exist or one of its queried reference-property objects are not present.`, 3);
  return u;
}
async function groupBy(t: Term, id: string) {
  const all = await listResources(t.ctx, { type: T.ENTRA_GROUP });
  const g = all.find((x) => x.nameKey === id.toLowerCase() || x.properties.objectId === id);
  if (!g) throw new CliError(`Group '${id}' not found.`, 3);
  return g;
}

const KEYS = Object.keys(COMMANDS).sort((a, b) => b.split(" ").length - a.split(" ").length);
const NO_LOGIN = ["login", "version", "logout"];

function helpFor(prefix: string): string {
  const subs = new Set(Object.keys(COMMANDS).filter((k) => k.startsWith(prefix ? prefix + " " : "") || (!prefix)).map((k) => k.slice(prefix ? prefix.length + 1 : 0).split(" ")[0]).filter(Boolean));
  if (!subs.size) return "";
  return `Group\n    az${prefix ? " " + prefix : ""}\n\nSubgroups / Commands:\n${[...subs].sort().map((s) => `    ${s}`).join("\n")}\n\nThis is the Azure Gigs CLI simulator; commands act on your simulated subscription.`;
}

export async function runAz(t: Term, argv: string[]): Promise<CmdResult> {
  if (!argv.length || argv[0] === "--help" || argv[0] === "-h") return { stdout: helpFor("") };
  const words: string[] = [];
  for (const a of argv) { if (a.startsWith("-")) break; words.push(a); }
  const key = KEYS.find((k) => k.split(" ").every((w, i) => words[i] === w));
  const rest = argv.slice(key ? key.split(" ").length : 0);
  const extra = key ? CMD_ALIASES.filter(([prefix]) => key.startsWith(prefix)).reduce((a, [, m]) => ({ ...a, ...m }), {}) : {};
  const p = parseArgs(rest, { ...ALIASES, ...extra });
  if (!key || p.bools.has("help")) {
    const prefix = key ?? words.join(" ");
    const h = helpFor(prefix);
    if (h) return { stdout: h };
    const near = Object.keys(COMMANDS).find((k) => k.startsWith(words.slice(0, -1).join(" ")) && words.length > 1);
    return { stdout: "", stderr: `'${words.join(" ")}' is misspelled or not recognized by the system.${near ? `\nDid you mean 'az ${near}'?` : ""}\n\nExamples from AI knowledge base:\naz --help`, exitCode: 2 };
  }
  try {
    if (!NO_LOGIN.includes(key)) requireLogin(t);
    const data = await COMMANDS[key](t, p);
    if (data && typeof data === "object" && "__raw" in (data as Props)) return { stdout: String((data as Props).__raw) };
    const out = render(data, flag(p, "output"), flag(p, "query"));
    return { stdout: out, data };
  } catch (e) {
    if (e instanceof CliError) return { stdout: "", stderr: `ERROR: ${e.message}`, exitCode: e.exitCode };
    if (e instanceof AppError) return { stdout: "", stderr: `ERROR: (${e.code}) ${e.message}\nCode: ${e.code}`, exitCode: e.status === 404 ? 3 : 1 };
    if (e && typeof e === "object" && "issues" in e) return { stdout: "", stderr: `ERROR: ${(e as { issues: { path: string[]; message: string }[] }).issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`, exitCode: 2 };
    throw e;
  }
}

export const AZ_COMMANDS = Object.keys(COMMANDS);
export { resourceDetail };
