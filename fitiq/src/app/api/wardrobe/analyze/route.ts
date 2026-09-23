import { z } from "zod";
import { getCatalog } from "@/lib/server/catalog";
import { handle, personal, readBody } from "@/lib/server/route-utils";
import { gapAnalysis, ownedOutfits, wardrobeCounts } from "@/lib/engines/wardrobe";
import { styleExperiments } from "@/lib/engines/experiments";

const Body = z.object({ context: z.unknown().optional() });

export const POST = handle(async (req) => {
  const ctx = personal((await readBody(req, Body)).context);
  const catalog = await getCatalog();
  const owned = ownedOutfits(ctx.wardrobe, 6).map((o) => ({
    score: o.score,
    ids: [o.combo.top.id, o.combo.bottom.id, o.combo.shoes.id, o.combo.layer?.id].filter(Boolean),
  }));
  return {
    counts: wardrobeCounts(ctx.wardrobe),
    gaps: gapAnalysis(ctx.wardrobe, catalog),
    owned,
    experiments: ctx.profile ? styleExperiments(ctx.profile, ctx.wardrobe, catalog, ctx) : [],
  };
});
