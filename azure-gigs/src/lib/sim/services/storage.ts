import { z } from "zod";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { createResource, Ctx, findAnyByName, logActivity, mutate, Props, Res } from "../engine";
import { STORAGE_SKUS } from "../catalog";
import { T } from "../types";
import { checkAccess } from "./rbac";

export const MAX_BLOB_BYTES = 256 * 1024;
export const MAX_ACCOUNT_BYTES = 5 * 1024 * 1024;

export const storageSchema = z.object({
  resourceGroup: z.string().min(1),
  name: z.string().min(3).max(24),
  location: z.string().optional(),
  sku: z.string().default("Standard_LRS"),
  kind: z.enum(["StorageV2", "BlobStorage", "FileStorage", "BlockBlobStorage"]).default("StorageV2"),
  accessTier: z.enum(["Hot", "Cool", "Cold"]).default("Hot"),
  allowBlobPublicAccess: z.boolean().default(false),
  minimumTlsVersion: z.enum(["TLS1_0", "TLS1_1", "TLS1_2"]).default("TLS1_2"),
  httpsOnly: z.boolean().default(true),
  allowSharedKeyAccess: z.boolean().default(true),
  tags: z.record(z.string(), z.string()).optional(),
});

export async function createStorage(ctx: Ctx, raw: unknown) {
  const input = storageSchema.parse(raw);
  if (!STORAGE_SKUS.includes(input.sku)) throw badRequest("InvalidSku", `SKU '${input.sku}' is not valid. Use one of: ${STORAGE_SKUS.join(", ")}.`);
  const premium = input.sku.startsWith("Premium");
  if (premium && input.kind === "StorageV2" && input.accessTier !== "Hot") throw badRequest("InvalidAccessTier", "Premium storage accounts do not support the Cool/Cold access tier.");
  const [performance, redundancy] = input.sku.split("_");
  return createResource(ctx, {
    type: T.STORAGE,
    resourceGroup: input.resourceGroup,
    name: input.name,
    location: input.location,
    tags: input.tags,
    properties: {
      sku: input.sku,
      performance,
      redundancy,
      kind: input.kind,
      accessTier: input.accessTier,
      allowBlobPublicAccess: input.allowBlobPublicAccess,
      minimumTlsVersion: input.minimumTlsVersion,
      supportsHttpsTrafficOnly: input.httpsOnly,
      allowSharedKeyAccess: input.allowSharedKeyAccess,
      networkRules: { defaultAction: "Allow", ipRules: [] as string[], virtualNetworkSubnets: [] as string[] },
      primaryEndpoints: { blob: `https://${input.name}.blob.core.sim.azuregigs.local/`, file: `https://${input.name}.file.core.sim.azuregigs.local/` },
      containers: [] as Props[],
      softDeleteDays: 7,
      keyRotatedAt: new Date().toISOString(),
    },
  });
}

export function usageBytes(p: Props) {
  return (p.containers as Props[]).reduce((a, c) => a + (c.blobs as Props[]).reduce((b, x) => b + x.size, 0), 0);
}

export async function updateStorageConfig(ctx: Ctx, sa: Res, raw: unknown) {
  const input = z.object({
    accessTier: z.enum(["Hot", "Cool", "Cold"]).optional(),
    allowBlobPublicAccess: z.boolean().optional(),
    minimumTlsVersion: z.enum(["TLS1_0", "TLS1_1", "TLS1_2"]).optional(),
    httpsOnly: z.boolean().optional(),
    allowSharedKeyAccess: z.boolean().optional(),
    sku: z.string().optional(),
    networkDefaultAction: z.enum(["Allow", "Deny"]).optional(),
    ipRules: z.array(z.string()).optional(),
  }).parse(raw);
  if (input.sku && !STORAGE_SKUS.includes(input.sku)) throw badRequest("InvalidSku", `SKU '${input.sku}' is not valid.`);
  if (input.sku && input.sku.split("_")[0] !== sa.properties.performance) throw badRequest("InvalidSkuChange", "Performance tier (Standard/Premium) cannot be changed after creation.");
  if (input.allowBlobPublicAccess === false) {
    // Disabling account-level public access makes all containers private.
  }
  return mutate(ctx, sa, (p) => {
    if (input.accessTier) p.accessTier = input.accessTier;
    if (input.allowBlobPublicAccess !== undefined) p.allowBlobPublicAccess = input.allowBlobPublicAccess;
    if (input.minimumTlsVersion) p.minimumTlsVersion = input.minimumTlsVersion;
    if (input.httpsOnly !== undefined) p.supportsHttpsTrafficOnly = input.httpsOnly;
    if (input.allowSharedKeyAccess !== undefined) p.allowSharedKeyAccess = input.allowSharedKeyAccess;
    if (input.sku) {
      p.sku = input.sku;
      p.redundancy = input.sku.split("_")[1];
    }
    if (input.networkDefaultAction) p.networkRules.defaultAction = input.networkDefaultAction;
    if (input.ipRules) p.networkRules.ipRules = input.ipRules;
  }, "Update Storage Account Configuration", input);
}

