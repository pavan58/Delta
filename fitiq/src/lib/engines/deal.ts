// DEAL SCORE — a platform-generated shopping metric built only from data we
// actually hold. Components without data are dropped and the remaining
// weights re-normalised, so a missing history never counts as a "deal".
import type { DealScore, PriceStats, Product, UserProfile } from "../types";

export function dealScore(p: Product, stats: PriceStats, profile?: UserProfile | null): DealScore {
  const parts: DealScore["components"] = [];

  if (p.mrp && p.discountPercent !== undefined) {
    const v = Math.min(100, (p.discountPercent / 60) * 100);
    parts.push({ label: "Current discount", value: Math.round(v), weight: 0.25, note: `${p.discountPercent}% below listed MRP` });
  }
  if (stats.hasHistory && stats.lowest !== undefined && stats.highest !== undefined) {
    const range = stats.highest - stats.lowest;
    const v = range <= 0 ? 60 : ((stats.highest - p.price) / range) * 100;
    parts.push({ label: "Price vs detected history", value: Math.round(v), weight: 0.3, note: range <= 0 ? "Price has been stable" : `Detected range ₹${stats.lowest}–₹${stats.highest} over ${stats.points} checks` });
  }
  if (p.rating !== undefined && p.reviewCount !== undefined) {
    // Bayesian average toward 3.8 so a handful of 5★ reviews doesn't dominate.
    const bayes = (p.rating * p.reviewCount + 3.8 * 50) / (p.reviewCount + 50);
    parts.push({ label: "Rating quality", value: Math.round(((bayes - 3) / 2) * 100), weight: 0.2, note: `${p.rating}★ · ${p.reviewCount.toLocaleString("en-IN")} reviews` });
  }
  if (p.attrs.popularity !== undefined) parts.push({ label: "Popularity", value: p.attrs.popularity, weight: 0.1, note: "Relative engagement from provider data" });
  parts.push({ label: "Availability", value: p.availability ? (p.sizes.length >= 3 ? 100 : 60) : 0, weight: 0.05, note: p.availability ? `${p.sizes.length} sizes listed` : "Unavailable" });
  if (profile) {
    const m = p.attrs.styles.filter((s) => profile.style.styles.includes(s)).length;
    const pref = Math.min(100, m * 35 + (profile.style.colors.includes(p.attrs.colorFamily) ? 30 : 0));
    parts.push({ label: "Your preferences", value: pref, weight: 0.1, note: "Style & colour overlap with your Style DNA" });
  }
  const w = parts.reduce((s, c) => s + c.weight, 0);
  const score = Math.round(parts.reduce((s, c) => s + Math.max(0, Math.min(100, c.value)) * c.weight, 0) / (w || 1));
  return { score: Math.max(0, Math.min(100, score)), components: parts.map((c) => ({ ...c, weight: Math.round((c.weight / w) * 100) / 100 })) };
}
