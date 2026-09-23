import { z } from "zod";
import { getCatalog } from "@/lib/server/catalog";
import { handle, personal, readBody } from "@/lib/server/route-utils";
import { TRENDS } from "@/lib/data/trends";
import { personalizeTrend } from "@/lib/engines/trends";
import { analyzeFit } from "@/lib/engines/fit";
import { dedupeByModel } from "@/lib/engines/matching";

const Body = z.object({ context: z.unknown().optional() });

export const POST = handle(async (req) => {
  const ctx = personal((await readBody(req, Body)).context);
  const catalog = dedupeByModel((await getCatalog()).filter((p) => p.availability));
  return {
    trends: TRENDS.map((t) => {
      const personal = ctx.profile ? personalizeTrend(t, ctx.profile) : null;
      const fitWanted = personal?.suggestedFit ?? t.fit;
      const picks = catalog
        .filter((p) => p.category === t.category && (!fitWanted || p.fit === fitWanted || p.fit === t.fit))
        .map((p) => ({ product: p, fit: ctx.profile ? analyzeFit(p, ctx.profile, ctx) : undefined }))
        .sort((a, b) => (b.fit?.overall ?? 0) - (a.fit?.overall ?? 0) || (b.product.attrs.popularity ?? 0) - (a.product.attrs.popularity ?? 0))
        .slice(0, 3);
      return { trend: t, personal, picks };
    }),
  };
});
