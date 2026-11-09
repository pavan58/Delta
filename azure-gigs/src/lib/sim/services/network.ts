import { z } from "zod";
import { badRequest, conflict, notFound } from "@/lib/errors";
import {
  addDependency, createResource, Ctx, dependentsOf, findAnyByName, getByName, listResources, logActivity, mutate, Props, removeDependency, Res, seeded,
} from "../engine";
import { T } from "../types";
import {
  cidrContains, cidrsOverlap, Direction, evaluateNsg, Flow, isPrivateIp, NsgRule, parseCidr, validateAddressPrefix, validatePortRange,
} from "../net";

const tagsSchema = z.record(z.string(), z.string()).optional();

export const subnetSchema = z.object({
  name: z.string().min(1).max(80).regex(/^[\w.-]+$/, "Subnet names may contain letters, digits, '_', '.', '-'"),
  addressPrefix: z.string(),
  nsgName: z.string().optional().nullable(),
});

export const vnetSchema = z.object({
  resourceGroup: z.string().min(1),
  name: z.string().min(2).max(64),
  location: z.string().optional(),
  addressPrefixes: z.array(z.string()).min(1).max(10),
  subnets: z.array(subnetSchema).max(20).optional(),
  dnsServers: z.array(z.string()).optional(),
  tags: tagsSchema,
});

function validateSubnets(addressPrefixes: string[], subnets: { name: string; addressPrefix: string }[]) {
  const spaces = addressPrefixes.map(parseCidr);
  for (let i = 0; i < spaces.length; i++)
    for (let j = i + 1; j < spaces.length; j++)
      if (cidrsOverlap(spaces[i], spaces[j])) throw badRequest("NetcfgInvalidAddressSpace", `Address spaces ${spaces[i].text} and ${spaces[j].text} overlap.`);
  const seen = new Set<string>();
  const parsed = subnets.map((s) => {
    if (seen.has(s.name.toLowerCase())) throw conflict("DuplicateSubnetName", `Subnet name '${s.name}' is used more than once.`);
    seen.add(s.name.toLowerCase());
    const c = parseCidr(s.addressPrefix);
    if (c.prefix > 29) throw badRequest("InvalidSubnetPrefix", `Subnet ${s.addressPrefix} is too small. The smallest supported subnet is /29.`);
    if (!spaces.some((sp) => cidrContains(sp, c)))
      throw badRequest("NetcfgSubnetRangeOutsideVnet", `Subnet '${s.name}' (${s.addressPrefix}) is not within the virtual network address space (${addressPrefixes.join(", ")}).`);
    return { ...s, c };
  });
  for (let i = 0; i < parsed.length; i++)
    for (let j = i + 1; j < parsed.length; j++)
      if (cidrsOverlap(parsed[i].c, parsed[j].c))
        throw badRequest("NetcfgSubnetRangesOverlap", `Subnet '${parsed[i].name}' (${parsed[i].addressPrefix}) overlaps with subnet '${parsed[j].name}' (${parsed[j].addressPrefix}).`);
}

export async function createVnet(ctx: Ctx, raw: unknown) {
  const input = vnetSchema.parse(raw);
  const subnets = (input.subnets ?? []).map((s) => ({ name: s.name, addressPrefix: parseCidr(s.addressPrefix).text, nsgName: s.nsgName }));
  validateSubnets(input.addressPrefixes, subnets);
  for (const d of input.dnsServers ?? []) validateAddressPrefix(d);
  const vnet = await createResource(ctx, {
    type: T.VNET,
    resourceGroup: input.resourceGroup,
    name: input.name,
    location: input.location,
    tags: input.tags,
    properties: {
      addressSpace: { addressPrefixes: input.addressPrefixes.map((p) => parseCidr(p).text) },
      subnets: subnets.map((s) => ({ name: s.name, addressPrefix: s.addressPrefix, nsgId: null })),
      peerings: [],
      dnsServers: input.dnsServers ?? [],
      enableDdosProtection: false,
    },
  });
  for (const s of subnets) if (s.nsgName) await associateSubnetNsg(ctx, vnet, s.name, s.nsgName);
  return vnet;
}

export async function addSubnet(ctx: Ctx, vnet: Res, raw: unknown) {
  const s = subnetSchema.parse(raw);
  const prefix = parseCidr(s.addressPrefix).text;
  const p = vnet.properties;
  validateSubnets(p.addressSpace.addressPrefixes, [...p.subnets, { name: s.name, addressPrefix: prefix }]);
  let out = await mutate(ctx, vnet, (props) => {
    props.subnets.push({ name: s.name, addressPrefix: prefix, nsgId: null });
  }, "Create or Update Subnet", { subnet: s.name, addressPrefix: prefix });
  if (s.nsgName) out = await associateSubnetNsg(ctx, out, s.name, s.nsgName);
  return out;
}

