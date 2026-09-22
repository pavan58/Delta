// Product search. SearchIndex is an interface so the in-memory implementation
// can be swapped for Meilisearch / Typesense / OpenSearch without touching
// callers. Personalised signals (fit, fit risk) are computed after retrieval.
import type { Category, ColorFamily, FitAnalysis, FitRisk, FitType, Occasion, ParsedQuery, Product, StyleTag, UserProfile } from "../types";
import { CATEGORY_LABEL, COLOR_LABEL, OCCASION_LABEL, STYLE_LABEL } from "../taxonomy";
import { analyzeFit, type FitContext } from "../engines/fit";
import { dealScore } from "../engines/deal";
import { exactMatches, dedupeByModel } from "../engines/matching";
import { parseQuery } from "../engines/nlp";
import { priceStats } from "../engines/price";
import type { PricePoint } from "../data/price-history";

export interface SearchParams {
  q?: string;
  minPrice?: number;
  maxPrice?: number;
  minDiscount?: number;
  brands?: string[];
  retailers?: string[];
  colors?: ColorFamily[];
  fits?: FitType[];
  size?: string;
  material?: string;
  minRating?: number;
  occasion?: Occasion;
  style?: StyleTag;
  categories?: Category[];
  minFit?: number;
  fitRisk?: FitRisk[];
  minDeal?: number;
  availableOnly?: boolean;
  sort?: "relevance" | "price-asc" | "price-desc" | "fit" | "deal" | "discount" | "rating";
  page?: number;
  pageSize?: number;
  useNlp?: boolean;
}

export interface SearchHit {
  product: Product;
  fit?: FitAnalysis;
  deal: number;
  offers: number;
  lowestPrice: number;
  relevance: number;
}

export interface SearchResult {
  hits: SearchHit[];
  total: number;
  page: number;
  pageSize: number;
  facets: { brands: [string, number][]; retailers: [string, number][]; colors: [string, number][]; categories: [string, number][]; materials: [string, number][] };
  parsed?: ParsedQuery;
}

export interface SearchIndex {
  search(params: SearchParams, profile: UserProfile | null, ctx: FitContext): SearchResult;
}

const STRUCTURAL = new Set([
  "under", "below", "budget", "rs", "inr", "rupees", "skinny", "slim", "thin", "lean", "fat", "chubby", "heavy", "tall", "short",
  "smart", "casual", "formal", "wedding", "office", "brother", "sister", "friend", "cousin", "work", "party", "date", "college",
  "minimal", "streetwear", "street", "korean", "traditional", "ethnic", "festive", "old", "money", "style", "look", "fit",
]);

function haystack(p: Product) {
  return [
    p.title, p.brand, CATEGORY_LABEL[p.category], p.subcategory ?? "", COLOR_LABEL[p.attrs.colorFamily], p.colors.join(" "),
    p.material ?? "", p.fit ?? "", ...p.attrs.styles.map((s) => STYLE_LABEL[s]), ...p.attrs.occasions.map((o) => OCCASION_LABEL[o]),
  ].join(" ").toLowerCase();
}

function count<T extends string>(vals: T[]): [string, number][] {
  const m = new Map<string, number>();
  for (const v of vals) m.set(v, (m.get(v) ?? 0) + 1);
  return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
}

export class InMemorySearchIndex implements SearchIndex {
  private docs: { p: Product; text: string }[];
  constructor(private catalog: Product[], private history: (p: Product) => PricePoint[]) {
    this.docs = catalog.map((p) => ({ p, text: haystack(p) }));
  }

