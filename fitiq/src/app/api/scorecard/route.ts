import { z } from "zod";
import { getCatalog } from "@/lib/server/catalog";
import { handle, HttpError, personal, readBody } from "@/lib/server/route-utils";
import { scorecard } from "@/lib/engines/scorecard";

const Body = z.object({ context: z.unknown().optional(), saved: z.array(z.string()).max(200).default([]) });

export const POST = handle(async (req) => {
  const b = await readBody(req, Body);
  const ctx = personal(b.context);
  if (!ctx.profile) throw new HttpError(422, "Profile required");
  const catalog = await getCatalog();
  const saved = catalog.filter((p) => b.saved.includes(p.id));
  return { ...scorecard(ctx.profile, ctx.wardrobe, ctx.feedback, catalog, saved), saved };
});
