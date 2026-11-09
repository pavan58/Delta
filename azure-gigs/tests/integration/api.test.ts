import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as login } from "@/app/api/auth/login/route";
import { GET as listResources, POST as createResource } from "@/app/api/resources/route";
import { GET as getResource, DELETE as deleteResource } from "@/app/api/resources/[id]/route";
import { POST as runAction } from "@/app/api/resources/[id]/actions/[action]/route";
import { resetRateLimits } from "@/lib/security/rateLimit";
import { prisma } from "@/lib/db";

const BASE = "http://localhost:3000";
function req(path: string, init: { method?: string; body?: unknown; cookie?: string; origin?: string } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json", host: "localhost:3000" };
  if (init.cookie) headers.cookie = init.cookie;
  if (init.origin) headers.origin = init.origin;
  return new NextRequest(`${BASE}${path}`, { method: init.method ?? (init.body ? "POST" : "GET"), headers, body: init.body ? JSON.stringify(init.body) : undefined });
}
const p = <T,>(v: T) => ({ params: Promise.resolve(v) });

async function signUp() {
  const email = `api-${randomUUID().slice(0, 8)}@example.com`;
  const r = await register(req("/api/auth/register", { body: { name: "Api Learner", email, password: "Api-Passw0rd-1" }, origin: BASE }));
  expect(r.status).toBe(201);
  const cookie = r.headers.get("set-cookie")!.split(";")[0];
  return { email, cookie };
}

describe("API: authentication, CSRF and isolation", () => {
  beforeEach(() => resetRateLimits());

  it("registers, rejects duplicates and weak passwords, and logs in", async () => {
    const { email } = await signUp();
    const dup = await register(req("/api/auth/register", { body: { name: "Again", email, password: "Api-Passw0rd-1" } }));
    expect(dup.status).toBe(409);
    const weak = await register(req("/api/auth/register", { body: { name: "Weak", email: "weak@example.com", password: "short" } }));
    expect(weak.status).toBe(400);
    const bad = await login(req("/api/auth/login", { body: { email, password: "wrong-password-1" } }));
    expect(bad.status).toBe(401);
    const ok = await login(req("/api/auth/login", { body: { email, password: "Api-Passw0rd-1" } }));
    expect(ok.status).toBe(200);
    expect(ok.headers.get("set-cookie")).toMatch(/ag_session=.*HttpOnly/i);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.passwordHash).not.toContain("Api-Passw0rd-1");
    const session = await prisma.session.findFirstOrThrow({ where: { userId: user.id } });
    expect(ok.headers.get("set-cookie")).not.toContain(session.tokenHash);
  });

  it("rejects unauthenticated and cross-origin requests", async () => {
    expect((await listResources(req("/api/resources"), p({}))).status).toBe(401);
    const { cookie } = await signUp();
    const cross = await createResource(req("/api/resources", { body: { type: "Microsoft.Resources/resourceGroups", input: { name: "rg-x", location: "eastus" } }, cookie, origin: "https://evil.example" }), p({}));
    expect(cross.status).toBe(403);
    const same = await createResource(req("/api/resources", { body: { type: "Microsoft.Resources/resourceGroups", input: { name: "rg-x", location: "eastus" } }, cookie, origin: BASE }), p({}));
    expect(same.status).toBe(201);
  });

  it("validates input and returns Azure-style errors", async () => {
    const { cookie } = await signUp();
    const r = await createResource(req("/api/resources", { body: { type: "Microsoft.Resources/resourceGroups", input: { name: "rg-bad", location: "mars" } }, cookie }), p({}));
    expect(r.status).toBe(400);
    expect((await r.json()).error.code).toBe("LocationNotAvailableForResourceType");
    const sa = await createResource(req("/api/resources", { body: { type: "Microsoft.Storage/storageAccounts", input: { resourceGroup: "nope", name: "Bad_Name" } }, cookie }), p({}));
    expect(sa.status).toBe(400);
  });

  it("prevents one learner from reading, changing or deleting another learner's resources", async () => {
    const a = await signUp();
    const b = await signUp();
    const created = await createResource(req("/api/resources", { body: { type: "Microsoft.Resources/resourceGroups", input: { name: "rg-a", location: "eastus" } }, cookie: a.cookie }), p({}));
    const { resource } = await created.json();
    expect((await getResource(req(`/api/resources/${resource.id}`, { cookie: b.cookie }), p({ id: resource.id }))).status).toBe(404);
    expect((await deleteResource(req(`/api/resources/${resource.id}`, { method: "DELETE", cookie: b.cookie }), p({ id: resource.id }))).status).toBe(404);
    const list = await (await listResources(req("/api/resources?type=Microsoft.Resources/resourceGroups", { cookie: b.cookie }), p({}))).json();
    expect(list.resources).toEqual([]);
    expect((await getResource(req(`/api/resources/${resource.id}`, { cookie: a.cookie }), p({ id: resource.id }))).status).toBe(200);
  });

  it("never returns Key Vault secret material in resource views", async () => {
    const { cookie } = await signUp();
    await createResource(req("/api/resources", { body: { type: "Microsoft.Resources/resourceGroups", input: { name: "rg-kv", location: "eastus" } }, cookie }), p({}));
    const kv = (await (await createResource(req("/api/resources", { body: { type: "Microsoft.KeyVault/vaults", input: { resourceGroup: "rg-kv", name: `kv-${randomUUID().slice(0, 6)}` } }, cookie }), p({}))).json()).resource;
    const set = await runAction(req(`/api/resources/${kv.id}/actions/setSecret`, { body: { name: "DbPassword", value: "TopSecretValue123" }, cookie }), p({ id: kv.id, action: "setSecret" }));
    expect(JSON.stringify(await set.json())).not.toContain("TopSecretValue123");
    const detail = await (await getResource(req(`/api/resources/${kv.id}`, { cookie }), p({ id: kv.id }))).json();
    expect(JSON.stringify(detail)).not.toContain("TopSecretValue123");
    const stored = await prisma.simulatedResource.findUniqueOrThrow({ where: { id: kv.id } });
    expect(JSON.stringify(stored.properties)).not.toContain("TopSecretValue123");
    const got = await (await runAction(req(`/api/resources/${kv.id}/actions/getSecret`, { body: { name: "DbPassword" }, cookie }), p({ id: kv.id, action: "getSecret" }))).json();
    expect(got.result.value).toBe("TopSecretValue123");
  });
});
