import { z } from "zod";
import { createResource, Ctx, fakeGuid, findAnyByName } from "../engine";
import { notFound } from "@/lib/errors";
import { T } from "../types";

export async function createWorkspace(ctx: Ctx, raw: unknown) {
  const input = z.object({ resourceGroup: z.string().min(1), name: z.string().min(4).max(63).regex(/^[A-Za-z0-9][A-Za-z0-9-]+[A-Za-z0-9]$/), location: z.string().optional(), retentionDays: z.coerce.number().int().min(30).max(730).default(30) }).parse(raw);
  return createResource(ctx, { type: T.WORKSPACE, resourceGroup: input.resourceGroup, name: input.name, location: input.location, properties: { customerId: fakeGuid(), sku: "PerGB2018", retentionInDays: input.retentionDays, savedQueries: [] } });
}

export async function createAppInsights(ctx: Ctx, raw: unknown) {
  const input = z.object({ resourceGroup: z.string().min(1), name: z.string().min(1).max(255), location: z.string().optional(), workspace: z.string().optional(), app: z.string().optional() }).parse(raw);
  let workspaceId: string | null = null;
  if (input.workspace) {
    const ws = await findAnyByName(ctx, T.WORKSPACE, input.workspace);
    if (!ws) throw notFound(`Log Analytics workspace '${input.workspace}' not found.`);
    workspaceId = ws.id;
  }
  let siteId: string | null = null;
  if (input.app) {
    const site = (await findAnyByName(ctx, T.SITE, input.app)) ?? (await findAnyByName(ctx, T.FUNCTION_APP, input.app));
    if (!site) throw notFound(`App '${input.app}' not found.`);
    siteId = site.id;
  }
  return createResource(ctx, {
    type: T.APPINSIGHTS,
    resourceGroup: input.resourceGroup,
    name: input.name,
    location: input.location,
    properties: { appId: fakeGuid(), connectionString: `InstrumentationKey=${fakeGuid()};IngestionEndpoint=https://sim.in.applicationinsights.azuregigs.local/`, workspaceId, linkedSiteId: siteId, linkedSiteName: input.app ?? null },
    dependsOn: [...(workspaceId ? [{ toId: workspaceId, kind: "workspace" }] : []), ...(siteId ? [{ toId: siteId, kind: "monitoredApp" }] : [])],
  });
}
