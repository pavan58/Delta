import { z } from "zod";
import { getCatalog } from "@/lib/server/catalog";
import { handle, personal, readBody } from "@/lib/server/route-utils";
import { analyzeFit } from "@/lib/engines/fit";
import { dedupeByModel } from "@/lib/engines/matching";
import { pairHarmony } from "@/lib/engines/harmony";
import { ALL_CATEGORIES, ALL_COLORS } from "@/lib/taxonomy";
import type { Category, ColorFamily } from "@/lib/types";

// Visual search returns CLOSEST ALTERNATIVES from structured attributes
// (category + colours + optional fit/pattern). It never claims an exact
// identity unless a model identifier is supplied and matches.
const Body = z.object({
  pieces: z.array(z.object({ category: z.enum(ALL_CATEGORIES as [Category, ...Category[]]), color: z.enum(ALL_COLORS as [ColorFamily, ...ColorFamily[]]), fit: z.string().optional(), pattern: z.string().optional() })).min(1).max(5),
  context: z.unknown().optional(),
});

export const POST = handle(async (req) => {
  const b = await readBody(req, Body);
  const ctx = personal(b.context);
  const catalog = dedupeByModel((await getCatalog()).filter((p) => p.availability));
  return {
    results: b.pieces.map((piece) => ({
      piece,
      matches: catalog
        .filter((p) => p.category === piece.category)
        .map((p) => {
          let s = p.attrs.colorFamily === piece.color ? 60 : pairHarmony(p.attrs.colorFamily, piece.color) >= 0.9 ? 25 : 10;
          if (piece.fit && p.fit === piece.fit) s += 20;
          if (piece.pattern && p.attrs.pattern === piece.pattern) s += 10;
          const fit = ctx.profile ? analyzeFit(p, ctx.profile, ctx) : undefined;
          if (fit) s += fit.overall / 10;
          return { product: p, score: Math.round(s), fit, label: "Similar alternative" as const };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 4),
    })),
  };
});
