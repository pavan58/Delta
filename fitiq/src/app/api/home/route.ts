import { z } from "zod";
import { getCatalog, getHistory } from "@/lib/server/catalog";
import { handle, personal, readBody } from "@/lib/server/route-utils";
import { analyzeFit } from "@/lib/engines/fit";
import { dealScore } from "@/lib/engines/deal";
import { priceStats } from "@/lib/engines/price";
import { dedupeByModel } from "@/lib/engines/matching";
import { betterFitAlternatives } from "@/lib/engines/alternatives";
import { cheapestOutfits, generateOutfits } from "@/lib/engines/outfit";
import { gapAnalysis, ownedOutfits } from "@/lib/engines/wardrobe";
import { personalizeTrend } from "@/lib/engines/trends";
import { styleExperiments } from "@/lib/engines/experiments";
import { TRENDS } from "@/lib/data/trends";
import type { Occasion } from "@/lib/types";

const Body = z.object({ context: z.unknown().optional() });

export const POST = handle(async (req) => {
  const ctx = personal((await readBody(req, Body)).context);
  const catalog = await getCatalog();
  const reps = dedupeByModel(catalog.filter((p) => p.availability));
  const p = ctx.profile;
  const withDeal = reps.map((x) => ({ product: x, deal: dealScore(x, priceStats(x, getHistory(x)), p).score, fit: p ? analyzeFit(x, p, ctx) : undefined }));

  const bestDeals = [...withDeal].sort((a, b) => b.deal - a.deal).slice(0, 8);
  const under999 = withDeal.filter((x) => x.product.price <= 999).sort((a, b) => (b.fit?.overall ?? b.deal) - (a.fit?.overall ?? a.deal)).slice(0, 8);

  if (!p) return { personalized: false, bestDeals, under999, trends: TRENDS.slice(0, 4) };

  const occasion: Occasion = p.style.styles.includes("traditional") ? "festival" : p.style.styles.includes("formal") || p.style.styles.includes("smart-casual") ? "office" : "casual";
  const outfits = generateOutfits(catalog, p, { budget: p.budget.perOutfit, occasion }, ctx, ctx.wardrobe).outfits;
  const risky = withDeal.filter((x) => x.fit && x.fit.applicable && x.fit.risk !== "LOW" && (x.product.attrs.popularity ?? 0) >= 70).slice(0, 12);
  const betterFit = risky
    .map((r) => ({ from: r.product, fromFit: r.fit!, alt: betterFitAlternatives(r.product, catalog, p, ctx, 1, r.fit!)[0] }))
    .filter((x) => x.alt)
    .slice(0, 3);
  return {
    personalized: true,
    occasion,
    trends: TRENDS.map((t) => personalizeTrend(t, p)).sort((a, b) => ["RECOMMENDED", "MODERATE", "SKIP"].indexOf(a.verdict) - ["RECOMMENDED", "MODERATE", "SKIP"].indexOf(b.verdict)).slice(0, 4),
    bestDeals,
    outfits,
    under999,
    betterFit,
    cheapest: cheapestOutfits(catalog, p, ctx).slice(0, 3),
    owned: ownedOutfits(ctx.wardrobe, 3).map((o) => ({ score: o.score, ids: [o.combo.top.id, o.combo.bottom.id, o.combo.shoes.id, o.combo.layer?.id].filter(Boolean) })),
    gaps: ctx.wardrobe.length ? gapAnalysis(ctx.wardrobe, catalog).suggestions.slice(0, 2) : [],
    experiments: styleExperiments(p, ctx.wardrobe, catalog, ctx).slice(0, 2),
  };
});