export async function nicsInSubnet(ctx: Ctx, vnetId: string, subnet?: string) {
  const nics = await listResources(ctx, { type: T.NIC });
  return nics.filter((n) => n.properties.subnet?.vnetId === vnetId && (!subnet || n.properties.subnet?.name.toLowerCase() === subnet.toLowerCase()));
}

export async function deleteSubnet(ctx: Ctx, vnet: Res, subnetName: string) {
  const sub = (vnet.properties.subnets as Props[]).find((s) => s.name.toLowerCase() === subnetName.toLowerCase());
  if (!sub) throw notFound(`Subnet '${subnetName}' not found in virtual network '${vnet.name}'.`);
  const used = await nicsInSubnet(ctx, vnet.id, subnetName);
  if (used.length) throw conflict("InUseSubnetCannotBeDeleted", `Subnet ${subnetName} is in use by ${used.map((n) => n.name).join(", ")} and cannot be deleted.`);
  await removeDependency(vnet.id, `subnet-nsg:${sub.name}`);
  return mutate(ctx, vnet, (props) => {
    props.subnets = props.subnets.filter((s: Props) => s.name !== sub.name);
  }, "Delete Subnet", { subnet: sub.name });
}

export async function associateSubnetNsg(ctx: Ctx, vnet: Res, subnetName: string, nsgName: string | null) {
  const sub = (vnet.properties.subnets as Props[]).find((s) => s.name.toLowerCase() === subnetName.toLowerCase());
  if (!sub) throw notFound(`Subnet '${subnetName}' not found in virtual network '${vnet.name}'.`);
  await removeDependency(vnet.id, `subnet-nsg:${sub.name}`);
  let nsg: Res | null = null;
  if (nsgName) {
    nsg = (await findAnyByName(ctx, T.NSG, nsgName)) ?? null;
    if (!nsg) throw notFound(`Network security group '${nsgName}' was not found.`);
    if (nsg.location !== vnet.location) throw badRequest("NsgLocationMismatch", `NSG '${nsg.name}' is in ${nsg.location} but the virtual network is in ${vnet.location}.`);
    await addDependency(vnet.id, nsg.id, `subnet-nsg:${sub.name}`);
  }
  return mutate(ctx, vnet, (props) => {
    const s = props.subnets.find((x: Props) => x.name === sub.name);
    s.nsgId = nsg?.id ?? null;
    s.nsgName = nsg?.name ?? null;
  }, nsg ? "Associate Network Security Group to Subnet" : "Dissociate Network Security Group from Subnet", { subnet: sub.name, nsg: nsg?.name ?? null });
}

export async function updateAddressSpace(ctx: Ctx, vnet: Res, addressPrefixes: string[]) {
  const normalized = addressPrefixes.map((p) => parseCidr(p).text);
  validateSubnets(normalized, vnet.properties.subnets);
  for (const peer of vnet.properties.peerings as Props[]) {
    const remote = await listResources(ctx, { type: T.VNET }).then((all) => all.find((v) => v.id === peer.remoteVnetId));
    if (remote) assertNoOverlap({ ...vnet, properties: { ...vnet.properties, addressSpace: { addressPrefixes: normalized } } } as Res, remote);
  }
  return mutate(ctx, vnet, (p) => {
    p.addressSpace.addressPrefixes = normalized;
  }, "Update Virtual Network Address Space", { addressPrefixes: normalized });
}

function assertNoOverlap(a: Res, b: Res) {
  for (const x of a.properties.addressSpace.addressPrefixes as string[])
    for (const y of b.properties.addressSpace.addressPrefixes as string[])
      if (cidrsOverlap(parseCidr(x), parseCidr(y)))
        throw badRequest("VnetAddressSpacesOverlap", `Cannot peer '${a.name}' with '${b.name}': address space ${x} overlaps with ${y}.`);
}

export async function addPeering(ctx: Ctx, vnet: Res, raw: unknown) {
  const input = z.object({ name: z.string().min(1).max(80), remoteVnet: z.string().min(1), remoteResourceGroup: z.string().optional(), allowForwardedTraffic: z.boolean().optional() }).parse(raw);
  const remote = input.remoteResourceGroup
    ? await getByName(ctx, T.VNET, input.remoteResourceGroup, input.remoteVnet)
    : await findAnyByName(ctx, T.VNET, input.remoteVnet);
  if (!remote) throw notFound(`Remote virtual network '${input.remoteVnet}' was not found.`);
  if (remote.id === vnet.id) throw badRequest("CannotPeerWithSelf", "A virtual network cannot be peered with itself.");
  assertNoOverlap(vnet, remote);
  if ((vnet.properties.peerings as Props[]).some((p) => p.remoteVnetId === remote.id))
    throw conflict("PeeringExists", `'${vnet.name}' is already peered with '${remote.name}'.`);
  const out = await mutate(ctx, vnet, (p) => {
    p.peerings.push({ name: input.name, remoteVnetId: remote.id, remoteVnetName: remote.name, peeringState: "Connected", allowForwardedTraffic: !!input.allowForwardedTraffic });
  }, "Create Virtual Network Peering", { remote: remote.name });
  await mutate(ctx, remote, (p) => {
    p.peerings.push({ name: `${input.name}-reverse`, remoteVnetId: vnet.id, remoteVnetName: vnet.name, peeringState: "Connected", allowForwardedTraffic: !!input.allowForwardedTraffic });
  }, "Create Virtual Network Peering", { remote: vnet.name });
  await addDependency(vnet.id, remote.id, "peering");
  await addDependency(remote.id, vnet.id, "peering");
  return out;
}

