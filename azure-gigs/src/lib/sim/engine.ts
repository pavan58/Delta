/**
 * Core persistence layer of the Virtual Azure simulator.
 * Every function takes a Ctx and only ever touches rows owned by ctx.userId.
 */
import type { Prisma, SimulatedResource, Subscription } from "@prisma/client";
import { prisma } from "@/lib/db";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { REGION_NAMES } from "./catalog";
import { T, TENANT_TYPES, TYPE_LABELS } from "./types";

export type Source = "portal" | "cli" | "pwsh" | "bash" | "system" | "fault" | "pipeline";
export type Ctx = { userId: string; caller: string; source: Source };
export type Props = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export type Res = Omit<SimulatedResource, "properties" | "tags"> & { properties: Props; tags: Record<string, string> };

export const MAX_RESOURCES_PER_USER = 400;

export async function getSubscription(ctx: Ctx): Promise<Subscription> {
  const sub = await prisma.subscription.findFirst({ where: { userId: ctx.userId }, orderBy: { createdAt: "asc" } });
  if (!sub) throw notFound("No subscription found for this learner.");
  return sub;
}

export function armId(subscriptionId: string, r: Pick<SimulatedResource, "type" | "resourceGroup" | "name">) {
  if (r.type === T.RG) return `/subscriptions/${subscriptionId}/resourceGroups/${r.name}`;
  if (r.type === T.ENTRA_USER || r.type === T.ENTRA_GROUP || r.type === T.ENTRA_SP) return `/tenant/${r.type}/${r.name}`;
  if (r.type === T.ROLE_ASSIGNMENT) return `/subscriptions/${subscriptionId}/providers/${r.type}/${r.name}`;
  const type = r.type === T.FUNCTION_APP ? T.SITE : r.type;
  return `/subscriptions/${subscriptionId}/resourceGroups/${r.resourceGroup}/providers/${type}/${r.name}`;
}

const NAME_RULES: Record<string, { re: RegExp; hint: string }> = {
  [T.RG]: { re: /^[-\w._()]{1,90}$/, hint: "1-90 chars: letters, digits, underscores, hyphens, periods, parentheses" },
  [T.STORAGE]: { re: /^[a-z0-9]{3,24}$/, hint: "3-24 lowercase letters and digits only" },
  [T.KEYVAULT]: { re: /^[a-zA-Z][a-zA-Z0-9-]{1,22}[a-zA-Z0-9]$/, hint: "3-24 chars: letters, digits, hyphens; start with a letter" },
  [T.ACR]: { re: /^[a-zA-Z0-9]{5,50}$/, hint: "5-50 alphanumeric characters" },
  [T.VM]: { re: /^[a-zA-Z0-9][a-zA-Z0-9-._]{0,62}[a-zA-Z0-9_]$|^[a-zA-Z0-9]$/, hint: "1-64 chars: letters, digits, hyphens, periods, underscores" },
  [T.SITE]: { re: /^[a-zA-Z0-9][a-zA-Z0-9-]{0,58}[a-zA-Z0-9]$/, hint: "2-60 chars: letters, digits and hyphens" },
  [T.FUNCTION_APP]: { re: /^[a-zA-Z0-9][a-zA-Z0-9-]{0,58}[a-zA-Z0-9]$/, hint: "2-60 chars: letters, digits and hyphens" },
  [T.SQL_SERVER]: { re: /^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/, hint: "lowercase letters, digits and hyphens (1-63)" },
  [T.ENTRA_GROUP]: { re: /^[\w][\w .-]{0,63}$/, hint: "1-64 chars: letters, digits, spaces, '.', '-', '_'" },
  [T.AKS]: { re: /^[a-zA-Z0-9][a-zA-Z0-9-_]{0,61}[a-zA-Z0-9]$/, hint: "1-63 chars: letters, digits, hyphens, underscores" },
};
const DEFAULT_NAME_RULE = { re: /^[a-zA-Z0-9][-\w.@/]{0,79}$/, hint: "1-80 chars: letters, digits, hyphens, underscores, periods" };

export function validateName(type: string, name: string) {
  const rule = NAME_RULES[type] ?? DEFAULT_NAME_RULE;
  if (!rule.re.test(name)) {
    throw badRequest("InvalidResourceName", `'${name}' is not a valid ${TYPE_LABELS[type] ?? type} name (${rule.hint}).`);
  }
}

