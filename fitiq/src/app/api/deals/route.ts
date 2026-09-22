import { z } from "zod";
import { getCatalog, getHistory } from "@/lib/server/catalog";
import { handle, personal, readBody } from "@/lib/server/route-utils";
import { analyzeFit } from "@/lib/engines/fit";
import { dealScore } from "@/lib/engines/deal";
import { priceStats } from "@/lib/engines/price";
import { dedupeByModel } from "@/lib/engines/matching";
import { cheapestOutfits } from "@/lib/engines/outfit";

const Body = z.object({ context: z.unknown().optional() });

export const POST = handle(async (req) => {
  const ctx = personal((await readBody(req, Body)).context);
  const catalog = await getCatalog();
  const rows = dedupeByModel(catalog.filter((p) => p.availability)).map((p) => {
    const stats = priceStats(p, getHistory(p));
    return { product: p, stats, deal: dealScore(p, stats, ctx.profile), fit: ctx.profile ? analyzeFit(p, ctx.profile, ctx) : undefined };
  });
  const byDeal = [...rows].sort((a, b) => b.deal.score - a.deal.score);
  const drops = rows.filter((r) => r.stats.hasHistory && r.stats.thirtyDaysAgo && r.stats.thirtyDaysAgo > r.product.price).sort((a, b) => (b.stats.thirtyDaysAgo! - b.product.price) - (a.stats.thirtyDaysAgo! - a.product.price));
  return {
    top: byDeal.slice(0, 12).map((r) => ({ product: r.product, deal: r.deal, fit: r.fit, stats: r.stats })),
    drops: drops.slice(0, 8).map((r) => ({ product: r.product, deal: r.deal, fit: r.fit, stats: r.stats })),
    under999: byDeal.filter((r) => r.product.price <= 999).slice(0, 8).map((r) => ({ product: r.product, deal: r.deal, fit: r.fit, stats: r.stats })),
    cheapestOutfits: ctx.profile ? cheapestOutfits(catalog, ctx.profile, ctx) : [],
  };
});
