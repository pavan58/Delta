/** IPv4/CIDR helpers and the NSG evaluation engine (Azure semantics: lowest priority number wins). */
import { badRequest } from "@/lib/errors";

export function ipToInt(ip: string): number {
  const parts = ip.split(".");
  if (parts.length !== 4) throw badRequest("InvalidIp", `'${ip}' is not a valid IPv4 address.`);
  return parts.reduce((acc, p) => {
    const n = Number(p);
    if (!/^\d{1,3}$/.test(p) || n > 255) throw badRequest("InvalidIp", `'${ip}' is not a valid IPv4 address.`);
    return acc * 256 + n;
  }, 0);
}
export const intToIp = (n: number) => [24, 16, 8, 0].map((s) => Math.floor(n / 2 ** s) % 256).join(".");

export type Cidr = { base: number; prefix: number; size: number; text: string };

export function parseCidr(text: string): Cidr {
  const m = /^(\d+\.\d+\.\d+\.\d+)\/(\d{1,2})$/.exec(text.trim());
  if (!m) throw badRequest("InvalidAddressPrefix", `'${text}' is not a valid CIDR block (e.g. 10.0.0.0/16).`);
  const prefix = Number(m[2]);
  if (prefix > 32) throw badRequest("InvalidAddressPrefix", `Prefix length /${prefix} is invalid.`);
  const ip = ipToInt(m[1]);
  const size = 2 ** (32 - prefix);
  if (ip % size !== 0) {
    throw badRequest("InvalidAddressPrefix", `'${text}' is not a valid network address. Did you mean ${intToIp(ip - (ip % size))}/${prefix}?`);
  }
  return { base: ip, prefix, size, text: `${m[1]}/${prefix}` };
}

export const cidrsOverlap = (a: Cidr, b: Cidr) => a.base < b.base + b.size && b.base < a.base + a.size;
export const cidrContains = (outer: Cidr, inner: Cidr) => inner.base >= outer.base && inner.base + inner.size <= outer.base + outer.size;
export const ipInCidr = (ip: string, c: Cidr) => {
  const n = ipToInt(ip);
  return n >= c.base && n < c.base + c.size;
};

export function isPrivateIp(ip: string) {
  return ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"].some((c) => ipInCidr(ip, parseCidr(c)));
}

/** Azure reserves the first four and the last address of each subnet. */
export function allocateIp(subnetPrefix: string, used: string[]): string {
  const c = parseCidr(subnetPrefix);
  const usedSet = new Set(used);
  for (let n = c.base + 4; n < c.base + c.size - 1; n++) {
    const ip = intToIp(n);
    if (!usedSet.has(ip)) return ip;
  }
  throw badRequest("SubnetIsFull", `Subnet ${subnetPrefix} has no free IP addresses.`);
}

export type Direction = "Inbound" | "Outbound";
export type Access = "Allow" | "Deny";
export type NsgRule = {
  name: string;
  priority: number;
  direction: Direction;
  access: Access;
  protocol: "Tcp" | "Udp" | "Icmp" | "*";
  sourceAddressPrefix: string;
  sourcePortRange: string;
  destinationAddressPrefix: string;
  destinationPortRange: string;
  description?: string;
};

