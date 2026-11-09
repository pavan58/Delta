import { describe, it, expect } from "vitest";
import { allocateIp, cidrsOverlap, evaluateNsg, parseCidr, validatePortRange, NsgRule } from "@/lib/sim/net";

describe("CIDR utilities", () => {
  it("parses and rejects misaligned networks", () => {
    expect(parseCidr("10.0.0.0/16").size).toBe(65536);
    expect(() => parseCidr("10.0.1.0/22")).toThrow(/Did you mean 10.0.0.0\/22/);
    expect(() => parseCidr("300.0.0.0/8")).toThrow();
  });
  it("detects overlaps", () => {
    expect(cidrsOverlap(parseCidr("10.0.0.0/24"), parseCidr("10.0.0.128/25"))).toBe(true);
    expect(cidrsOverlap(parseCidr("10.0.0.0/24"), parseCidr("10.0.1.0/24"))).toBe(false);
  });
  it("allocates IPs skipping Azure-reserved addresses", () => {
    expect(allocateIp("10.0.1.0/24", [])).toBe("10.0.1.4");
    expect(allocateIp("10.0.1.0/24", ["10.0.1.4", "10.0.1.5"])).toBe("10.0.1.6");
    const full = Array.from({ length: 3 }, (_, i) => `10.0.0.${4 + i}`);
    expect(() => allocateIp("10.0.0.0/29", full)).toThrow(/no free IP/);
  });
  it("validates port ranges", () => {
    expect(() => validatePortRange("80,443,8000-8080")).not.toThrow();
    expect(() => validatePortRange("70000")).toThrow();
    expect(() => validatePortRange("abc")).toThrow();
  });
});

describe("NSG evaluation", () => {
  const rule = (p: Partial<NsgRule>): NsgRule => ({ name: "r", priority: 100, direction: "Inbound", access: "Allow", protocol: "Tcp", sourceAddressPrefix: "*", sourcePortRange: "*", destinationAddressPrefix: "*", destinationPortRange: "80", ...p });
  const flow = { direction: "Inbound" as const, protocol: "Tcp" as const, source: { ip: "203.0.113.5", inVnet: false }, sourcePort: "*" as const, destination: { ip: "10.0.0.4", inVnet: true }, destinationPort: 80 };
  it("lowest priority number wins", () => {
    const r = evaluateNsg([rule({ name: "allow", priority: 200 }), rule({ name: "deny", priority: 110, access: "Deny" })], flow);
    expect(r).toMatchObject({ access: "Deny", rule: { name: "deny" } });
  });
  it("falls through to DenyAllInBound", () => {
    expect(evaluateNsg([], flow).rule.name).toBe("DenyAllInBound");
  });
  it("matches service tags", () => {
    expect(evaluateNsg([rule({ sourceAddressPrefix: "Internet" })], flow).access).toBe("Allow");
    expect(evaluateNsg([rule({ sourceAddressPrefix: "VirtualNetwork" })], flow).rule.name).toBe("DenyAllInBound");
    expect(evaluateNsg([], { ...flow, source: { ip: "10.0.0.9", inVnet: true } }).rule.name).toBe("AllowVnetInBound");
  });
  it("matches CIDR sources and port lists", () => {
    const rules = [rule({ sourceAddressPrefix: "203.0.113.0/24", destinationPortRange: "22,80" })];
    expect(evaluateNsg(rules, flow).access).toBe("Allow");
    expect(evaluateNsg(rules, { ...flow, source: { ip: "198.51.100.1", inVnet: false } }).access).toBe("Deny");
  });
});
