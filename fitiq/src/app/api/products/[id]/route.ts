import { z } from "zod";
import { getCatalog, getHistory, getProduct } from "@/lib/server/catalog";
import { handle, HttpError, personal, readBody } from "@/lib/server/route-utils";
import { analyzeFit, purchaseConfidence } from "@/lib/engines/fit";
import { exactMatches, similarProducts } from "@/lib/engines/matching";
import { freshness, priceStats } from "@/lib/engines/price";
import { dealScore } from "@/lib/engines/deal";
import { betterFitAlternatives, cheaperAlternatives } from "@/lib/engines/alternatives";
import { completeTheLook } from "@/lib/engines/outfit";
import { wardrobeUtility } from "@/lib/engines/wardrobe";

const Body = z.object({ context: z.unknown().optional() });

export const POST = handle(async (req, params) => {
  const body = await readBody(req, Body);
  const ctx = personal(body.context);
  const product = await getProduct(decodeURIComponent(params.id));
  if (!product) throw new HttpError(404, "Product not found");
  const catalog = await getCatalog();
  const history = getHistory(product);
  const stats = priceStats(product, history);
  const offers = [product, ...exactMatches(product, catalog).map((m) => m.product)]
    .sort((a, b) => Number(b.availability) - Number(a.availability) || a.price - b.price)
    .map((p) => ({ product: p, stats: priceStats(p, getHistory(p)), freshness: freshness(p), basis: p.id === product.id ? "This listing" : "Same brand, model identifier and colour" }));
  const fit = ctx.profile ? analyzeFit(product, ctx.profile, ctx) : null;
  return {
    product,
    fit,
    confidence: ctx.profile && fit ? purchaseConfidence(product, ctx.profile, ctx, fit) : null,
    stats,
    history,
    deal: dealScore(product, stats, ctx.profile),
    freshness: freshness(product),
    offers,
    similar: similarProducts(product, catalog, 0.65).slice(0, 4).map((m) => ({ product: m.product, basis: m.basis, similarity: m.similarity })),
    cheaper: cheaperAlternatives(product, catalog, ctx.profile, ctx),
    betterFit: ctx.profile ? betterFitAlternatives(product, catalog, ctx.profile, ctx, 3, fit!) : [],
    look: ctx.profile ? completeTheLook(product, catalog, ctx.profile, ctx) : null,
    utility: ctx.wardrobe.length ? wardrobeUtility(product, ctx.wardrobe) : null,
  };
});
