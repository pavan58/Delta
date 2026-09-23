// ---------------------------------------------------------------------------
// WARDROBE ENGINE — "Buy less, style more"
// Counts outfits the user can already make, finds the single purchase that
// unlocks the most new combinations, and flags redundant purchases.
// ---------------------------------------------------------------------------
import type { Category, ColorFamily, Pattern, Product, StyleTag, WardrobeItem } from "../types";
import { CATEGORY_LABEL, CATEGORY_SLOT, COLOR_LABEL, NEUTRALS } from "../taxonomy";
import { pairHarmony } from "./harmony";

export interface Piece {
  id: string;
  category: Category;
  color: ColorFamily;
  pattern: Pattern;
  styles: StyleTag[];
  label: string;
}

export const fromWardrobe = (w: WardrobeItem): Piece => ({ id: w.id, category: w.category, color: w.colorFamily, pattern: w.pattern, styles: w.styles, label: w.label });
export const fromProduct = (p: Product): Piece => ({ id: p.id, category: p.category, color: p.attrs.colorFamily, pattern: p.attrs.pattern, styles: p.attrs.styles, label: p.title });

const FORMALITY: Partial<Record<Category, number>> = {
  tshirt: 1, polo: 2, shirt: 2.5, kurta: 3, overshirt: 2, jacket: 1.5, blazer: 4, sweater: 3, "nehru-jacket": 4,
  joggers: 0.5, shorts: 0.5, jeans: 1.5, chinos: 2.5, trousers: 3.5,
  sneakers: 1.5, sandals: 0.5, boots: 2.5, loafers: 3, "formal-shoes": 4, mojaris: 3.5,
};
const ETHNIC: Category[] = ["kurta", "nehru-jacket", "mojaris"];

/** Can two pieces be worn together? Returns 0..1 compatibility. */
export function compatible(a: Piece, b: Piece): number {
  const fa = FORMALITY[a.category] ?? 2, fb = FORMALITY[b.category] ?? 2;
  if (Math.abs(fa - fb) > 2) return 0;
  const ethnicA = ETHNIC.includes(a.category), ethnicB = ETHNIC.includes(b.category);
  if (ethnicA !== ethnicB && !(a.category === "trousers" || b.category === "trousers" || a.category === "loafers" || b.category === "loafers")) return 0;
  const h = pairHarmony(a.color, b.color);
  const busy = ["print", "check", "stripe"];
  if (busy.includes(a.pattern) && busy.includes(b.pattern)) return 0;
  return h >= 0.6 ? h : 0;
}

export interface OutfitCombo {
  top: Piece;
  bottom: Piece;
  shoes: Piece;
  layer?: Piece;
}

/** Enumerate top + bottom + shoes (+ optional layer) combinations that work. */
export function enumerateOutfits(pieces: Piece[]): OutfitCombo[] {
  const tops = pieces.filter((p) => CATEGORY_SLOT[p.category] === "top");
  const layers = pieces.filter((p) => CATEGORY_SLOT[p.category] === "layer");
  const bottoms = pieces.filter((p) => CATEGORY_SLOT[p.category] === "bottom");
  const shoes = pieces.filter((p) => CATEGORY_SLOT[p.category] === "footwear");
  const out: OutfitCombo[] = [];
  for (const t of tops)
    for (const b of bottoms) {
      if (!compatible(t, b)) continue;
      for (const s of shoes) {
        if (!compatible(t, s) || !compatible(b, s)) continue;
        out.push({ top: t, bottom: b, shoes: s });
        for (const l of layers) if (compatible(l, t) && compatible(l, b) && compatible(l, s)) out.push({ top: t, bottom: b, shoes: s, layer: l });
      }
    }
  return out;
}

export interface GapSuggestion {
  id: string;
  label: string;
  category: Category;
  color: ColorFamily;
  newOutfits: number;
  compatibleOwned: number;
  priceRange?: [number, number];
  query: string;
  reason: string;
  products: Product[];
}

/** Archetypes FITIQ evaluates as potential "next best purchase". */
const ARCHETYPES: { category: Category; color: ColorFamily; label: string; styles: StyleTag[] }[] = [
  { category: "overshirt", color: "beige", label: "Beige overshirt", styles: ["smart-casual", "minimal"] },
  { category: "overshirt", color: "olive", label: "Olive overshirt", styles: ["smart-casual", "streetwear"] },
  { category: "chinos", color: "navy", label: "Navy chinos", styles: ["smart-casual"] },
  { category: "chinos", color: "beige", label: "Beige chinos", styles: ["smart-casual", "old-money"] },
  { category: "trousers", color: "grey", label: "Charcoal trousers", styles: ["formal"] },
  { category: "jeans", color: "indigo", label: "Dark indigo jeans", styles: ["casual"] },
  { category: "jeans", color: "black", label: "Black jeans", styles: ["casual"] },
  { category: "shirt", color: "white", label: "White oxford shirt", styles: ["smart-casual", "formal"] },
  { category: "shirt", color: "light-blue", label: "Light blue oxford shirt", styles: ["smart-casual"] },
  { category: "polo", color: "navy", label: "Navy polo", styles: ["smart-casual"] },
  { category: "tshirt", color: "white", label: "White crew-neck tee", styles: ["minimal"] },
  { category: "tshirt", color: "black", label: "Black crew-neck tee", styles: ["minimal"] },
  { category: "sneakers", color: "white", label: "White minimal sneakers", styles: ["minimal"] },
  { category: "loafers", color: "brown", label: "Brown loafers", styles: ["smart-casual"] },
  { category: "formal-shoes", color: "black", label: "Black derby shoes", styles: ["formal"] },
  { category: "kurta", color: "cream", label: "Ivory kurta", styles: ["traditional"] },
  { category: "blazer", color: "navy", label: "Navy blazer", styles: ["smart-casual", "formal"] },
];

