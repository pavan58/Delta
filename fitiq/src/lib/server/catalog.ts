import "server-only";
import { demoPriceHistory, type PricePoint } from "../data/price-history";
import { loadCatalog, isDemoMode, providerFor } from "../providers/registry";
import { InMemorySearchIndex } from "../search";
import type { Product } from "../types";

let index: InMemorySearchIndex | null = null;
let indexedFrom: Product[] | null = null;
const history = new Map<string, PricePoint[]>();

export async function getCatalog() {
  return loadCatalog();
}

export async function getProduct(id: string) {
  return (await getCatalog()).find((p) => p.id === id);
}

/** Recorded price history. Demo products use simulated history; live providers use stored points. */
export function getHistory(p: Product): PricePoint[] {
  if (p.source.kind === "demo") return demoPriceHistory(p);
  return history.get(p.id) ?? [];
}

export function recordPrice(p: Product) {
  const pts = history.get(p.id) ?? [];
  if (!pts.length || pts[pts.length - 1].price !== p.price) pts.push({ date: p.lastCheckedAt, price: p.price });
  history.set(p.id, pts);
}

export async function getSearchIndex() {
  const catalog = await getCatalog();
  if (!index || indexedFrom !== catalog) {
    index = new InMemorySearchIndex(catalog, getHistory);
    indexedFrom = catalog;
  }
  return index;
}

export function outboundUrl(p: Product) {
  const provider = providerFor(p);
  const aff = process.env.AFFILIATE_ID;
  if (aff && provider?.affiliateUrl && p.source.kind !== "demo") return provider.affiliateUrl(p, aff);
  return p.productUrl;
}

export { isDemoMode };
