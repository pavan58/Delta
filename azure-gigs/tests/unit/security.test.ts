import { describe, it, expect } from "vitest";
import { decrypt, encrypt, sha256 } from "@/lib/security/crypto";
import { rateLimit, resetRateLimits } from "@/lib/security/rateLimit";
import { evalCond, toRegex } from "@/lib/labs/grader";
import { roleAllows, normalizeScope } from "@/lib/sim/services/rbac";
import { LABS } from "@/content/labs";
import { PATHS } from "@/content/paths";

describe("crypto", () => {
  it("round-trips AES-GCM and detects tampering", () => {
    const c = encrypt("super-secret-token");
    expect(c).not.toContain("super-secret");
    expect(decrypt(c)).toBe("super-secret-token");
    const parts = c.split(".");
    parts[2] = Buffer.from("tampered").toString("base64");
    expect(() => decrypt(parts.join("."))).toThrow();
    expect(sha256("x")).toHaveLength(64);
  });
});

describe("rate limiting", () => {
  it("blocks after the limit within a window", () => {
    resetRateLimits();
    for (let i = 0; i < 3; i++) expect(rateLimit("k", 3, 60_000).ok).toBe(true);
    expect(rateLimit("k", 3, 60_000).ok).toBe(false);
  });
});

describe("RBAC role definitions", () => {
  it("applies actions, notActions and data actions", () => {
    expect(roleAllows("Owner", "Microsoft.Authorization/roleAssignments/write")).toBe(true);
    expect(roleAllows("Contributor", "Microsoft.Authorization/roleAssignments/write")).toBe(false);
    expect(roleAllows("Reader", "Microsoft.Compute/virtualMachines/read")).toBe(true);
    expect(roleAllows("Reader", "Microsoft.Compute/virtualMachines/write")).toBe(false);
    expect(roleAllows("Storage Account Contributor", "Microsoft.Storage/storageAccounts/blobServices/containers/blobs/read")).toBe(false);
    expect(roleAllows("Storage Blob Data Reader", "Microsoft.Storage/storageAccounts/blobServices/containers/blobs/read")).toBe(true);
    expect(normalizeScope("/subscriptions/abc/resourceGroups/RG1/")).toBe("/resourcegroups/rg1");
  });
});

describe("grader conditions", () => {
  const r = { name: "x", properties: { list: [{ a: 1, b: "Hot" }], n: 5 }, tags: { env: "dev" } };
  it("evaluates nested conditions", () => {
    expect(evalCond(r, { path: "tags.env", op: "eq", value: "DEV" })).toBe(true);
    expect(evalCond(r, { path: "properties.list", op: "some", where: [{ path: "b", op: "eq", value: "hot" }] })).toBe(true);
    expect(evalCond(r, { path: "properties.list", op: "none", where: [{ path: "a", op: "eq", value: 1 }] })).toBe(false);
    expect(evalCond(r, { path: "properties.n", op: "gte", value: 5 })).toBe(true);
    expect(evalCond(r, { path: "missing", op: "notExists" })).toBe(true);
    expect(toRegex("(?i)JOIN").test("left join")).toBe(true);
  });
});

describe("content library", () => {
  it("has at least 100 labs with every required section", () => {
    expect(LABS.length).toBeGreaterThanOrEqual(100);
    for (const l of LABS) {
      expect(l.title && l.objective && l.scenario && l.expectedOutcome && l.solution, l.slug).toBeTruthy();
      expect(l.steps.length, l.slug).toBeGreaterThan(0);
      expect(l.hints.length, l.slug).toBeGreaterThan(0);
      expect(l.interviewQuestions.length, l.slug).toBeGreaterThan(0);
      for (const cat of ["configuration", "execution", "security", "documentation"]) expect(l.checks.some((c) => c.category === cat), `${l.slug} ${cat}`).toBe(true);
    }
    expect(LABS.filter((l) => l.difficulty === "Beginner").length).toBeGreaterThan(15);
    expect(LABS.filter((l) => l.difficulty === "Advanced").length).toBeGreaterThan(15);
  });
  it("has 7 learning paths with assessments and capstones referenced", () => {
    expect(PATHS).toHaveLength(7);
    const capstones = LABS.filter((l) => l.isCapstone).map((l) => l.slug);
    expect(capstones).toHaveLength(6);
    const referenced = new Set(PATHS.flatMap((p) => p.modules.flatMap((m) => m.labs)));
    for (const c of capstones) expect(referenced.has(c), c).toBe(true);
  });
});
