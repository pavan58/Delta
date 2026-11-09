import { z } from "zod";
import { withUser, readJson } from "@/lib/api";
import { ctxOf } from "@/lib/ctx";
import { deleteResource, getById, updateResource } from "@/lib/sim/engine";
import { resourceDetail } from "@/lib/sim/registry";

type P = { params: Promise<{ id: string }> };

export const GET = withUser<P>(async (_req, { params, user }) => {
  const ctx = ctxOf(user);
  return resourceDetail(ctx, await getById(ctx, (await params).id));
});

export const PATCH = withUser<P>(async (req, { params, user }) => {
  const ctx = ctxOf(user);
  const body = z.object({ tags: z.record(z.string().min(1).max(512), z.string().max(256)) }).parse(await readJson(req));
  const r = await getById(ctx, (await params).id);
  await updateResource(ctx, r, { tags: body.tags }, "Update Tags", { tags: body.tags });
  return resourceDetail(ctx, await getById(ctx, r.id));
});

export const DELETE = withUser<P>(async (req, { params, user }) => {
  const ctx = ctxOf(user);
  const r = await getById(ctx, (await params).id);
  const cascade = req.nextUrl.searchParams.get("cascade") === "true";
  const deleted = await deleteResource(ctx, r, { cascade });
  return { deleted };
});
