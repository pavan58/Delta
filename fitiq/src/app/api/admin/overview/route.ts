import { NextResponse } from "next/server";
import { getCatalog, getHistory, isDemoMode } from "@/lib/server/catalog";
import { providerStatuses } from "@/lib/providers/registry";
import { eventsOf } from "@/lib/server/analytics";
import { jobRuns } from "@/lib/jobs";
import { freshness } from "@/lib/engines/price";
import { TRENDS } from "@/lib/data/trends";
import { RECIPES } from "@/lib/engines/recipes";
import { RETAILERS, RETAILER_NAME, CATEGORY_LABEL } from "@/lib/taxonomy";
import { aiStatus } from "@/lib/ai";

export async function GET() {
  const catalog = await getCatalog();
  const now = Date.now();
  const buckets = { "< 6h": 0, "6–24h": 0, "24–48h": 0, "> 48h (stale)": 0 };
  for (const p of catalog) {
    const h = freshness(p, now).hours;
    if (h < 6) buckets["< 6h"]++;
    else if (h < 24) buckets["6–24h"]++;
    else if (h < 48) buckets["24–48h"]++;
    else buckets["> 48h (stale)"]++;
  }
  const byRetailer = new Map<string, { products: number; available: number; stale: number }>();
  for (const p of catalog) {
    const r = byRetailer.get(p.retailer) ?? { products: 0, available: 0, stale: 0 };
    r.products++;
    if (p.availability) r.available++;
    if (freshness(p, now).stale) r.stale++;
    byRetailer.set(p.retailer, r);
  }
  const byCategory = new Map<string, number>();
  for (const p of catalog) byCategory.set(CATEGORY_LABEL[p.category], (byCategory.get(CATEGORY_LABEL[p.category]) ?? 0) + 1);
  const searches = eventsOf("search");
  const clicks = eventsOf("click");
  const outfits = eventsOf("outfit");
  const errors = eventsOf("integration-error");
  const feedback = eventsOf("feedback");
  const topQueries = new Map<string, number>();
  for (const s of searches) topQueries.set(s.q.toLowerCase(), (topQueries.get(s.q.toLowerCase()) ?? 0) + 1);
  const withHistory = catalog.filter((p) => getHistory(p).length > 1).length;

  return NextResponse.json({
    demo: isDemoMode(),
    ai: aiStatus(),
    totals: { products: catalog.length, available: catalog.filter((p) => p.availability).length, retailers: byRetailer.size, withHistory, sponsored: catalog.filter((p) => p.source.sponsored).length },
    providers: providerStatuses(),
    retailers: RETAILERS.map((r) => ({ ...r, ...(byRetailer.get(r.id) ?? { products: 0, available: 0, stale: 0 }) })),
    freshness: buckets,
    categories: Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1]),
    trends: TRENDS.map((t) => ({ id: t.id, name: t.name, source: t.source.label, metric: t.metric ?? null })),
    recipes: RECIPES.map((r) => ({ id: r.id, name: r.name, slots: r.slots.length })),
    searches: { count: searches.length, zeroResults: searches.filter((s) => s.results === 0).length, top: Array.from(topQueries.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10), recent: searches.slice(-10).reverse() },
    clicks: { count: clicks.length, demo: clicks.filter((c) => c.demo).length, byRetailer: Array.from(clicks.reduce((m, c) => m.set(RETAILER_NAME[c.retailer] ?? c.retailer, (m.get(RETAILER_NAME[c.retailer] ?? c.retailer) ?? 0) + 1), new Map<string, number>()).entries()) },
    conversions: { available: false, note: "Conversion data arrives via affiliate network postbacks once a permitted integration is live." },
    outfits: { count: outfits.length, recent: outfits.slice(-10).reverse() },
    feedback: { count: feedback.length, perfect: feedback.filter((f) => f.outcome === "perfect").length },
    users: { note: "Demo mode keeps profiles in each visitor's browser; no user records are stored server-side." },
    failedIntegrations: [...errors.slice(-20).reverse(), ...providerStatuses().filter((p) => p.lastError).map((p) => ({ provider: p.id, error: p.lastError!, at: p.lastSyncAt ?? "" }))],
    jobs: jobRuns.slice(0, 20),
  });
}
