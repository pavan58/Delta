import type { FitAnalysis, Product, UserProfile } from "../types";
import { analyzeFit, type FitContext } from "./fit";
import { dedupeByModel, similarProducts, similarityBasis } from "./matching";
import { formatINR } from "../taxonomy";

export interface CheaperAlt {
  product: Product;
  saving: number;
  similarity: number;
  why: string;
  fit?: FitAnalysis;
}

export interface BetterFitAlt {
  product: Product;
  fit: FitAnalysis;
  delta: number;
  why: string;
}

/** "Similar but cheaper" — never labelled as the same product. */
export function cheaperAlternatives(p: Product, catalog: Product[], profile?: UserProfile | null, ctx: FitContext = {}, limit = 3): CheaperAlt[] {
  const pool = dedupeByModel(catalog.filter((q) => q.category === p.category && q.availability && q.price <= p.price * 0.85));
  return similarProducts(p, pool, 0.55)
    .slice(0, 12)
    .map((m) => {
      const fit = profile ? analyzeFit(m.product, profile, ctx) : undefined;
      return {
        product: m.product,
        saving: p.price - m.product.price,
        similarity: m.similarity,
        fit,
        why: `Similar alternative: ${similarityBasis(p, m.product)}. Saves ${formatINR(p.price - m.product.price)}.${fit && fit.risk !== "LOW" ? ` Note: ${fit.risk.toLowerCase()} fit risk for you.` : ""}`,
      };
    })
    .sort((a, b) => b.similarity - a.similarity || b.saving - a.saving)
    .slice(0, limit);
}

/** Alternatives in the same category with meaningfully better fit compatibility. */
export function betterFitAlternatives(p: Product, catalog: Product[], profile: UserProfile, ctx: FitContext = {}, limit = 3, current = analyzeFit(p, profile, ctx)): BetterFitAlt[] {
  if (!current.applicable) return [];
  const pool = dedupeByModel(catalog.filter((q) => q.category === p.category && q.id !== p.id && q.availability && q.attrs.modelCode !== p.attrs.modelCode));
  return pool
    .map((q) => ({ q, fit: analyzeFit(q, profile, ctx) }))
    .filter(({ fit }) => fit.overall >= current.overall + 5 && fit.risk !== "HIGH")
    .map(({ q, fit }) => ({ product: q, fit, delta: fit.overall - current.overall, why: explainDelta(p, q, current, fit) }))
    .sort((a, b) => b.fit.overall - a.fit.overall + (a.product.price - b.product.price) / 5000)
    .slice(0, limit);
}

function explainDelta(a: Product, b: Product, fa: FitAnalysis, fb: FitAnalysis): string {
  const bits: string[] = [];
  if (fb.silhouette - fa.silhouette >= 8 && b.fit) bits.push(`the ${b.fit} cut is closer to your preferred fit`);
  if (fb.body - fa.body >= 6) bits.push("its proportions suit your build better");
  if (fb.sizeConfidence - fa.sizeConfidence >= 8) bits.push("sizing is more certain (size chart or your past feedback)");
  if (fb.style - fa.style >= 8) bits.push("it's closer to your Style DNA");
  if (!bits.length) bits.push("small gains across cut, sizing and style");
  const s = bits.join("; ");
  return `Fit ${fa.overall} → ${fb.overall}: ${s}.`;
}
