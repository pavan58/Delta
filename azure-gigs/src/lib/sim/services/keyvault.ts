import { z } from "zod";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { decrypt, encrypt } from "@/lib/security/crypto";
import { createResource, Ctx, fakeGuid, logActivity, mutate, Props, Res } from "../engine";
import { T } from "../types";
import { checkAccess, resolvePrincipal } from "./rbac";

export const SECRET_PERMS = ["get", "list", "set", "delete", "recover", "backup", "restore", "purge"] as const;

export async function createVault(ctx: Ctx, raw: unknown) {
  const input = z.object({
    resourceGroup: z.string().min(1),
    name: z.string().min(3).max(24),
    location: z.string().optional(),
    sku: z.enum(["standard", "premium"]).default("standard"),
    enableRbacAuthorization: z.boolean().default(false),
    softDeleteRetentionDays: z.coerce.number().int().min(7).max(90).default(90),
    enablePurgeProtection: z.boolean().default(false),
    tags: z.record(z.string(), z.string()).optional(),
  }).parse(raw);
  return createResource(ctx, {
    type: T.KEYVAULT,
    resourceGroup: input.resourceGroup,
    name: input.name,
    location: input.location,
    tags: input.tags,
    properties: {
      sku: input.sku,
      vaultUri: `https://${input.name.toLowerCase()}.vault.sim.azuregigs.local/`,
      enableRbacAuthorization: input.enableRbacAuthorization,
      softDeleteRetentionDays: input.softDeleteRetentionDays,
      enablePurgeProtection: input.enablePurgeProtection,
      accessPolicies: [{ principal: ctx.caller, objectId: "learner", secretPermissions: [...SECRET_PERMS] }],
      secrets: [] as Props[],
      deletedSecrets: [] as Props[],
      audit: [] as Props[],
    },
  });
}

function audit(p: Props, entry: Props) {
  p.audit = [{ time: new Date().toISOString(), ...entry }, ...(p.audit ?? [])].slice(0, 200);
}

const secretName = z.string().min(1).max(127).regex(/^[0-9a-zA-Z-]+$/, "Secret names may contain only letters, digits and hyphens");

export async function setSecret(ctx: Ctx, kv: Res, raw: unknown) {
  const input = z.object({ name: secretName, value: z.string().min(1).max(25000), contentType: z.string().max(100).optional(), expires: z.string().optional().nullable(), notBefore: z.string().optional().nullable() }).parse(raw);
  if (input.expires && Number.isNaN(Date.parse(input.expires))) throw badRequest("BadParameter", "expires must be an ISO date.");
  if ((kv.properties.deletedSecrets as Props[]).some((s) => s.name === input.name))
    throw conflict("Conflict", `Secret ${input.name} is currently in a deleted but recoverable state. Recover or purge it first.`);
  const version = fakeGuid().replace(/-/g, "");
  return mutate(ctx, kv, (p) => {
    let s = p.secrets.find((x: Props) => x.name === input.name);
    if (!s) {
      s = { name: input.name, versions: [] };
      p.secrets.push(s);
    }
    s.versions.unshift({ version, value: encrypt(input.value), contentType: input.contentType ?? "", enabled: true, created: new Date().toISOString(), expires: input.expires ?? null, notBefore: input.notBefore ?? null });
    s.versions = s.versions.slice(0, 25);
    audit(p, { operation: "SecretSet", caller: ctx.caller, secret: input.name, version, result: "Success" });
  }, "Set Secret", { secret: input.name, version });
}

function hasPolicyPerm(kv: Res, principalUpn: string, objectId: string | null, perm: string) {
  return (kv.properties.accessPolicies as Props[]).some(
    (ap) => (ap.principal?.toLowerCase() === principalUpn.toLowerCase() || (objectId && ap.objectId === objectId)) && (ap.secretPermissions as string[]).includes(perm),
  );
}

