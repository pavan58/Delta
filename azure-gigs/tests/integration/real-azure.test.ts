import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { newLearner } from "../helpers";
import { buildAuthorizeUrl, completeOAuth, createStorageAccount, deleteResourceGroup, listAccounts, listSubscriptions, realAzureConfigured } from "@/lib/azure/real";
import { prisma } from "@/lib/db";

const fakeJwt = (claims: object) => `x.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.y`;

describe("Real Azure Mode (Microsoft endpoints mocked)", () => {
  beforeAll(() => {
    process.env.AZURE_AD_CLIENT_ID = "00000000-0000-0000-0000-000000000001";
    process.env.AZURE_AD_CLIENT_SECRET = "test-secret";
    process.env.APP_URL = "http://localhost:3000";
  });
  afterEach(() => vi.unstubAllGlobals());

  it("builds a PKCE authorization URL with least-privilege scope", () => {
    expect(realAzureConfigured()).toBe(true);
    const { url, state, verifier } = buildAuthorizeUrl();
    const u = new URL(url);
    expect(u.searchParams.get("code_challenge_method")).toBe("S256");
    expect(u.searchParams.get("scope")).toContain("https://management.azure.com/user_impersonation");
    expect(u.searchParams.get("state")).toBe(state);
    expect(u.toString()).not.toContain(verifier);
    expect(u.toString()).not.toContain("test-secret");
  });

  it("stores tokens encrypted and calls ARM with the bearer token", async () => {
    const { user } = await newLearner();
    const access = fakeJwt({ tid: "tenant-1", upn: "learner@contoso.com" });
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/oauth2/v2.0/token")) return new Response(JSON.stringify({ access_token: access, refresh_token: "refresh-1", expires_in: 3600 }), { status: 200 });
      if (url.includes("/subscriptions?")) {
        expect((init?.headers as Record<string, string>).authorization).toBe(`Bearer ${access}`);
        return new Response(JSON.stringify({ value: [{ subscriptionId: "11111111-1111-1111-1111-111111111111", displayName: "Pay-As-You-Go", state: "Enabled" }] }), { status: 200 });
      }
      if (init?.method === "DELETE") return new Response("", { status: 202 });
      if (init?.method === "PUT") return new Response(JSON.stringify({ id: "x" }), { status: 200 });
      return new Response("{}", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    await completeOAuth(user.id, "code-1", "verifier-1");
    const row = await prisma.connectedAzureAccount.findFirstOrThrow({ where: { userId: user.id } });
    expect(row.encryptedAccessToken).not.toContain(access);
    expect(row.encryptedRefreshToken).not.toContain("refresh-1");
    const [acc] = await listAccounts(user.id);
    expect(acc).toMatchObject({ tenantId: "tenant-1", accountUpn: "learner@contoso.com" });
    expect(JSON.stringify(acc)).not.toContain("encrypted");
    const subs = await listSubscriptions(user.id, acc.id);
    expect(subs[0].displayName).toBe("Pay-As-You-Go");

    const subId = "11111111-1111-1111-1111-111111111111";
    await expect(createStorageAccount(user.id, acc.id, { subscriptionId: subId, resourceGroup: "rg1", name: "stgigs1", location: "eastus" })).rejects.toThrow(/confirm the estimated cost/);
    await createStorageAccount(user.id, acc.id, { subscriptionId: subId, resourceGroup: "rg1", name: "stgigs1", location: "eastus", confirmCost: true });
    await expect(deleteResourceGroup(user.id, acc.id, { subscriptionId: subId, name: "rg1", confirmName: "rg2" })).rejects.toThrow(/Type the resource group name/);
    expect(await deleteResourceGroup(user.id, acc.id, { subscriptionId: subId, name: "rg1", confirmName: "rg1" })).toEqual({ accepted: true });
    const audit = await prisma.auditLog.findMany({ where: { userId: user.id } });
    expect(audit.map((a) => a.action)).toEqual(expect.arrayContaining(["azure.connect", "azure.storage.create", "azure.rg.delete"]));
  });

  it("does not let one learner use another learner's connected account", async () => {
    const a = await newLearner();
    const b = await newLearner();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ access_token: fakeJwt({ tid: "t2", upn: "a@x" }), expires_in: 3600 }), { status: 200 })));
    await completeOAuth(a.user.id, "c", "v");
    const [acc] = await listAccounts(a.user.id);
    await expect(listSubscriptions(b.user.id, acc.id)).rejects.toThrow(/not found/);
  });
});