export function validateLocation(location: string) {
  if (!REGION_NAMES.includes(location)) {
    throw badRequest("LocationNotAvailableForResourceType", `The region '${location}' is not available. Valid regions: ${REGION_NAMES.join(", ")}.`);
  }
}

/** Globally-unique DNS names (storage, key vault, web apps, ACR, SQL) are unique per learner in the simulator. */
const GLOBAL_NAME_TYPES: string[] = [T.STORAGE, T.KEYVAULT, T.SITE, T.FUNCTION_APP, T.ACR, T.SQL_SERVER];

export function asRes(r: SimulatedResource): Res {
  return r as Res;
}

export async function listResources(ctx: Ctx, filter: { type?: string | string[]; resourceGroup?: string } = {}): Promise<Res[]> {
  const where: Prisma.SimulatedResourceWhereInput = { userId: ctx.userId };
  if (filter.type) where.type = Array.isArray(filter.type) ? { in: filter.type } : filter.type;
  if (filter.resourceGroup !== undefined) where.rgKey = filter.resourceGroup.toLowerCase();
  const rows = await prisma.simulatedResource.findMany({ where, orderBy: { createdAt: "asc" } });
  return rows as Res[];
}

export async function getById(ctx: Ctx, id: string): Promise<Res> {
  const r = await prisma.simulatedResource.findFirst({ where: { id, userId: ctx.userId } });
  if (!r) throw notFound("The resource was not found.");
  return r as Res;
}

export async function findByName(ctx: Ctx, type: string, resourceGroup: string, name: string): Promise<Res | null> {
  const r = await prisma.simulatedResource.findFirst({
    where: { userId: ctx.userId, type, rgKey: TENANT_TYPES.includes(type) && type !== T.RG ? "" : (type === T.RG ? name : resourceGroup).toLowerCase(), nameKey: name.toLowerCase() },
  });
  return r as Res | null;
}

export async function getByName(ctx: Ctx, type: string, resourceGroup: string, name: string): Promise<Res> {
  const r = await findByName(ctx, type, resourceGroup, name);
  if (!r) {
    throw notFound(
      type === T.RG
        ? `Resource group '${name}' could not be found.`
        : `The ${TYPE_LABELS[type] ?? "resource"} '${name}' was not found in resource group '${resourceGroup}'.`,
    );
  }
  return r;
}

/** Finds a resource by name in any resource group (used by CLI flags that accept names). */
export async function findAnyByName(ctx: Ctx, type: string, name: string): Promise<Res | null> {
  return (await prisma.simulatedResource.findFirst({ where: { userId: ctx.userId, type, nameKey: name.toLowerCase() } })) as Res | null;
}

export async function requireResourceGroup(ctx: Ctx, name: string): Promise<Res> {
  if (!name) throw badRequest("MissingResourceGroup", "A resource group is required.");
  return getByName(ctx, T.RG, name, name);
}

export type CreateInput = {
  type: string;
  resourceGroup: string;
  name: string;
  location?: string;
  properties?: Props;
  tags?: Record<string, string>;
  status?: string;
  dependsOn?: { toId: string; kind: string }[];
};

