/**
 * Real Azure Mode: delegated OAuth (authorization code + PKCE) against Microsoft Entra ID and
 * Azure Resource Manager REST calls made on the learner's behalf. Tokens are AES-256-GCM encrypted at rest.
 * No client secret or token is ever sent to the browser.
 */
import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError, badRequest, notFound } from "@/lib/errors";
import { decrypt, encrypt, randomToken } from "@/lib/security/crypto";

const ARM = "https://management.azure.com";
const SCOPE = "https://management.azure.com/user_impersonation offline_access openid profile";

export function realAzureConfigured() {
  return !!(process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_CLIENT_SECRET && process.env.APP_URL);
}

function cfg() {
  if (!realAzureConfigured()) throw new AppError(503, "RealAzureNotConfigured", "Real Azure Mode is not configured on this server (AZURE_AD_CLIENT_ID, AZURE_AD_CLIENT_SECRET and APP_URL are required).");
  return { clientId: process.env.AZURE_AD_CLIENT_ID!, clientSecret: process.env.AZURE_AD_CLIENT_SECRET!, tenant: process.env.AZURE_AD_TENANT ?? "organizations", redirectUri: `${process.env.APP_URL!.replace(/\/$/, "")}/api/azure/callback` };
}

export function buildAuthorizeUrl() {
  const c = cfg();
  const state = randomToken(24);
  const verifier = randomToken(48);
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const url = new URL(`https://login.microsoftonline.com/${c.tenant}/oauth2/v2.0/authorize`);
  url.search = new URLSearchParams({ client_id: c.clientId, response_type: "code", redirect_uri: c.redirectUri, response_mode: "query", scope: SCOPE, state, code_challenge: challenge, code_challenge_method: "S256", prompt: "select_account" }).toString();
  return { url: url.toString(), state, verifier };
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
  } catch {
    return {};
  }
}

async function tokenRequest(params: Record<string, string>) {
  const c = cfg();
  const res = await fetch(`https://login.microsoftonline.com/${c.tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: c.clientId, client_secret: c.clientSecret, scope: SCOPE, ...params }).toString(),
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, string | number>;
  if (!res.ok) throw new AppError(400, "TokenExchangeFailed", String(body.error_description ?? body.error ?? "Token exchange failed").split("\r\n")[0]);
  return body as { access_token: string; refresh_token?: string; expires_in: number; id_token?: string };
}

export async function completeOAuth(userId: string, code: string, verifier: string) {
  const c = cfg();
  const t = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: c.redirectUri, code_verifier: verifier });
  const claims = decodeJwtPayload(t.access_token);
  const tenantId = String(claims.tid ?? "unknown");
  const upn = String(claims.upn ?? claims.unique_name ?? claims.preferred_username ?? "unknown");
  const data = { accountUpn: upn, encryptedAccessToken: encrypt(t.access_token), encryptedRefreshToken: t.refresh_token ? encrypt(t.refresh_token) : null, accessTokenExpiresAt: new Date(Date.now() + (t.expires_in - 60) * 1000) };
  await prisma.connectedAzureAccount.upsert({ where: { userId_tenantId: { userId, tenantId } }, create: { userId, tenantId, ...data }, update: data });
  await prisma.auditLog.create({ data: { userId, action: "azure.connect", details: { tenantId, upn } } });
}

async function accessToken(userId: string, accountId: string) {
  const acc = await prisma.connectedAzureAccount.findFirst({ where: { id: accountId, userId } });
  if (!acc) throw notFound("Connected Azure account not found.");
  if (acc.accessTokenExpiresAt > new Date()) return decrypt(acc.encryptedAccessToken);
  if (!acc.encryptedRefreshToken) throw new AppError(401, "ReauthenticationRequired", "Your Azure session expired. Reconnect your account.");
  const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: decrypt(acc.encryptedRefreshToken) });
  await prisma.connectedAzureAccount.update({ where: { id: acc.id }, data: { encryptedAccessToken: encrypt(t.access_token), encryptedRefreshToken: t.refresh_token ? encrypt(t.refresh_token) : acc.encryptedRefreshToken, accessTokenExpiresAt: new Date(Date.now() + (t.expires_in - 60) * 1000) } });
  return t.access_token;
}

async function arm(userId: string, accountId: string, method: string, path: string, body?: unknown) {
  if (!/^\/subscriptions(\/[A-Za-z0-9-]+)?(\/[A-Za-z0-9._()\-/]*)?(\?.*)?$/.test(path.split("?")[0] + (path.includes("?") ? "?" : ""))) throw badRequest("InvalidPath", "Unsupported ARM path.");
  const token = await accessToken(userId, accountId);
  const res = await fetch(`${ARM}${path}`, { method, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  const json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  if (!res.ok) {
    const err = (json.error ?? {}) as Record<string, string>;
    throw new AppError(res.status, err.code ?? "AzureRequestFailed", err.message ?? `Azure returned HTTP ${res.status}`);
  }
  return json;
}

const guid = z.string().regex(/^[0-9a-f-]{36}$/i, "Invalid subscription id");
const rgName = z.string().regex(/^[-\w._()]{1,90}$/, "Invalid resource group name");

export async function listAccounts(userId: string) {
  return (await prisma.connectedAzureAccount.findMany({ where: { userId } })).map((a) => ({ id: a.id, tenantId: a.tenantId, accountUpn: a.accountUpn, connectedAt: a.createdAt, defaultSubscriptionId: a.defaultSubscriptionId }));
}

export async function disconnect(userId: string, accountId: string) {
  await prisma.connectedAzureAccount.deleteMany({ where: { id: accountId, userId } });
  await prisma.auditLog.create({ data: { userId, action: "azure.disconnect", details: { accountId } } });
}

export async function listSubscriptions(userId: string, accountId: string) {
  const r = await arm(userId, accountId, "GET", "/subscriptions?api-version=2022-12-01");
  return ((r.value ?? []) as Record<string, string>[]).map((s) => ({ subscriptionId: s.subscriptionId, displayName: s.displayName, state: s.state }));
}

export async function listResourceGroups(userId: string, accountId: string, subscriptionId: string) {
  guid.parse(subscriptionId);
  const r = await arm(userId, accountId, "GET", `/subscriptions/${subscriptionId}/resourcegroups?api-version=2021-04-01`);
  return ((r.value ?? []) as Record<string, unknown>[]).map((g) => ({ name: g.name, location: g.location, tags: g.tags ?? {}, provisioningState: (g.properties as Record<string, string>)?.provisioningState }));
}

export async function listResources(userId: string, accountId: string, subscriptionId: string, resourceGroup: string) {
  guid.parse(subscriptionId);
  rgName.parse(resourceGroup);
  const r = await arm(userId, accountId, "GET", `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/resources?api-version=2021-04-01`);
  return ((r.value ?? []) as Record<string, unknown>[]).map((x) => ({ id: x.id, name: x.name, type: x.type, location: x.location, sku: x.sku ?? null }));
}

export async function createResourceGroup(userId: string, accountId: string, raw: unknown) {
  const input = z.object({ subscriptionId: guid, name: rgName, location: z.string().regex(/^[a-z0-9]+$/), tags: z.record(z.string(), z.string()).optional() }).parse(raw);
  const r = await arm(userId, accountId, "PUT", `/subscriptions/${input.subscriptionId}/resourcegroups/${input.name}?api-version=2021-04-01`, { location: input.location, tags: { ...input.tags, createdBy: "azure-gigs" } });
  await prisma.auditLog.create({ data: { userId, action: "azure.rg.create", details: input } });
  return r;
}

/** Retail Prices API (public, unauthenticated) - used to show an estimate before chargeable deployments. */
export async function estimateStorageMonthly(location: string, sku: string) {
  const [tier, red] = sku.split("_");
  const filter = `serviceName eq 'Storage' and armRegionName eq '${location}' and skuName eq '${tier === "Premium" ? "Premium" : "Hot"} ${red}' and meterName eq '${tier === "Premium" ? "Premium" : "Hot"} ${red} Data Stored' and priceType eq 'Consumption'`;
  try {
    const res = await fetch(`https://prices.azure.com/api/retail/prices?$filter=${encodeURIComponent(filter)}`);
    const j = (await res.json()) as { Items?: { retailPrice: number; unitOfMeasure: string }[] };
    const item = j.Items?.[0];
    if (item) return { perGbMonth: item.retailPrice, unit: item.unitOfMeasure, source: "Azure Retail Prices API", example10GB: Math.round(item.retailPrice * 10 * 100) / 100 };
  } catch {
    /* fall through */
  }
  return { perGbMonth: 0.02, unit: "1 GB/Month", source: "fallback estimate (Retail Prices API unreachable)", example10GB: 0.2 };
}