/** Data-plane authorization: access policies or RBAC depending on vault configuration. */
async function authorize(ctx: Ctx, kv: Res, principal: string | undefined, perm: "get" | "list" | "set" | "delete") {
  if (!principal || principal === ctx.caller) {
    if (kv.properties.enableRbacAuthorization) return; // learner is subscription Owner + KV admin in the sandbox
    if (!hasPolicyPerm(kv, ctx.caller, "learner", perm)) throw forbidden("Forbidden", `The user '${ctx.caller}' does not have secrets ${perm} permission on key vault '${kv.name}'.`);
    return;
  }
  const p = await resolvePrincipal(ctx, principal).catch(() => null);
  if (!p) throw notFound(`Principal '${principal}' not found.`);
  if (kv.properties.enableRbacAuthorization) {
    const action = perm === "get" ? "Microsoft.KeyVault/vaults/secrets/getSecret/action" : perm === "list" ? "Microsoft.KeyVault/vaults/secrets/readMetadata/action" : `Microsoft.KeyVault/vaults/secrets/${perm === "set" ? "setSecret" : "delete"}/action`;
    const r = await checkAccess(ctx, p.name, action, `/resourceGroups/${kv.resourceGroup}/providers/${T.KEYVAULT}/${kv.name}`);
    if (!r.allowed) throw forbidden("Forbidden", `Caller is not authorized to perform action on resource. ${r.reason} (RBAC mode)`);
  } else if (!hasPolicyPerm(kv, p.name, p.properties.objectId, perm)) {
    throw forbidden("Forbidden", `The user, group or application '${p.name}' does not have secrets ${perm} permission on key vault '${kv.name}'. Add an access policy.`);
  }
}

export async function getSecret(ctx: Ctx, kv: Res, raw: unknown) {
  const input = z.object({ name: z.string(), version: z.string().optional(), principal: z.string().optional() }).parse(raw);
  try {
    await authorize(ctx, kv, input.principal, "get");
  } catch (e) {
    await mutate(ctx, kv, (p) => audit(p, { operation: "SecretGet", caller: input.principal ?? ctx.caller, secret: input.name, result: "Forbidden" }));
    throw e;
  }
  const s = (kv.properties.secrets as Props[]).find((x) => x.name === input.name);
  if (!s) throw notFound(`A secret with (name/id) ${input.name} was not found in this key vault.`);
  const v = input.version ? (s.versions as Props[]).find((x) => x.version === input.version) : s.versions[0];
  if (!v) throw notFound(`Version ${input.version} of secret ${input.name} was not found.`);
  if (!v.enabled) throw forbidden("Forbidden", `Operation get is not allowed on a disabled secret.`);
  if (v.expires && Date.parse(v.expires) < Date.now()) throw forbidden("SecretExpired", `Secret ${input.name} expired on ${v.expires}. Operation get is not allowed on an expired secret.`);
  await mutate(ctx, kv, (p) => audit(p, { operation: "SecretGet", caller: input.principal ?? ctx.caller, secret: input.name, version: v.version, result: "Success" }));
  return { name: s.name, version: v.version, value: decrypt(v.value), contentType: v.contentType, created: v.created, expires: v.expires };
}

export function secretMetadata(kv: Res) {
  return (kv.properties.secrets as Props[]).map((s) => ({
    name: s.name,
    versions: (s.versions as Props[]).map((v) => ({ version: v.version, enabled: v.enabled, created: v.created, expires: v.expires, expired: !!v.expires && Date.parse(v.expires) < Date.now(), contentType: v.contentType })),
  }));
}

export async function setVersionEnabled(ctx: Ctx, kv: Res, name: string, version: string, enabled: boolean) {
  const s = (kv.properties.secrets as Props[]).find((x) => x.name === name);
  if (!s || !(s.versions as Props[]).some((v) => v.version === version)) throw notFound(`Secret version ${name}/${version} not found.`);
  return mutate(ctx, kv, (p) => {
    p.secrets.find((x: Props) => x.name === name).versions.find((v: Props) => v.version === version).enabled = enabled;
    audit(p, { operation: "SecretUpdate", caller: ctx.caller, secret: name, version, result: "Success" });
  }, "Update Secret Attributes", { secret: name, version, enabled });
}