const containerName = z.string().min(3).max(63).regex(/^[a-z0-9](?!.*--)[a-z0-9-]*[a-z0-9]$/, "Container names must be 3-63 lowercase letters, digits and single hyphens, starting and ending with a letter or digit");

export async function createContainer(ctx: Ctx, sa: Res, raw: unknown) {
  const input = z.object({ name: containerName, publicAccess: z.enum(["none", "blob", "container"]).default("none") }).parse(raw);
  if ((sa.properties.containers as Props[]).some((c) => c.name === input.name)) throw conflict("ContainerAlreadyExists", `The specified container '${input.name}' already exists.`);
  if (input.publicAccess !== "none" && !sa.properties.allowBlobPublicAccess)
    throw conflict("PublicAccessNotPermitted", "Public access is not permitted on this storage account. Enable 'Allow Blob anonymous access' first.");
  return mutate(ctx, sa, (p) => {
    p.containers.push({ name: input.name, publicAccess: input.publicAccess, blobs: [], createdAt: new Date().toISOString() });
  }, "Create Blob Container", { container: input.name });
}

function getContainer(sa: Res, name: string) {
  const c = (sa.properties.containers as Props[]).find((x) => x.name === name);
  if (!c) throw notFound(`The specified container '${name}' does not exist.`);
  return c;
}

export async function deleteContainer(ctx: Ctx, sa: Res, name: string) {
  getContainer(sa, name);
  return mutate(ctx, sa, (p) => {
    p.containers = p.containers.filter((c: Props) => c.name !== name);
  }, "Delete Blob Container", { container: name });
}

export async function setContainerAccess(ctx: Ctx, sa: Res, name: string, publicAccess: string) {
  getContainer(sa, name);
  if (!["none", "blob", "container"].includes(publicAccess)) throw badRequest("InvalidParameter", "publicAccess must be none, blob or container.");
  if (publicAccess !== "none" && !sa.properties.allowBlobPublicAccess) throw conflict("PublicAccessNotPermitted", "Public access is not permitted on this storage account.");
  return mutate(ctx, sa, (p) => {
    p.containers.find((c: Props) => c.name === name).publicAccess = publicAccess;
  }, "Set Container Access Level", { container: name, publicAccess });
}

/** Network rule check shared by data-plane operations. */
function assertNetworkAllowed(sa: Res, clientIp?: string) {
  const nr = sa.properties.networkRules;
  if (nr.defaultAction === "Deny" && !(clientIp && (nr.ipRules as string[]).includes(clientIp))) {
    throw forbidden("AuthorizationFailure", `This request is not authorized to perform this operation. The storage account firewall denies access from ${clientIp ?? "this client"} (defaultAction=Deny).`);
  }
}

export const PORTAL_CLIENT_IP = "198.51.100.25";

export async function uploadBlob(ctx: Ctx, sa: Res, raw: unknown) {
  const input = z.object({
    container: z.string(),
    name: z.string().min(1).max(1024).regex(/^[^\\]+$/, "Blob names cannot contain backslashes"),
    content: z.string().max(MAX_BLOB_BYTES * 2),
    contentType: z.string().max(100).default("text/plain"),
    encoding: z.enum(["utf8", "base64"]).default("utf8"),
    tier: z.enum(["Hot", "Cool", "Cold", "Archive"]).optional(),
    overwrite: z.boolean().default(true),
    clientIp: z.string().optional(),
  }).parse(raw);
  assertNetworkAllowed(sa, input.clientIp ?? PORTAL_CLIENT_IP);
  const c = getContainer(sa, input.container);
  const bytes = Buffer.from(input.content, input.encoding);
  if (bytes.length > MAX_BLOB_BYTES) throw badRequest("RequestBodyTooLarge", `Simulated blobs are limited to ${MAX_BLOB_BYTES / 1024} KB.`);
  const existing = (c.blobs as Props[]).find((b) => b.name === input.name);
  if (existing && !input.overwrite) throw conflict("BlobAlreadyExists", `The specified blob '${input.name}' already exists.`);
  if (usageBytes(sa.properties) - (existing?.size ?? 0) + bytes.length > MAX_ACCOUNT_BYTES) throw conflict("QuotaExceeded", "Simulated storage account capacity (5 MB) exceeded.");
  return mutate(ctx, sa, (p) => {
    const cont = p.containers.find((x: Props) => x.name === input.container);
    cont.blobs = cont.blobs.filter((b: Props) => b.name !== input.name);
    cont.blobs.push({ name: input.name, size: bytes.length, contentType: input.contentType, tier: input.tier ?? p.accessTier, data: bytes.toString("base64"), lastModified: new Date().toISOString(), etag: `0x8D${Date.now().toString(16).toUpperCase()}` });
  }, "Put Blob", { container: input.container, blob: input.name, size: bytes.length });
}

