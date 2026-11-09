import { z } from "zod";
import { withUser, readJson } from "@/lib/api";
import { ctxOf } from "@/lib/ctx";
import { listResources, getSubscription, armId } from "@/lib/sim/engine";
import { createByType, sanitize } from "@/lib/sim/registry";
import { resourceHealth } from "@/lib/sim/services/monitor";

export const GET = withUser(async (req, { user }) => {
  const ctx = ctxOf(user);
  const types = req.nextUrl.searchParams.getAll("type");
  const rg = req.nextUrl.searchParams.get("resourceGroup") ?? undefined;
  const sub = await getSubscription(ctx);
  const rows = await listResources(ctx, { type: types.length ? types : undefined, resourceGroup: rg });
  return { resources: rows.map((r) => ({ ...sanitize(r), armId: armId(sub.subscriptionId, r), health: resourceHealth(r).state })) };
});

export const POST = withUser(async (req, { user }) => {
  const body = z.object({ type: z.string(), input: z.record(z.string(), z.unknown()) }).parse(await readJson(req));
  const r = await createByType(ctxOf(user), body.type, body.input);
  return Response.json({ resource: sanitize(r) }, { status: 201 });
}, { limit: 120 });