export async function removePeering(ctx: Ctx, vnet: Res, name: string) {
  const peer = (vnet.properties.peerings as Props[]).find((p) => p.name.toLowerCase() === name.toLowerCase());
  if (!peer) throw notFound(`Peering '${name}' not found.`);
  const out = await mutate(ctx, vnet, (p) => {
    p.peerings = p.peerings.filter((x: Props) => x.name !== peer.name);
  }, "Delete Virtual Network Peering", { peering: peer.name });
  await removeDependency(vnet.id, "peering", peer.remoteVnetId);
  const remote = (await listResources(ctx, { type: T.VNET })).find((v) => v.id === peer.remoteVnetId);
  if (remote) {
    await mutate(ctx, remote, (p) => {
      for (const x of p.peerings) if (x.remoteVnetId === vnet.id) x.peeringState = "Disconnected";
    });
    await removeDependency(remote.id, "peering", vnet.id);
  }
  return out;
}

export async function setDnsServers(ctx: Ctx, vnet: Res, servers: string[]) {
  for (const s of servers) validateAddressPrefix(s);
  return mutate(ctx, vnet, (p) => {
    p.dnsServers = servers;
  }, "Update Virtual Network DNS Servers", { dnsServers: servers });
}

// ---------------- NSG ----------------

export const ruleSchema = z.object({
  name: z.string().min(1).max(80).regex(/^[\w.-]+$/, "Rule names may contain letters, digits, '_', '.', '-'"),
  priority: z.coerce.number().int().min(100, "Priority must be between 100 and 4096").max(4096, "Priority must be between 100 and 4096"),
  direction: z.enum(["Inbound", "Outbound"]).default("Inbound"),
  access: z.enum(["Allow", "Deny"]).default("Allow"),
  protocol: z.enum(["Tcp", "Udp", "Icmp", "*"]).default("Tcp"),
  sourceAddressPrefix: z.string().min(1).default("*"),
  sourcePortRange: z.string().min(1).default("*"),
  destinationAddressPrefix: z.string().min(1).default("*"),
  destinationPortRange: z.string().min(1),
  description: z.string().max(140).optional(),
});

export function normalizeProtocol(p: string) {
  const l = p.toLowerCase();
  return l === "tcp" ? "Tcp" : l === "udp" ? "Udp" : l === "icmp" ? "Icmp" : l === "*" || l === "any" ? "*" : p;
}

export async function createNsg(ctx: Ctx, raw: unknown) {
  const input = z.object({ resourceGroup: z.string().min(1), name: z.string().min(1).max(80), location: z.string().optional(), tags: tagsSchema, rules: z.array(ruleSchema).optional() }).parse(raw);
  const nsg = await createResource(ctx, { type: T.NSG, resourceGroup: input.resourceGroup, name: input.name, location: input.location, tags: input.tags, properties: { securityRules: [] } });
  let out = nsg;
  for (const r of input.rules ?? []) out = await addRule(ctx, out, r);
  return out;
}

export async function addRule(ctx: Ctx, nsg: Res, raw: unknown) {
  const rule = ruleSchema.parse(typeof raw === "object" && raw ? { ...raw, protocol: normalizeProtocol(String((raw as Props).protocol ?? "Tcp")) } : raw) as NsgRule;
  validatePortRange(rule.destinationPortRange);
  validatePortRange(rule.sourcePortRange);
  validateAddressPrefix(rule.sourceAddressPrefix);
  validateAddressPrefix(rule.destinationAddressPrefix);
  const rules = nsg.properties.securityRules as NsgRule[];
  if (rules.some((r) => r.name.toLowerCase() === rule.name.toLowerCase()))
    throw conflict("SecurityRuleNameExists", `A security rule named '${rule.name}' already exists. Use update to change it.`);
  const clash = rules.find((r) => r.direction === rule.direction && r.priority === rule.priority);
  if (clash)
    throw conflict("SecurityRuleConflict", `Security rule ${clash.name} conflicts with rule ${rule.name}. Rules cannot have the same Priority and Direction.`);
  return mutate(ctx, nsg, (p) => {
    p.securityRules.push(rule);
  }, "Create or Update Security Rule", { rule });
}