export async function deleteSecret(ctx: Ctx, kv: Res, name: string) {
  const s = (kv.properties.secrets as Props[]).find((x) => x.name === name);
  if (!s) throw notFound(`Secret ${name} not found.`);
  return mutate(ctx, kv, (p) => {
    p.secrets = p.secrets.filter((x: Props) => x.name !== name);
    p.deletedSecrets.push({ ...s, deletedDate: new Date().toISOString(), scheduledPurgeDate: new Date(Date.now() + p.softDeleteRetentionDays * 86400000).toISOString() });
    audit(p, { operation: "SecretDelete", caller: ctx.caller, secret: name, result: "Success" });
  }, "Delete Secret", { secret: name });
}

export async function recoverSecret(ctx: Ctx, kv: Res, name: string) {
  const s = (kv.properties.deletedSecrets as Props[]).find((x) => x.name === name);
  if (!s) throw notFound(`Deleted secret ${name} not found.`);
  return mutate(ctx, kv, (p) => {
    p.deletedSecrets = p.deletedSecrets.filter((x: Props) => x.name !== name);
    const { deletedDate: _d, scheduledPurgeDate: _s, ...rest } = s; // eslint-disable-line @typescript-eslint/no-unused-vars
    p.secrets.push(rest);
    audit(p, { operation: "SecretRecover", caller: ctx.caller, secret: name, result: "Success" });
  }, "Recover Deleted Secret", { secret: name });
}

export async function purgeSecret(ctx: Ctx, kv: Res, name: string) {
  if (kv.properties.enablePurgeProtection) throw forbidden("Forbidden", "Purge protection is enabled on this vault; deleted secrets cannot be purged before the retention period ends.");
  return mutate(ctx, kv, (p) => {
    p.deletedSecrets = p.deletedSecrets.filter((x: Props) => x.name !== name);
    audit(p, { operation: "SecretPurge", caller: ctx.caller, secret: name, result: "Success" });
  }, "Purge Deleted Secret", { secret: name });
}

export async function setAccessPolicy(ctx: Ctx, kv: Res, raw: unknown) {
  const input = z.object({ principal: z.string().min(1), secretPermissions: z.array(z.enum(SECRET_PERMS)).default([]) }).parse(raw);
  if (kv.properties.enableRbacAuthorization) throw conflict("BadRequest", "This vault uses the Azure RBAC permission model; access policies are ignored. Assign a Key Vault role instead.");
  let principalName = input.principal;
  let objectId: string | null = null;
  if (input.principal.toLowerCase() !== ctx.caller.toLowerCase()) {
    const p = await resolvePrincipal(ctx, input.principal);
    principalName = p.name;
    objectId = p.properties.objectId;
  } else objectId = "learner";
  return mutate(ctx, kv, (p) => {
    p.accessPolicies = (p.accessPolicies as Props[]).filter((ap) => ap.principal.toLowerCase() !== principalName.toLowerCase());
    if (input.secretPermissions.length) p.accessPolicies.push({ principal: principalName, objectId, secretPermissions: input.secretPermissions });
    audit(p, { operation: "VaultAccessPolicyChange", caller: ctx.caller, principal: principalName, permissions: input.secretPermissions.join(","), result: "Success" });
  }, "Update Key Vault Access Policy", { principal: principalName, permissions: input.secretPermissions });
}

export async function setPermissionModel(ctx: Ctx, kv: Res, rbac: boolean) {
  return mutate(ctx, kv, (p) => {
    p.enableRbacAuthorization = rbac;
  }, "Update Key Vault Permission Model", { enableRbacAuthorization: rbac });
}

/** Lets an app (by managed identity principal) attempt to read a secret; used for Key Vault references. */
export async function testRetrieval(ctx: Ctx, kv: Res, raw: unknown) {
  const input = z.object({ principal: z.string().min(1), name: z.string().min(1) }).parse(raw);
  try {
    const r = await getSecret(ctx, kv, { name: input.name, principal: input.principal });
    await logActivity(ctx, kv, "Test Secret Retrieval", "Succeeded", input);
    return { allowed: true, detail: `Secret '${r.name}' version ${r.version.slice(0, 8)}… retrieved (value hidden).` };
  } catch (e) {
    await logActivity(ctx, kv, "Test Secret Retrieval", "Failed", input);
    return { allowed: false, detail: (e as Error).message };
  }
}