function redundant(pieces: Piece[], category: Category, color: ColorFamily) {
  return pieces.filter((p) => p.category === category && p.color === color).length;
}

export function wardrobeCounts(items: WardrobeItem[]) {
  const counts = new Map<string, number>();
  for (const i of items) counts.set(CATEGORY_LABEL[i.category], (counts.get(CATEGORY_LABEL[i.category]) ?? 0) + 1);
  return Array.from(counts.entries()).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

export function gapAnalysis(items: WardrobeItem[], catalog: Product[]) {
  const pieces = items.map(fromWardrobe);
  const baseline = enumerateOutfits(pieces).length;
  const suggestions: GapSuggestion[] = [];
  const redundancies: string[] = [];

  for (const a of ARCHETYPES) {
    const owned = redundant(pieces, a.category, a.color);
    if (owned > 0) {
      redundancies.push(`You don't need another ${a.label.toLowerCase()} — you already own ${owned}.`);
      continue;
    }
    const virtual: Piece = { id: `v-${a.label}`, category: a.category, color: a.color, pattern: "solid", styles: a.styles, label: a.label };
    const after = enumerateOutfits([...pieces, virtual]).length;
    const added = after - baseline;
    const compat = pieces.filter((p) => CATEGORY_SLOT[p.category] !== CATEGORY_SLOT[a.category] && compatible(p, virtual) > 0).length;
    const products = catalog
      .filter((p) => p.category === a.category && p.attrs.colorFamily === a.color && p.availability && !p.source.sponsored)
      .sort((x, y) => x.price - y.price);
    const prices = products.map((p) => p.price);
    suggestions.push({
      id: `${a.category}-${a.color}`,
      label: a.label,
      category: a.category,
      color: a.color,
      newOutfits: added,
      compatibleOwned: compat,
      priceRange: prices.length ? [Math.min(...prices), Math.max(...prices)] : undefined,
      query: `${COLOR_LABEL[a.color]} ${CATEGORY_LABEL[a.category]}`.toLowerCase(),
      reason: added > 0 ? `Works with ${compat} piece${compat === 1 ? "" : "s"} you own${NEUTRALS.includes(a.color) ? " and is an easy neutral" : ""}.` : "Few pairings with what you own today.",
      products: products.slice(0, 4),
    });
  }
  suggestions.sort((a, b) => b.newOutfits - a.newOutfits || (a.priceRange?.[0] ?? 1e9) - (b.priceRange?.[0] ?? 1e9));

  // Missing essentials by slot.
  const slots = new Set(pieces.map((p) => CATEGORY_SLOT[p.category]));
  const missingSlots = (["top", "bottom", "footwear"] as const).filter((s) => !slots.has(s));
  return { currentOutfits: baseline, suggestions: suggestions.filter((s) => s.newOutfits > 0).slice(0, 6), redundancies: redundancies.slice(0, 4), missingSlots };
}

/** Wardrobe utility of buying a specific product. */
export function wardrobeUtility(product: Product, items: WardrobeItem[]) {
  const pieces = items.map(fromWardrobe);
  const np = fromProduct(product);
  const baseline = enumerateOutfits(pieces).length;
  const after = enumerateOutfits([...pieces, np]).length;
  const compatibleItems = pieces.filter((p) => CATEGORY_SLOT[p.category] !== CATEGORY_SLOT[product.category] && compatible(p, np) > 0);
  const newOutfits = after - baseline;
  const alreadyOwnSimilar = pieces.filter((p) => p.category === product.category && p.color === product.attrs.colorFamily);
  return {
    compatibleCount: compatibleItems.length,
    compatibleItems: compatibleItems.slice(0, 8),
    newOutfits,
    costPerOutfit: newOutfits > 0 ? Math.round(product.price / newOutfits) : undefined,
    alreadyOwnSimilar: alreadyOwnSimilar.length,
  };
}

/** Outfits using only what the user owns — "Use what you own". */
export function ownedOutfits(items: WardrobeItem[], limit = 6) {
  const combos = enumerateOutfits(items.map(fromWardrobe));
  const scored = combos.map((c) => {
    const parts = [c.top, c.bottom, c.shoes, c.layer].filter(Boolean) as Piece[];
    let s = 0, n = 0;
    for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) (s += compatible(parts[i], parts[j])), n++;
    return { combo: c, score: Math.round((s / n) * 100) };
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}
