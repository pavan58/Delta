// SAME PRODUCT DETECTION
// "Exact match" requires the same model identifier (or, when a feed has no
// identifier, identical brand + normalised title + colour). Everything else
// is at best a "Similar alternative" and is never labelled as the same item.
import type { Product } from "../types";

export type MatchKind = "exact" | "similar";

export interface MatchResult {
  product: Product;
  kind: MatchKind;
  basis: string;
  similarity: number;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function isExactMatch(a: Product, b: Product): { exact: boolean; basis?: string } {
  if (a.id === b.id) return { exact: false };
  if (a.attrs.modelCode && b.attrs.modelCode) {
    return a.attrs.modelCode === b.attrs.modelCode && a.attrs.colorFamily === b.attrs.colorFamily
      ? { exact: true, basis: "Same brand, model identifier and colour" }
      : { exact: false };
  }
  if (norm(a.brand) === norm(b.brand) && norm(a.title) === norm(b.title) && norm(a.colors[0] ?? "") === norm(b.colors[0] ?? "")) {
    return { exact: true, basis: "Same brand, title and colour (no model ID in feed)" };
  }
  return { exact: false };
}

function jaccard<T>(a: T[], b: T[]) {
  if (!a.length && !b.length) return 1;
  const s = new Set(a);
  const inter = b.filter((x) => s.has(x)).length;
  return inter / (new Set([...a, ...b]).size || 1);
}

/** Functional/visual similarity in 0..1 from structured attributes. */
export function similarity(a: Product, b: Product): number {
  let s = 0;
  s += a.category === b.category ? 0.35 : 0;
  s += a.attrs.colorFamily === b.attrs.colorFamily ? 0.2 : 0;
  s += a.fit && b.fit ? (a.fit === b.fit ? 0.15 : Math.abs(["skinny", "slim", "tapered", "regular", "straight", "relaxed", "oversized"].indexOf(a.fit) - ["skinny", "slim", "tapered", "regular", "straight", "relaxed", "oversized"].indexOf(b.fit)) <= 1 ? 0.08 : 0) : 0.08;
  s += 0.15 * jaccard(a.attrs.styles, b.attrs.styles);
  s += a.attrs.pattern === b.attrs.pattern ? 0.05 : 0;
  s += a.material && b.material && a.material.split(" ")[0].toLowerCase() === b.material.split(" ")[0].toLowerCase() ? 0.1 : 0;
  if (a.subcategory && a.subcategory === b.subcategory) s += 0.05;
  return Math.min(1, s);
}

export function exactMatches(p: Product, catalog: Product[]): MatchResult[] {
  return catalog
    .map((q) => ({ q, m: isExactMatch(p, q) }))
    .filter((x) => x.m.exact)
    .map((x) => ({ product: x.q, kind: "exact" as const, basis: x.m.basis!, similarity: 1 }))
    .sort((a, b) => a.product.price - b.product.price);
}

export function similarProducts(p: Product, catalog: Product[], min = 0.6): MatchResult[] {
  return catalog
    .filter((q) => q.id !== p.id && !isExactMatch(p, q).exact && (q.attrs.modelCode === undefined || q.attrs.modelCode !== p.attrs.modelCode))
    .map((q) => ({ product: q, kind: "similar" as const, basis: similarityBasis(p, q), similarity: similarity(p, q) }))
    .filter((r) => r.similarity >= min)
    .sort((a, b) => b.similarity - a.similarity);
}

export function similarityBasis(a: Product, b: Product): string {
  const bits: string[] = [];
  if (a.category === b.category) bits.push(`same ${b.category.replace("-", " ")} type`);
  if (a.attrs.colorFamily === b.attrs.colorFamily) bits.push(`same ${b.attrs.colorFamily.replace("-", " ")} colour family`);
  if (a.fit && a.fit === b.fit) bits.push(`${b.fit} fit`);
  if (b.material && a.material && a.material.split(" ")[0] === b.material.split(" ")[0]) bits.push(`${b.material.toLowerCase()} fabric`);
  const shared = a.attrs.styles.filter((s) => b.attrs.styles.includes(s));
  if (shared.length) bits.push(`${shared[0].replace("-", " ")} styling`);
  return bits.length ? bits.join(", ") : "comparable attributes";
}

/** One representative listing per model (cheapest available) for grids. */
export function dedupeByModel(products: Product[]): Product[] {
  const best = new Map<string, Product>();
  for (const p of products) {
    const key = p.attrs.modelCode ? `${p.attrs.modelCode}:${p.attrs.colorFamily}` : p.id;
    const cur = best.get(key);
    const better = !cur || (p.availability && !cur.availability) || (p.availability === cur.availability && p.price < cur.price);
    if (better) best.set(key, p);
  }
  return Array.from(best.values());
}