export async function createResource(ctx: Ctx, input: CreateInput, opts: { log?: boolean; operation?: string } = {}): Promise<Res> {
  validateName(input.type, input.name);
  const isTenant = TENANT_TYPES.includes(input.type) && input.type !== T.RG;
  let location = input.location ?? "";
  let rgName = input.type === T.RG ? input.name : isTenant ? "" : input.resourceGroup;
  if (!isTenant && input.type !== T.RG) {
    const rg = await requireResourceGroup(ctx, input.resourceGroup);
    rgName = rg.name;
    if (!location) location = rg.location;
  }
  if (!TENANT_TYPES.includes(input.type) || input.type === T.RG) {
    validateLocation(location);
  } else location = location || "global";

  const tags = input.tags ?? {};
  if (Object.keys(tags).length > 50) throw badRequest("InvalidTag", "A resource can have at most 50 tags.");
  for (const [k, v] of Object.entries(tags)) {
    if (!k || k.length > 512 || String(v).length > 256 || /[<>%&\\?/]/.test(k)) throw badRequest("InvalidTagNameCharacters", `Tag '${k}' is invalid.`);
  }

  const count = await prisma.simulatedResource.count({ where: { userId: ctx.userId } });
  if (count >= MAX_RESOURCES_PER_USER) throw conflict("QuotaExceeded", `Resource quota of ${MAX_RESOURCES_PER_USER} reached. Delete unused resources first.`);

  if (GLOBAL_NAME_TYPES.includes(input.type)) {
    const dup = await prisma.simulatedResource.findFirst({ where: { userId: ctx.userId, type: input.type, nameKey: input.name.toLowerCase() } });
    if (dup) throw conflict("NameNotAvailable", `The name '${input.name}' is already in use. ${TYPE_LABELS[input.type]} names must be globally unique.`);
  }
  const existing = await findByName(ctx, input.type, rgName, input.name);
  if (existing) {
    throw conflict(
      input.type === T.RG ? "ResourceGroupExists" : "ResourceExists",
      `A ${TYPE_LABELS[input.type] ?? "resource"} named '${input.name}' already exists${rgName && input.type !== T.RG ? ` in resource group '${rgName}'` : ""}.`,
    );
  }
  const sub = await getSubscription(ctx);
  const created = await prisma.simulatedResource.create({
    data: {
      userId: ctx.userId,
      subscriptionDbId: sub.id,
      type: input.type,
      name: input.name,
      nameKey: input.name.toLowerCase(),
      resourceGroup: rgName,
      rgKey: rgName.toLowerCase(),
      location,
      status: input.status ?? "Succeeded",
      properties: (input.properties ?? {}) as Prisma.InputJsonValue,
      tags: tags as Prisma.InputJsonValue,
      dependsOn: input.dependsOn?.length ? { create: input.dependsOn.map((d) => ({ toId: d.toId, kind: d.kind })) } : undefined,
    },
  });
  if (opts.log !== false) {
    await logActivity(ctx, created as Res, opts.operation ?? `Create or Update ${TYPE_LABELS[input.type] ?? input.type}`, "Succeeded", {
      location,
    });
  }
  return created as Res;
}

export async function updateResource(
  ctx: Ctx,
  r: Res,
  patch: { properties?: Props; tags?: Record<string, string>; status?: string },
  operation?: string,
  details: Props = {},
): Promise<Res> {
  const updated = await prisma.simulatedResource.update({
    where: { id: r.id },
    data: {
      properties: patch.properties !== undefined ? (patch.properties as Prisma.InputJsonValue) : undefined,
      tags: patch.tags !== undefined ? (patch.tags as Prisma.InputJsonValue) : undefined,
      status: patch.status,
    },
  });
  if (operation) await logActivity(ctx, updated as Res, operation, "Succeeded", details);
  return updated as Res;
}

/** Atomically read-modify-write the properties JSON. */
export async function mutate(ctx: Ctx, r: Res, fn: (p: Props) => Props | void, operation?: string, details: Props = {}): Promise<Res> {
  const fresh = await getById(ctx, r.id);
  const props = structuredClone(fresh.properties ?? {});
  const out = fn(props) ?? props;
  return updateResource(ctx, fresh, { properties: out }, operation, details);
}

export async function addDependency(fromId: string, toId: string, kind: string) {
  await prisma.resourceDependency.upsert({
    where: { fromId_toId_kind: { fromId, toId, kind } },
    create: { fromId, toId, kind },
    update: {},
  });
}
export async function removeDependency(fromId: string, kind: string, toId?: string) {
  await prisma.resourceDependency.deleteMany({ where: { fromId, kind, ...(toId ? { toId } : {}) } });
}

export async function dependentsOf(ctx: Ctx, id: string): Promise<{ resource: Res; kind: string }[]> {
  const deps = await prisma.resourceDependency.findMany({ where: { toId: id, from: { userId: ctx.userId } }, include: { from: true } });
  return deps.map((d) => ({ resource: d.from as Res, kind: d.kind }));
}
export async function dependenciesOf(ctx: Ctx, id: string): Promise<{ resource: Res; kind: string }[]> {
  const deps = await prisma.resourceDependency.findMany({ where: { fromId: id, to: { userId: ctx.userId } }, include: { to: true } });
  return deps.map((d) => ({ resource: d.to as Res, kind: d.kind }));
}

/**
 * Deletes a resource. Refuses when other resources depend on it unless cascade is confirmed.
 * Resource groups delete everything inside them (only with cascade).
 */