  search(params: SearchParams, profile: UserProfile | null, ctx: FitContext): SearchResult {
    let parsed: ParsedQuery | undefined;
    const p = { ...params };
    let tokens: string[] = [];
    let structured = false;
    if (p.q && p.q.trim()) {
      if (p.useNlp !== false) {
        parsed = parseQuery(p.q);
        if (parsed.budget && p.maxPrice === undefined) p.maxPrice = parsed.budget;
        if (parsed.category && !p.categories?.length) p.categories = [parsed.category];
        if (parsed.colors.length && !p.colors?.length) p.colors = parsed.colors;
        if (parsed.occasion && !p.occasion) p.occasion = parsed.occasion;
        if (parsed.style && !p.style) p.style = parsed.style;
        tokens = parsed.keywords.filter((k) => !/^\d/.test(k) && !STRUCTURAL.has(k) && !(parsed!.colors as string[]).includes(k));
        structured = Boolean(parsed.category || parsed.occasion || parsed.style || parsed.colors.length || parsed.budget);
      } else tokens = p.q.toLowerCase().split(/\s+/).filter(Boolean);
    }

    const docs = this.docs.filter(({ p: d }) => {
      if (p.availableOnly && !d.availability) return false;
      if (p.minPrice !== undefined && d.price < p.minPrice) return false;
      if (p.maxPrice !== undefined && d.price > p.maxPrice) return false;
      if (p.minDiscount !== undefined && (d.discountPercent ?? 0) < p.minDiscount) return false;
      if (p.brands?.length && !p.brands.includes(d.brand)) return false;
      if (p.retailers?.length && !p.retailers.includes(d.retailer)) return false;
      if (p.colors?.length && !p.colors.includes(d.attrs.colorFamily)) return false;
      if (p.fits?.length && (!d.fit || !p.fits.includes(d.fit))) return false;
      if (p.size && !d.sizes.includes(p.size)) return false;
      if (p.material && !(d.material ?? "").toLowerCase().includes(p.material.toLowerCase())) return false;
      if (p.minRating !== undefined && (d.rating ?? 0) < p.minRating) return false;
      if (p.occasion && !d.attrs.occasions.includes(p.occasion)) return false;
      if (p.style && !d.attrs.styles.includes(p.style)) return false;
      if (p.categories?.length && !p.categories.includes(d.category)) return false;
      return true;
    });

    const scored = docs.map(({ p: d, text }) => {
      const rel = tokens.length ? tokens.reduce((s, t) => s + (text.includes(t) ? 1 : 0), 0) / tokens.length : 1;
      return { d, rel };
    }).filter((x) => !tokens.length || x.rel > 0 || structured);

    // One card per model; count offers across retailers.
    const reps = dedupeByModel(scored.map((s) => s.d));
    const relOf = new Map(scored.map((s) => [s.d.id, s.rel]));
    let hits: SearchHit[] = reps.map((d) => {
      const offers = exactMatches(d, this.catalog).filter((o) => o.product.availability);
      const fit = profile ? analyzeFit(d, profile, ctx) : undefined;
      const stats = priceStats(d, this.history(d));
      return {
        product: d,
        fit,
        deal: dealScore(d, stats, profile).score,
        offers: offers.length + 1,
        lowestPrice: Math.min(d.price, ...offers.map((o) => o.product.price)),
        relevance: (relOf.get(d.id) ?? 0) * 100 + (d.attrs.popularity ?? 50) / 10 + (fit ? fit.overall / 5 : 0),
      };
    });

    if (p.minFit !== undefined && profile) hits = hits.filter((h) => (h.fit?.overall ?? 0) >= p.minFit!);
    if (p.fitRisk?.length && profile) hits = hits.filter((h) => h.fit && p.fitRisk!.includes(h.fit.risk));
    if (p.minDeal !== undefined) hits = hits.filter((h) => h.deal >= p.minDeal!);

    const sorters: Record<NonNullable<SearchParams["sort"]>, (a: SearchHit, b: SearchHit) => number> = {
      relevance: (a, b) => b.relevance - a.relevance,
      "price-asc": (a, b) => a.product.price - b.product.price,
      "price-desc": (a, b) => b.product.price - a.product.price,
      fit: (a, b) => (b.fit?.overall ?? 0) - (a.fit?.overall ?? 0),
      deal: (a, b) => b.deal - a.deal,
      discount: (a, b) => (b.product.discountPercent ?? 0) - (a.product.discountPercent ?? 0),
      rating: (a, b) => (b.product.rating ?? 0) - (a.product.rating ?? 0),
    };
    // Sponsored items are never boosted by relevance; they keep their organic position.
    hits.sort(sorters[p.sort ?? (profile ? "fit" : "relevance")]);

    const all = hits.map((h) => h.product);
    const pageSize = Math.min(p.pageSize ?? 24, 60);
    const page = Math.max(1, p.page ?? 1);
    return {
      hits: hits.slice((page - 1) * pageSize, page * pageSize),
      total: hits.length,
      page,
      pageSize,
      facets: {
        brands: count(all.map((x) => x.brand)),
        retailers: count(all.map((x) => x.retailer)),
        colors: count(all.map((x) => x.attrs.colorFamily)),
        categories: count(all.map((x) => x.category)),
        materials: count(all.map((x) => (x.material ?? "Unknown").split(" ")[0])),
      },
      parsed,
    };
  }
}