export const DEFAULT_RULES: NsgRule[] = [
  { name: "AllowVnetInBound", priority: 65000, direction: "Inbound", access: "Allow", protocol: "*", sourceAddressPrefix: "VirtualNetwork", sourcePortRange: "*", destinationAddressPrefix: "VirtualNetwork", destinationPortRange: "*" },
  { name: "AllowAzureLoadBalancerInBound", priority: 65001, direction: "Inbound", access: "Allow", protocol: "*", sourceAddressPrefix: "AzureLoadBalancer", sourcePortRange: "*", destinationAddressPrefix: "*", destinationPortRange: "*" },
  { name: "DenyAllInBound", priority: 65500, direction: "Inbound", access: "Deny", protocol: "*", sourceAddressPrefix: "*", sourcePortRange: "*", destinationAddressPrefix: "*", destinationPortRange: "*" },
  { name: "AllowVnetOutBound", priority: 65000, direction: "Outbound", access: "Allow", protocol: "*", sourceAddressPrefix: "VirtualNetwork", sourcePortRange: "*", destinationAddressPrefix: "VirtualNetwork", destinationPortRange: "*" },
  { name: "AllowInternetOutBound", priority: 65001, direction: "Outbound", access: "Allow", protocol: "*", sourceAddressPrefix: "*", sourcePortRange: "*", destinationAddressPrefix: "Internet", destinationPortRange: "*" },
  { name: "DenyAllOutBound", priority: 65500, direction: "Outbound", access: "Deny", protocol: "*", sourceAddressPrefix: "*", sourcePortRange: "*", destinationAddressPrefix: "*", destinationPortRange: "*" },
];

const SERVICE_TAGS = ["*", "Any", "Internet", "VirtualNetwork", "AzureLoadBalancer"];

export function validatePortRange(r: string) {
  for (const part of r.split(",").map((s) => s.trim())) {
    if (part === "*") continue;
    const m = /^(\d+)(?:-(\d+))?$/.exec(part);
    if (!m) throw badRequest("InvalidPortRange", `'${r}' is not a valid port range. Use *, 80, 8000-8080 or 80,443.`);
    const lo = Number(m[1]), hi = Number(m[2] ?? m[1]);
    if (lo < 0 || hi > 65535 || lo > hi) throw badRequest("InvalidPortRange", `Port range '${part}' must be within 0-65535.`);
  }
}

export function validateAddressPrefix(p: string) {
  for (const part of p.split(",").map((s) => s.trim())) {
    if (SERVICE_TAGS.some((t) => t.toLowerCase() === part.toLowerCase())) continue;
    if (part.includes("/")) parseCidr(part);
    else ipToInt(part);
  }
}

function portMatches(range: string, port: number | "*") {
  if (port === "*") return true;
  return range.split(",").some((part) => {
    part = part.trim();
    if (part === "*") return true;
    const [lo, hi] = part.split("-").map(Number);
    return port >= lo && port <= (hi ?? lo);
  });
}

export type Endpoint = { ip: string; inVnet: boolean; isLoadBalancer?: boolean };

function addressMatches(prefix: string, ep: Endpoint) {
  return prefix.split(",").some((raw) => {
    const p = raw.trim();
    const lower = p.toLowerCase();
    if (lower === "*" || lower === "any") return true;
    if (lower === "virtualnetwork") return ep.inVnet;
    if (lower === "internet") return !ep.inVnet && !isPrivateIp(ep.ip);
    if (lower === "azureloadbalancer") return !!ep.isLoadBalancer;
    if (p.includes("/")) return ipInCidr(ep.ip, parseCidr(p));
    return p === ep.ip;
  });
}

export type Flow = {
  direction: Direction;
  protocol: "Tcp" | "Udp" | "Icmp";
  source: Endpoint;
  sourcePort: number | "*";
  destination: Endpoint;
  destinationPort: number;
};

export function evaluateNsg(rules: NsgRule[], flow: Flow): { access: Access; rule: NsgRule } {
  const ordered = [...rules, ...DEFAULT_RULES]
    .filter((r) => r.direction === flow.direction)
    .sort((a, b) => a.priority - b.priority);
  for (const r of ordered) {
    if (r.protocol !== "*" && r.protocol.toLowerCase() !== flow.protocol.toLowerCase()) continue;
    if (!addressMatches(r.sourceAddressPrefix, flow.source)) continue;
    if (!addressMatches(r.destinationAddressPrefix, flow.destination)) continue;
    if (!portMatches(r.sourcePortRange, flow.sourcePort)) continue;
    if (!portMatches(r.destinationPortRange, flow.destinationPort)) continue;
    return { access: r.access, rule: r };
  }
  /* istanbul ignore next */
  return { access: "Deny", rule: DEFAULT_RULES[2] };
}