export async function downloadBlob(ctx: Ctx, sa: Res, container: string, name: string, clientIp = PORTAL_CLIENT_IP) {
  assertNetworkAllowed(sa, clientIp);
  const c = getContainer(sa, container);
  const b = (c.blobs as Props[]).find((x) => x.name === name);
  if (!b) throw notFound(`The specified blob '${name}' does not exist.`);
  if (b.tier === "Archive") throw conflict("BlobArchived", "This operation is not permitted on an archived blob. Rehydrate it to Hot or Cool first.");
  await logActivity(ctx, sa, "Get Blob", "Succeeded", { container, blob: name });
  return { name: b.name, contentType: b.contentType, size: b.size, content: Buffer.from(b.data, "base64") };
}

export async function deleteBlob(ctx: Ctx, sa: Res, container: string, name: string) {
  const c = getContainer(sa, container);
  if (!(c.blobs as Props[]).some((b) => b.name === name)) throw notFound(`The specified blob '${name}' does not exist.`);
  return mutate(ctx, sa, (p) => {
    const cont = p.containers.find((x: Props) => x.name === container);
    cont.blobs = cont.blobs.filter((b: Props) => b.name !== name);
  }, "Delete Blob", { container, blob: name });
}

export async function setBlobTier(ctx: Ctx, sa: Res, container: string, name: string, tier: string) {
  if (!["Hot", "Cool", "Cold", "Archive"].includes(tier)) throw badRequest("InvalidTier", "Tier must be Hot, Cool, Cold or Archive.");
  const c = getContainer(sa, container);
  if (!(c.blobs as Props[]).some((b) => b.name === name)) throw notFound(`The specified blob '${name}' does not exist.`);
  return mutate(ctx, sa, (p) => {
    p.containers.find((x: Props) => x.name === container).blobs.find((b: Props) => b.name === name).tier = tier;
  }, "Set Blob Tier", { container, blob: name, tier });
}

export async function rotateKey(ctx: Ctx, sa: Res) {
  return mutate(ctx, sa, (p) => {
    p.keyRotatedAt = new Date().toISOString();
  }, "Regenerate Storage Account Key");
}

/**
 * Data-plane access test: can <principal> perform <operation> on a container?
 * Evaluates firewall, anonymous access, shared key and RBAC data roles.
 */
export async function testStorageAccess(ctx: Ctx, sa: Res, raw: unknown) {
  const input = z.object({
    container: z.string(),
    operation: z.enum(["read", "write"]).default("read"),
    method: z.enum(["anonymous", "accountKey", "entraId"]).default("entraId"),
    principal: z.string().optional(),
    clientIp: z.string().default(PORTAL_CLIENT_IP),
  }).parse(raw);
  const steps: { check: string; result: "Pass" | "Fail"; detail: string }[] = [];
  let allowed = true;
  const fail = (check: string, detail: string) => {
    steps.push({ check, result: "Fail", detail });
    allowed = false;
  };
  const nr = sa.properties.networkRules;
  if (nr.defaultAction === "Deny" && !(nr.ipRules as string[]).includes(input.clientIp)) fail("Firewall", `Client IP ${input.clientIp} is not in the allowed IP rules and defaultAction is Deny.`);
  else steps.push({ check: "Firewall", result: "Pass", detail: nr.defaultAction === "Allow" ? "All networks allowed" : `IP ${input.clientIp} allowed` });

  const c = (sa.properties.containers as Props[]).find((x) => x.name === input.container);
  if (!c) fail("Container", `Container '${input.container}' does not exist.`);
  if (input.method === "anonymous") {
    if (input.operation === "write") fail("Anonymous access", "Anonymous clients can never write.");
    else if (!sa.properties.allowBlobPublicAccess) fail("Anonymous access", "Account-level 'Allow Blob anonymous access' is disabled.");
    else if (c && c.publicAccess === "none") fail("Anonymous access", `Container '${input.container}' access level is Private.`);
    else steps.push({ check: "Anonymous access", result: "Pass", detail: `Container access level: ${c?.publicAccess}` });
  } else if (input.method === "accountKey") {
    if (!sa.properties.allowSharedKeyAccess) fail("Shared key", "Shared Key authorization is disabled on this account.");
    else steps.push({ check: "Shared key", result: "Pass", detail: "Account key accepted" });
  } else {
    if (!input.principal) throw badRequest("InvalidParameter", "principal (user principal name) is required for Entra ID authorization.");
    const action = input.operation === "read" ? "Microsoft.Storage/storageAccounts/blobServices/containers/blobs/read" : "Microsoft.Storage/storageAccounts/blobServices/containers/blobs/write";
    const scope = `/resourceGroups/${sa.resourceGroup}/providers/${T.STORAGE}/${sa.name}`;
    const r = await checkAccess(ctx, input.principal, action, scope);
    if (!r.allowed) fail("RBAC (data plane)", r.reason);
    else steps.push({ check: "RBAC (data plane)", result: "Pass", detail: r.reason });
  }
  await logActivity(ctx, sa, "Test Storage Access", "Succeeded", { ...input, allowed });
  return { allowed, result: allowed ? "Allowed" : "AuthorizationFailure", steps };
}

export async function storageByName(ctx: Ctx, name: string) {
  const sa = await findAnyByName(ctx, T.STORAGE, name);
  if (!sa) throw notFound(`Storage account '${name}' was not found.`);
  return sa;
}
