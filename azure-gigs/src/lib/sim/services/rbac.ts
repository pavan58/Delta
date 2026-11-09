/** Simulated Microsoft Entra ID (users, groups, sign-ins) and Azure RBAC. */
import { z } from "zod";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { createResource, Ctx, fakeGuid, findByName, getSubscription, listResources, logActivity, mutate, Props, Res } from "../engine";
import { T } from "../types";

export const TENANT_DOMAIN = "contoso.sim.azuregigs.local";

export const BUILTIN_ROLES: { name: string; description: string; actions: string[]; notActions?: string[]; dataActions?: string[] }[] = [
  { name: "Owner", description: "Full access to manage all resources, including assigning roles.", actions: ["*"] },
  { name: "Contributor", description: "Manage all resources but cannot assign roles.", actions: ["*"], notActions: ["Microsoft.Authorization/*/write", "Microsoft.Authorization/*/delete"] },
  { name: "Reader", description: "View all resources, but no changes.", actions: ["*/read"] },
  { name: "User Access Administrator", description: "Manage user access to Azure resources.", actions: ["*/read", "Microsoft.Authorization/*"] },
  { name: "Virtual Machine Contributor", description: "Manage virtual machines but not the network they connect to.", actions: ["Microsoft.Compute/*", "Microsoft.Network/networkInterfaces/*", "Microsoft.Network/*/read", "Microsoft.Resources/*/read"] },
  { name: "Network Contributor", description: "Manage networks, but not access to them.", actions: ["Microsoft.Network/*", "Microsoft.Resources/*/read"] },
  { name: "Storage Account Contributor", description: "Manage storage accounts (management plane only).", actions: ["Microsoft.Storage/storageAccounts/*", "Microsoft.Resources/*/read"] },
  { name: "Storage Blob Data Reader", description: "Read blob containers and data.", actions: ["Microsoft.Storage/storageAccounts/blobServices/containers/read"], dataActions: ["Microsoft.Storage/storageAccounts/blobServices/containers/blobs/read"] },
  { name: "Storage Blob Data Contributor", description: "Read, write and delete blob containers and data.", actions: ["Microsoft.Storage/storageAccounts/blobServices/containers/*"], dataActions: ["Microsoft.Storage/storageAccounts/blobServices/containers/blobs/*"] },
  { name: "Key Vault Administrator", description: "Perform all data plane operations on a key vault.", actions: ["Microsoft.KeyVault/*/read"], dataActions: ["Microsoft.KeyVault/vaults/*"] },
  { name: "Key Vault Secrets User", description: "Read secret contents.", actions: [], dataActions: ["Microsoft.KeyVault/vaults/secrets/getSecret/action", "Microsoft.KeyVault/vaults/secrets/readMetadata/action"] },
  { name: "Key Vault Secrets Officer", description: "Perform any action on the secrets of a key vault.", actions: ["Microsoft.KeyVault/*/read"], dataActions: ["Microsoft.KeyVault/vaults/secrets/*"] },
  { name: "Website Contributor", description: "Manage websites, but not the plans they are connected to.", actions: ["Microsoft.Web/sites/*", "Microsoft.Resources/*/read"] },
  { name: "SQL DB Contributor", description: "Manage SQL databases but not access to them.", actions: ["Microsoft.Sql/servers/databases/*", "Microsoft.Resources/*/read"] },
  { name: "AcrPull", description: "Pull artifacts from a container registry.", actions: ["Microsoft.ContainerRegistry/registries/pull/read"] },
  { name: "AcrPush", description: "Push and pull artifacts.", actions: ["Microsoft.ContainerRegistry/registries/pull/read", "Microsoft.ContainerRegistry/registries/push/write"] },
  { name: "Azure Kubernetes Service Cluster User Role", description: "List cluster user credentials.", actions: ["Microsoft.ContainerService/managedClusters/listClusterUserCredential/action", "Microsoft.ContainerService/managedClusters/read"] },
  { name: "Monitoring Reader", description: "Read all monitoring data.", actions: ["*/read", "Microsoft.Insights/*/read", "Microsoft.OperationalInsights/workspaces/search/action"] },
  { name: "Backup Operator", description: "Manage backup services, except removal of backup.", actions: ["Microsoft.RecoveryServices/*", "Microsoft.Compute/virtualMachines/read"], notActions: ["Microsoft.RecoveryServices/*/delete"] },
];

