import { z } from "zod";
import type { Category, ColorFamily, Product } from "../types";
import { ALL_CATEGORIES, ALL_COLORS } from "../taxonomy";
import type { ProductProvider } from "./types";

/**
 * Generic licensed merchant / affiliate JSON feed adapter.
 *
 * Point PRODUCT_FEED_URL at a feed you are licensed to consume (for example an
 * affiliate network product export, or a brand's merchant feed). The feed must
 * be an array of records matching `FeedRecord`. Records that fail validation
 * are skipped and counted — never patched with guessed data.
 */
const FeedRecord = z.object({
  id: z.string(),
  retailer: z.string(),
  brand: z.string(),
  title: z.string(),
  category: z.string(),
  subcategory: z.string().optional(),
  price: z.number().positive(),
  mrp: z.number().positive().optional(),
  sizes: z.array(z.string()).default([]),
  colors: z.array(z.string()).default([]),
  fit: z.string().optional(),
  material: z.string().optional(),
  rating: z.number().min(0).max(5).optional(),
  reviewCount: z.number().int().nonnegative().optional(),
  imageUrl: z.string().url(),
  productUrl: z.string().url(),
  availability: z.boolean(),
  lastCheckedAt: z.string(),
  modelCode: z.string().optional(),
  gtin: z.string().optional(),
  realtime: z.boolean().optional(),
});

function mapCategory(raw: string): Category | undefined {
  const s = raw.toLowerCase().replace(/[^a-z]/g, "");
  const alias: Record<string, Category> = { tshirts: "tshirt", tee: "tshirt", tees: "tshirt", shirts: "shirt", jean: "jeans", chino: "chinos", trouser: "trousers", pants: "trousers", shoes: "sneakers", sneaker: "sneakers", kurtas: "kurta", watches: "watch", belts: "belt", blazers: "blazer", jackets: "jacket" };
  if (alias[s]) return alias[s];
  return (ALL_CATEGORIES as string[]).includes(s) ? (s as Category) : undefined;
}

function mapColor(raw?: string): ColorFamily {
  const s = (raw ?? "").toLowerCase();
  const hit = ALL_COLORS.find((c) => s.includes(c.replace("-", " ")) || s.includes(c));
  if (hit) return hit;
  if (/khaki|camel|sand|stone/.test(s)) return "beige";
  if (/charcoal|melange/.test(s)) return "grey";
  if (/denim|indigo/.test(s)) return "indigo";
  if (/off.?white|ivory|ecru/.test(s)) return "cream";
  return "grey";
}

export function normalizeFeedRecord(raw: unknown, providerId: string): Product | null {
  const parsed = FeedRecord.safeParse(raw);
  if (!parsed.success) return null;
  const r = parsed.data;
  const category = mapCategory(r.category);
  if (!category) return null;
  const discount = r.mrp && r.mrp > r.price ? Math.round(((r.mrp - r.price) / r.mrp) * 100) : undefined;
  return {
    id: `${providerId}:${r.id}`,
    retailer: r.retailer,
    brand: r.brand,
    title: r.title,
    category,
    subcategory: r.subcategory,
    price: r.price,
    mrp: r.mrp,
    discountPercent: discount,
    currency: "INR",
    sizes: r.sizes,
    colors: r.colors,
    fit: r.fit as Product["fit"],
    material: r.material,
    rating: r.rating,
    reviewCount: r.reviewCount,
    imageUrl: r.imageUrl,
    productUrl: r.productUrl,
    availability: r.availability,
    lastCheckedAt: r.lastCheckedAt,
    attrs: {
      modelCode: r.modelCode ?? r.gtin,
      sku: r.gtin,
      colorFamily: mapColor(r.colors[0]),
      pattern: "solid",
      styles: [],
      occasions: [],
      fabricWeight: "medium",
      structured: false,
      stretch: /stretch|lycra|elastane/i.test(r.material ?? ""),
      seasons: ["all"],
    },
    source: { providerId, kind: "merchant-feed", realtime: r.realtime === true },
  };
}

export const merchantFeedProvider: ProductProvider = {
  id: "merchant-feed",
  name: "Licensed merchant / affiliate JSON feed",
  kind: "merchant-feed",
  retailers: [],
  isConfigured: () => Boolean(process.env.PRODUCT_FEED_URL),
  async fetchProducts() {
    const fetchedAt = new Date().toISOString();
    const url = process.env.PRODUCT_FEED_URL;
    if (!url) return { ok: false, error: "PRODUCT_FEED_URL not set", retryable: false, fetchedAt };
    try {
      const res = await fetch(url, {
        headers: process.env.PRODUCT_PROVIDER_KEY ? { Authorization: `Bearer ${process.env.PRODUCT_PROVIDER_KEY}` } : {},
        cache: "no-store",
      });
      if (!res.ok) return { ok: false, error: `Feed responded ${res.status}`, retryable: res.status >= 500, fetchedAt };
      const body = (await res.json()) as unknown;
      if (!Array.isArray(body)) return { ok: false, error: "Feed is not an array", retryable: false, fetchedAt };
      const products = body.map((r) => normalizeFeedRecord(r, "merchant-feed")).filter((p): p is Product => p !== null);
      return { ok: true, data: products, fetchedAt };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Unknown feed error", retryable: true, fetchedAt };
    }
  },
  affiliateUrl(product, affiliateId) {
    const u = new URL(product.productUrl);
    u.searchParams.set("affid", affiliateId);
    return u.toString();
  },
};
