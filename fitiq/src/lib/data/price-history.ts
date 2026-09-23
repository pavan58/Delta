// Simulated price history for DEMO products. Real deployments populate the
// PricePoint table from provider syncs (see src/lib/jobs). ~20% of demo
// products intentionally have no history so "insufficient data" states render.
import { DEMO_PRODUCTS, seeded } from "./demo-catalog";
import type { Product } from "../types";

export interface PricePoint {
  date: string; // ISO date
  price: number;
}

const cache = new Map<string, PricePoint[]>();

export function demoPriceHistory(p: Product): PricePoint[] {
  if (cache.has(p.id)) return cache.get(p.id)!;
  const rand = seeded(`hist:${p.id}`);
  if (rand() < 0.2) {
    cache.set(p.id, []);
    return [];
  }
  const days = 30 + Math.floor(rand() * 61); // 30–90 days tracked
  const ceiling = p.mrp ?? Math.round(p.price * 1.25);
  const pts: PricePoint[] = [];
  let price = Math.round(p.price + (ceiling - p.price) * (0.3 + rand() * 0.7));
  const end = new Date(p.lastCheckedAt).getTime();
  for (let d = days; d >= 1; d--) {
    const r = rand();
    if (r < 0.06) price = Math.round(p.price * (0.9 + rand() * 0.1)); // sale event
    else if (r < 0.12) price = Math.round(ceiling * (0.85 + rand() * 0.15)); // back to list
    else if (r < 0.2) price = Math.round(price * (0.97 + rand() * 0.06));
    price = Math.min(Math.max(price, Math.round(p.price * 0.85)), ceiling);
    // Only record when the price changes or weekly, like a real sync log.
    if (d % 7 === 0 || pts.length === 0 || pts[pts.length - 1].price !== price) {
      pts.push({ date: new Date(end - d * 86400_000).toISOString(), price });
    }
  }
  pts.push({ date: p.lastCheckedAt, price: p.price });
  cache.set(p.id, pts);
  return pts;
}

export function allDemoHistories() {
  return DEMO_PRODUCTS.map((p) => ({ id: p.id, points: demoPriceHistory(p) }));
}