export function findRole(name: string) {
  return BUILTIN_ROLES.find((r) => r.name.toLowerCase() === name.toLowerCase());
}

function matchAction(pattern: string, action: string) {
  const re = new RegExp("^" + pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$", "i");
  return re.test(action);
}

export function roleAllows(roleName: string, action: string) {
  const role = findRole(roleName);
  if (!role) return false;
  const isData = /\/(blobs|secrets)\//i.test(action) || /\/secrets\/(getSecret|readMetadata)/i.test(action);
  const list = isData ? role.dataActions ?? [] : role.actions;
  return list.some((p) => matchAction(p, action)) && !(role.notActions ?? []).some((p) => matchAction(p, action));
}

/** Normalizes a scope to a lower-case path without the /subscriptions/<id> prefix. "/" = subscription. */
export function normalizeScope(scope: string) {
  let s = scope.trim();
  s = s.replace(/^\/subscriptions\/[^/]+/i, "");
  if (!s.startsWith("/")) s = "/" + s;
  s = s.replace(/\/+$/, "");
  return (s || "/").toLowerCase();
}

export const userSchema = z.object({
  displayName: z.string().min(1).max(100),
  mailNickname: z.string().min(1).max(64).regex(/^[a-zA-Z0-9._-]+$/, "Use letters, digits, '.', '_' or '-'"),
  department: z.string().max(64).optional(),
  jobTitle: z.string().max(64).optional(),
  accountEnabled: z.boolean().default(true),
  password: z.string().min(8, "Initial password must be at least 8 characters").max(128).optional(),
});

export async function createUser(ctx: Ctx, raw: unknown) {
  const input = userSchema.parse(raw);
  const upn = `${input.mailNickname.toLowerCase()}@${TENANT_DOMAIN}`;
  if (await findByName(ctx, T.ENTRA_USER, "", upn)) throw conflict("UserExists", `A user with UPN '${upn}' already exists.`);
  return createResource(ctx, {
    type: T.ENTRA_USER,
    resourceGroup: "",
    name: upn,
    properties: {
      displayName: input.displayName,
      userPrincipalName: upn,
      objectId: fakeGuid(),
      department: input.department ?? "",
      jobTitle: input.jobTitle ?? "",
      accountEnabled: input.accountEnabled,
      forceChangePasswordNextSignIn: true,
      mfaRegistered: false,
      signIns: [] as Props[],
    },
  }, { operation: "Add user" });
}

export async function ensureManagedIdentity(ctx: Ctx, owner: Res) {
  const name = `${owner.name.toLowerCase()}@msi`;
  return (await findByName(ctx, T.ENTRA_SP, "", name)) ?? createResource(ctx, { type: T.ENTRA_SP, resourceGroup: "", name, properties: { displayName: owner.name, objectId: fakeGuid(), servicePrincipalType: "ManagedIdentity", ownerResourceId: owner.id, accountEnabled: true } }, { operation: "Create managed identity" });
}

export async function createGroup(ctx: Ctx, raw: unknown) {
  const input = z.object({ name: z.string().min(1).max(64).regex(/^[\w .-]+$/), description: z.string().max(200).optional(), groupType: z.enum(["Security", "Microsoft 365"]).default("Security") }).parse(raw);
  return createResource(ctx, {
    type: T.ENTRA_GROUP,
    resourceGroup: "",
    name: input.name,
    properties: { displayName: input.name, description: input.description ?? "", groupType: input.groupType, objectId: fakeGuid(), members: [] as string[] },
  }, { operation: "Add group" });
}

export async function resolvePrincipal(ctx: Ctx, nameOrId: string): Promise<Res> {
  const key = nameOrId.toLowerCase();
  const all = await listResources(ctx, { type: [T.ENTRA_USER, T.ENTRA_GROUP, T.ENTRA_SP] });
  const p = all.find((x) => x.nameKey === key || String(x.properties.objectId).toLowerCase() === key || (x.type === T.ENTRA_USER && x.nameKey.split("@")[0] === key));
  if (!p) throw notFound(`Principal '${nameOrId}' was not found in the directory.`);
  return p;
}

export async function addGroupMember(ctx: Ctx, group: Res, user: string) {
  const u = await resolvePrincipal(ctx, user);
  if (u.type !== T.ENTRA_USER) throw badRequest("InvalidMember", "Only users can be added to groups in the simulator.");
  if ((group.properties.members as string[]).includes(u.properties.objectId)) throw conflict("MemberExists", `${u.name} is already a member of ${group.name}.`);
  return mutate(ctx, group, (p) => {
    p.members.push(u.properties.objectId);
  }, "Add member to group", { member: u.name });
}

export async function removeGroupMember(ctx: Ctx, group: Res, user: string) {
  const u = await resolvePrincipal(ctx, user);
  return mutate(ctx, group, (p) => {
    p.members = p.members.filter((m: string) => m !== u.properties.objectId);
  }, "Remove member from group", { member: u.name });
}

export async function setUserEnabled(ctx: Ctx, user: Res, enabled: boolean) {
  return mutate(ctx, user, (p) => {
    p.accountEnabled = enabled;
  }, enabled ? "Enable account" : "Disable account");
}

export async function resetPassword(ctx: Ctx, user: Res) {
  return mutate(ctx, user, (p) => {
    p.forceChangePasswordNextSignIn = true;
    p.passwordResetAt = new Date().toISOString();
  }, "Reset user password");
}

/** Simulates an interactive sign-in and records it in the user's sign-in log. */
export async function simulateSignIn(ctx: Ctx, user: Res, raw: unknown) {
  const input = z.object({ app: z.string().default("Azure Gigs Portal"), location: z.string().default("Pune, IN"), correctPassword: z.boolean().default(true) }).parse(raw);
  const p = user.properties;
  const status = !p.accountEnabled ? { code: 50057, result: "Failure", reason: "User account is disabled." }
    : !input.correctPassword ? { code: 50126, result: "Failure", reason: "Invalid username or password." }
    : { code: 0, result: "Success", reason: "" };
  const entry = { time: new Date().toISOString(), app: input.app, location: input.location, ipAddress: "198.51.100.25", ...status };
  await mutate(ctx, user, (props) => {
    props.signIns = [entry, ...(props.signIns ?? [])].slice(0, 50);
  });
  await logActivity(ctx, user, "Sign-in activity", status.result === "Success" ? "Succeeded" : "Failed", entry);
  return entry;
}

export async function scopeExists(ctx: Ctx, scope: string) {
  const n = normalizeScope(scope);
  if (n === "/") return true;
  const m = /^\/resourcegroups\/([^/]+)(?:\/providers\/(.+)\/([^/]+))?$/.exec(n);
  if (!m) return false;
  const res = await listResources(ctx, { resourceGroup: m[1] });
  if (!m[2]) return (await listResources(ctx, { type: T.RG })).some((r) => r.nameKey === m[1]);
  return res.some((r) => r.type.toLowerCase() === m[2] && r.nameKey === m[3]);
}

export async function createRoleAssignment(ctx: Ctx, raw: unknown) {
  const input = z.object({ principal: z.string().min(1), role: z.string().min(1), scope: z.string().min(1) }).parse(raw);
  const role = findRole(input.role);
  if (!role) throw badRequest("RoleDefinitionDoesNotExist", `The role definition '${input.role}' does not exist. Available: ${BUILTIN_ROLES.map((r) => r.name).join(", ")}.`);
  const principal = await resolvePrincipal(ctx, input.principal);
  const scope = normalizeScope(input.scope);
  if (!(await scopeExists(ctx, scope))) throw badRequest("InvalidScope", `The scope '${input.scope}' does not exist.`);
  const existing = await listResources(ctx, { type: T.ROLE_ASSIGNMENT });
  if (existing.some((r) => r.properties.principalId === principal.properties.objectId && r.properties.roleDefinitionName === role.name && r.properties.scope === scope))
    throw conflict("RoleAssignmentExists", "The role assignment already exists.");
  const sub = await getSubscription(ctx);
  return createResource(ctx, {
    type: T.ROLE_ASSIGNMENT,
    resourceGroup: "",
    name: fakeGuid(),
    properties: {
      principalId: principal.properties.objectId,
      principalName: principal.name,
      principalType: principal.type === T.ENTRA_USER ? "User" : principal.type === T.ENTRA_SP ? "ServicePrincipal" : "Group",
      roleDefinitionName: role.name,
      scope,
      displayScope: scope === "/" ? `/subscriptions/${sub.subscriptionId}` : `/subscriptions/${sub.subscriptionId}${scope}`,
    },
  }, { operation: "Create role assignment" });
}

/**
 * Evaluates whether a principal (user UPN / object id) may perform an action at a scope.
 * Considers direct assignments and group membership, with inheritance from parent scopes.
 */
export async function checkAccess(ctx: Ctx, principalName: string, action: string, scope: string) {
  let principal: Res;
  try {
    principal = await resolvePrincipal(ctx, principalName);
  } catch {
    return { allowed: false, reason: `Principal '${principalName}' does not exist.`, matched: [] as Props[] };
  }
  if (principal.type === T.ENTRA_USER && !principal.properties.accountEnabled) return { allowed: false, reason: "User account is disabled.", matched: [] };
  const groups = (await listResources(ctx, { type: T.ENTRA_GROUP })).filter((g) => (g.properties.members as string[]).includes(principal.properties.objectId));
  const ids = new Set([principal.properties.objectId, ...groups.map((g) => g.properties.objectId)]);
  const target = normalizeScope(scope);
  const assignments = (await listResources(ctx, { type: T.ROLE_ASSIGNMENT })).filter((a) => ids.has(a.properties.principalId));
  const applicable = assignments.filter((a) => a.properties.scope === "/" || target === a.properties.scope || target.startsWith(a.properties.scope + "/"));
  const granting = applicable.filter((a) => roleAllows(a.properties.roleDefinitionName, action));
  if (granting.length) {
    const a = granting[0];
    return { allowed: true, reason: `Granted by role '${a.properties.roleDefinitionName}' assigned to ${a.properties.principalName} at scope '${a.properties.scope}'.`, matched: granting.map((g) => g.properties) };
  }
  return {
    allowed: false,
    reason: applicable.length
      ? `AuthorizationFailed: '${principal.name}' has role(s) ${applicable.map((a) => `'${a.properties.roleDefinitionName}'`).join(", ")} on this scope, but none permit '${action}'.`
      : `AuthorizationFailed: The client '${principal.name}' does not have authorization to perform action '${action}' over scope '${target}', or the scope is invalid.`,
    matched: [],
  };
}

export async function testAccess(ctx: Ctx, raw: unknown) {
  const input = z.object({ principal: z.string().min(1), action: z.string().min(3), scope: z.string().min(1) }).parse(raw);
  const r = await checkAccess(ctx, input.principal, input.action, input.scope);
  await logActivity(ctx, null, "Check access", r.allowed ? "Succeeded" : "Failed", { ...input, reason: r.reason });
  return r;
}

/** Maps a REST-ish operation to an RBAC action, used by the terminal when acting as another identity. */
export function actionFor(type: string, verb: "read" | "write" | "delete" | "action", op?: string) {
  const t = type === T.FUNCTION_APP ? T.SITE : type;
  if (verb === "action") return `${t}/${op ?? "action"}/action`;
  return `${t}/${verb}`;
}