export async function deleteResource(ctx: Ctx, r: Res, opts: { cascade?: boolean } = {}): Promise<string[]> {
  const deleted: string[] = [];
  if (r.type === T.RG) {
    const inside = await prisma.simulatedResource.findMany({ where: { userId: ctx.userId, rgKey: r.rgKey, NOT: { type: T.RG } } });
    if (inside.length && !opts.cascade) {
      throw conflict(
        "ResourceGroupNotEmpty",
        `Resource group '${r.name}' contains ${inside.length} resource(s). Confirm cascading deletion to delete the group and everything in it.`,
      );
    }
    // Also remove role assignments scoped to this group.
    const ras = await listResources(ctx, { type: T.ROLE_ASSIGNMENT });
    for (const ra of ras) if (String(ra.properties.scope ?? "").toLowerCase().includes(`/resourcegroups/${r.rgKey}`)) await prisma.simulatedResource.delete({ where: { id: ra.id } });
    for (const x of inside) {
      await prisma.simulatedResource.delete({ where: { id: x.id } });
      deleted.push(x.name);
      await logActivity(ctx, x as Res, `Delete ${TYPE_LABELS[x.type] ?? x.type}`, "Succeeded", { reason: `Resource group ${r.name} deleted` });
    }
    await prisma.simulatedResource.delete({ where: { id: r.id } });
    await logActivity(ctx, r, "Delete Resource group", "Succeeded", { deletedResources: deleted.length });
    return [...deleted, r.name];
  }

  const dependents = await dependentsOf(ctx, r.id);
  // Children created together with this resource (e.g. VM's NIC/disk) are removed with it.
  const owned = dependents.filter((d) => d.resource.properties?.ownerId === r.id);
  const blocking = dependents.filter((d) => d.resource.properties?.ownerId !== r.id && d.kind !== "owner");
  if (blocking.length && !opts.cascade) {
    const names = blocking.map((d) => `${d.resource.name} (${TYPE_LABELS[d.resource.type] ?? d.resource.type})`).join(", ");
    throw conflict("InUseByOtherResources", `Cannot delete '${r.name}' because it is in use by: ${names}. Remove the dependency first or confirm cascading deletion.`);
  }
  // Resources the deleted one owns (NIC, OS disk, public IP created by the VM wizard)
  const ownedChildren = (await dependenciesOf(ctx, r.id)).filter((d) => d.resource.properties?.ownerId === r.id);
  await prisma.simulatedResource.delete({ where: { id: r.id } });
  deleted.push(r.name);
  await logActivity(ctx, r, `Delete ${TYPE_LABELS[r.type] ?? r.type}`, "Succeeded");
  for (const d of [...(opts.cascade ? blocking : []), ...owned]) {
    const still = await prisma.simulatedResource.findUnique({ where: { id: d.resource.id } });
    if (still) deleted.push(...(await deleteResource(ctx, d.resource, { cascade: true })));
  }
  for (const c of ownedChildren) {
    const still = await prisma.simulatedResource.findUnique({ where: { id: c.resource.id } });
    if (still) deleted.push(...(await deleteResource(ctx, still as Res, { cascade: true })));
  }
  // Any remaining resources created as part of this one (e.g. a VM's public IP behind its NIC).
  const leftovers = await prisma.simulatedResource.findMany({ where: { userId: ctx.userId, properties: { path: ["ownerId"], equals: r.id } } });
  for (const l of leftovers) deleted.push(...(await deleteResource(ctx, l as Res, { cascade: true })));
  return deleted;
}

export async function logActivity(ctx: Ctx, r: Partial<Res> | null, operation: string, status: string, details: Props = {}) {
  await prisma.activityLog.create({
    data: {
      userId: ctx.userId,
      resourceId: r?.id ?? null,
      resourceName: r?.name ?? null,
      resourceType: r?.type ?? null,
      resourceGroup: r?.resourceGroup ?? null,
      operation,
      status,
      caller: ctx.caller,
      source: ctx.source,
      details: details as Prisma.InputJsonValue,
    },
  });
}

/** Deterministic pseudo-random generator (string seed) for metrics, IDs, data. */
export function seeded(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

export function fakeGuid(rand: () => number = Math.random) {
  const hex = () => Math.floor(rand() * 16).toString(16);
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => (c === "x" ? hex() : ((Math.floor(rand() * 4) + 8).toString(16))));
}
