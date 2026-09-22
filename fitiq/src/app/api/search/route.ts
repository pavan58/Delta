import { z } from "zod";
import { getSearchIndex } from "@/lib/server/catalog";
import { track } from "@/lib/server/analytics";
import { handle, personal, readBody } from "@/lib/server/route-utils";
import type { SearchParams } from "@/lib/search";

const Body = z.object({ params: z.record(z.unknown()).default({}), context: z.unknown().optional() });

export const POST = handle(async (req) => {
  const body = await readBody(req, Body);
  const ctx = personal(body.context);
  const index = await getSearchIndex();
  const params = body.params as SearchParams;
  const result = index.search(params, ctx.profile, ctx);
  if (params.q) track({ type: "search", q: params.q.slice(0, 120), results: result.total, at: new Date().toISOString() });
  return result;
});