export async function createStorageAccount(userId: string, accountId: string, raw: unknown) {
  const input = z.object({ subscriptionId: guid, resourceGroup: rgName, name: z.string().regex(/^[a-z0-9]{3,24}$/), location: z.string().regex(/^[a-z0-9]+$/), sku: z.enum(["Standard_LRS", "Standard_ZRS", "Standard_GRS"]).default("Standard_LRS"), confirmCost: z.literal(true, { message: "You must explicitly confirm the estimated cost before provisioning chargeable resources." }) }).parse(raw);
  const r = await arm(userId, accountId, "PUT", `/subscriptions/${input.subscriptionId}/resourceGroups/${input.resourceGroup}/providers/Microsoft.Storage/storageAccounts/${input.name}?api-version=2023-05-01`, {
    location: input.location,
    sku: { name: input.sku },
    kind: "StorageV2",
    properties: { minimumTlsVersion: "TLS1_2", allowBlobPublicAccess: false, supportsHttpsTrafficOnly: true },
    tags: { createdBy: "azure-gigs" },
  });
  await prisma.auditLog.create({ data: { userId, action: "azure.storage.create", details: { ...input } } });
  return r;
}

export async function deleteResourceGroup(userId: string, accountId: string, raw: unknown) {
  const input = z.object({ subscriptionId: guid, name: rgName, confirmName: z.string() }).parse(raw);
  if (input.confirmName !== input.name) throw badRequest("ConfirmationMismatch", "Type the resource group name exactly to confirm deletion.");
  await arm(userId, accountId, "DELETE", `/subscriptions/${input.subscriptionId}/resourcegroups/${input.name}?api-version=2021-04-01`);
  await prisma.auditLog.create({ data: { userId, action: "azure.rg.delete", details: input } });
  return { accepted: true };
}

export async function resourceMetrics(userId: string, accountId: string, resourceId: string, metric: string) {
  if (!/^\/subscriptions\/[0-9a-f-]{36}\/resourceGroups\/[-\w._()]+\/providers\/[\w./-]+$/i.test(resourceId)) throw badRequest("InvalidResourceId", "Invalid resource id.");
  return arm(userId, accountId, "GET", `${resourceId}/providers/microsoft.insights/metrics?api-version=2023-10-01&metricnames=${encodeURIComponent(metric)}&interval=PT5M`);
}