export async function updateRule(ctx: Ctx, nsg: Res, name: string, patch: Props) {
  const rules = nsg.properties.securityRules as NsgRule[];
  const existing = rules.find((r) => r.name.toLowerCase() === name.toLowerCase());
  if (!existing) throw notFound(`Security rule '${name}' not found in NSG '${nsg.name}'.`);
  const merged = ruleSchema.parse({ ...existing, ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined && v !== "")), protocol: normalizeProtocol(String(patch.protocol ?? existing.protocol)) }) as NsgRule;
  validatePortRange(merged.destinationPortRange);
  validatePortRange(merged.sourcePortRange);
  validateAddressPrefix(merged.sourceAddressPrefix);
  validateAddressPrefix(merged.destinationAddressPrefix);
  const clash = rules.find((r) => r.name !== existing.name && r.direction === merged.direction && r.priority === merged.priority);
  if (clash) throw conflict("SecurityRuleConflict", `Security rule ${clash.name} already uses priority ${merged.priority} (${merged.direction}).`);
  return mutate(ctx, nsg, (p) => {
    p.securityRules = p.securityRules.map((r: NsgRule) => (r.name === existing.name ? { ...merged, name: existing.name } : r));
  }, "Create or Update Security Rule", { before: existing, after: merged });
}

export async function deleteRule(ctx: Ctx, nsg: Res, name: string) {
  const rules = nsg.properties.securityRules as NsgRule[];
  const existing = rules.find((r) => r.name.toLowerCase() === name.toLowerCase());
  if (!existing) throw notFound(`Security rule '${name}' not found in NSG '${nsg.name}'.`);
  return mutate(ctx, nsg, (p) => {
    p.securityRules = p.securityRules.filter((r: NsgRule) => r.name !== existing.name);
  }, "Delete Security Rule", { rule: existing });
}

export const flowSchema = z.object({
  direction: z.enum(["Inbound", "Outbound"]).default("Inbound"),
  protocol: z.enum(["Tcp", "Udp", "Icmp"]).default("Tcp"),
  sourceIp: z.string().default("203.0.113.10"),
  sourcePort: z.coerce.number().int().min(0).max(65535).optional(),
  destinationIp: z.string().default("10.0.0.4"),
  destinationPort: z.coerce.number().int().min(0).max(65535),
});

/** IP flow verify against a single NSG. */
export async function evaluateFlow(ctx: Ctx, nsg: Res, raw: unknown) {
  const f = flowSchema.parse(raw);
  const flow: Flow = {
    direction: f.direction as Direction,
    protocol: f.protocol,
    source: { ip: f.sourceIp, inVnet: isPrivateIp(f.sourceIp) },
    sourcePort: f.sourcePort ?? "*",
    destination: { ip: f.destinationIp, inVnet: isPrivateIp(f.destinationIp) },
    destinationPort: f.destinationPort,
  };
  const res = evaluateNsg(nsg.properties.securityRules, flow);
  await logActivity(ctx, nsg, "IP Flow Verify", "Succeeded", { flow: f, access: res.access, rule: res.rule.name });
  return { access: res.access, ruleName: res.rule.name, rule: res.rule };
}

export function publicIpFor(seed: string) {
  const r = seeded(seed);
  return `20.${40 + Math.floor(r() * 180)}.${Math.floor(r() * 255)}.${4 + Math.floor(r() * 250)}`;
}

export async function createPublicIp(ctx: Ctx, raw: unknown, extra: Props = {}) {
  const input = z.object({ resourceGroup: z.string().min(1), name: z.string().min(1).max(80), location: z.string().optional(), sku: z.enum(["Basic", "Standard"]).default("Standard"), allocationMethod: z.enum(["Static", "Dynamic"]).optional(), tags: tagsSchema }).parse(raw);
  return createResource(ctx, {
    type: T.PIP,
    resourceGroup: input.resourceGroup,
    name: input.name,
    location: input.location,
    tags: input.tags,
    properties: { sku: input.sku, publicIPAllocationMethod: input.allocationMethod ?? (input.sku === "Standard" ? "Static" : "Dynamic"), ipAddress: publicIpFor(`${ctx.userId}:${input.resourceGroup}:${input.name}`), ...extra },
  });
}

export async function connectedResources(ctx: Ctx, vnet: Res) {
  const nics = await nicsInSubnet(ctx, vnet.id);
  const deps = await dependentsOf(ctx, vnet.id);
  return { nics, others: deps.filter((d) => d.resource.type !== T.NIC).map((d) => ({ name: d.resource.name, type: d.resource.type, kind: d.kind })) };
}
