import type { PricePoint } from "../data/price-history";
import type { PriceStats, Product } from "../types";

export const STALE_AFTER_HOURS = 48;

/** Price statistics derived ONLY from recorded points — never inferred. */
export function priceStats(p: Product, history: PricePoint[]): PriceStats {
  if (history.length < 2) return { current: p.price, points: history.length, hasHistory: false };
  const prices = history.map((h) => h.price);
  const prev = [...history].reverse().find((h) => h.price !== p.price);
  const cutoff = new Date(p.lastCheckedAt).getTime() - 30 * 86400_000;
  const beforeCutoff = history.filter((h) => new Date(h.date).getTime() <= cutoff);
  const thirty = beforeCutoff.length ? beforeCutoff[beforeCutoff.length - 1].price : undefined;
  return {
    current: p.price,
    previous: prev?.price,
    lowest: Math.min(...prices),
    highest: Math.max(...prices),
    change: prev ? p.price - prev.price : 0,
    thirtyDaysAgo: thirty,
    points: history.length,
    firstSeen: history[0].date,
    hasHistory: true,
  };
}

export function hoursSince(iso: string, now = Date.now()) {
  return Math.max(0, (now - new Date(iso).getTime()) / 3600_000);
}

export function freshness(p: Product, now = Date.now()) {
  const h = hoursSince(p.lastCheckedAt, now);
  const label = h < 1 ? "Price checked less than an hour ago" : h < 48 ? `Price checked ${Math.round(h)} hours ago` : `Last checked ${new Date(p.lastCheckedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`;
  return { hours: h, stale: h > STALE_AFTER_HOURS, label, realtime: p.source.realtime };
}
