// ---------------------------------------------------------------------------
// OUTFIT ENGINE + BUDGET OPTIMIZER
// Optimises FIT + STYLE + PRICE + AVAILABILITY + PREFERENCE across complete
// outfits. Hard rule: an outfit never exceeds the user's budget unless the
// request explicitly sets allowOverBudget.
// ---------------------------------------------------------------------------
import type {
  FitAnalysis,
  Occasion,
  Outfit,
  OutfitItem,
  OutfitRequest,
  Product,
  StyleTag,
  UserProfile,
  WardrobeItem,
} from "../types";
import { CATEGORY_LABEL, CATEGORY_SLOT, COLOR_LABEL, FIT_LABEL, OCCASION_LABEL } from "../taxonomy";
import { analyzeFit, type FitContext } from "./fit";
import { outfitHarmony } from "./harmony";
import { dedupeByModel } from "./matching";
import { chooseRecipe, RECIPES, recipeById, type Recipe, type RecipeSlot } from "./recipes";

interface Candidate {
  key: string;
  product?: Product;
  wardrobeItem?: WardrobeItem;
  price: number;
  fit?: FitAnalysis;
  score: number; // 0-100 item score
  styleMatch: number;
  color: WardrobeItem["colorFamily"];
  pattern: WardrobeItem["pattern"];
  category: Product["category"];
  fitType?: Product["fit"];
}

const PER_SLOT = 6;

function occasionMatch(occ: Occasion[], target: Occasion) {
  if (occ.includes(target)) return 100;
  const related: Partial<Record<Occasion, Occasion[]>> = {
    "first-day": ["office", "interview"],
    interview: ["office", "business-meeting"],
    "business-meeting": ["office", "interview"],
    reception: ["wedding", "party"],
    wedding: ["reception", "festival"],
    haldi: ["festival"],
    diwali: ["festival", "wedding"],
    eid: ["festival", "wedding"],
    vacation: ["travel", "casual"],
    travel: ["casual", "vacation"],
    date: ["party", "casual"],
    party: ["date"],
  };
  return (related[target] ?? []).some((o) => occ.includes(o)) ? 70 : 30;
}

function styleMatch(styles: StyleTag[], target: StyleTag[]) {
  if (!target.length) return 70;
  const m = styles.filter((s) => target.includes(s)).length;
  return m === 0 ? 35 : Math.min(100, 70 + m * 15);
}

function weatherAdjust(p: Product, req: OutfitRequest): number {
  const w = req.weather?.condition;
  if (!w) return 0;
  let s = 0;
  const a = p.attrs;
  if (w === "rain") {
    if (CATEGORY_SLOT[p.category] === "footwear") {
      if (a.rainFriendly) s += 12;
      if (/suede|velvet|canvas/i.test(p.material ?? "")) s -= 15;
    }
    if (a.fabricWeight === "heavy") s -= 5;
    if (["white", "cream"].includes(a.colorFamily) && CATEGORY_SLOT[p.category] === "bottom") s -= 6;
  }
  if (w === "hot" || w === "humid") {
    if (a.fabricWeight === "light" || /linen|cotton/i.test(p.material ?? "")) s += 6;
    if (a.fabricWeight === "heavy" || /wool|fleece|corduroy/i.test(p.material ?? "")) s -= 12;
  }
  if (w === "cool" || w === "cold") {
    if (a.fabricWeight === "heavy") s += 6;
    if (a.fabricWeight === "light" && CATEGORY_SLOT[p.category] !== "accessory") s -= 5;
  }
  return s;
}

function wardrobeSlotMatches(item: WardrobeItem, rs: RecipeSlot) {
  return rs.categories.includes(item.category);
}

function buildCandidates(
  recipe: Recipe,
  rs: RecipeSlot,
  catalog: Product[],
  profile: UserProfile,
  req: OutfitRequest,
  ctx: FitContext,
  wardrobe: WardrobeItem[],
  styleTargets: StyleTag[],
): Candidate[] {
  const pool = dedupeByModel(
    catalog.filter(
      (p) =>
        rs.categories.includes(p.category) &&
        p.availability &&
        !p.source.sponsored && // sponsorship never enters personalised optimisation
        (!rs.accept || rs.accept(p)) &&
        !profile.style.avoidColors.includes(p.attrs.colorFamily),
    ),
  );
  const cands: Candidate[] = pool.map((p) => {
    const fit = analyzeFit(p, profile, ctx);
    const occ = occasionMatch(p.attrs.occasions, req.occasion);
    const sm = styleMatch(p.attrs.styles, styleTargets);
    const rating = p.rating ? ((p.rating - 3) / 2) * 100 : 60;
    let score = fit.overall * 0.42 + occ * 0.22 + sm * 0.22 + rating * 0.14 + weatherAdjust(p, req);
    if (fit.risk === "HIGH") score -= 25;
    if (!fit.sizeAvailable && fit.applicable) score -= 12;
    return {
      key: rs.key,
      product: p,
      price: p.price,
      fit,
      score,
      styleMatch: (sm + occ) / 2,
      color: p.attrs.colorFamily,
      pattern: p.attrs.pattern,
      category: p.category,
      fitType: p.fit,
    };
  });
  if (req.useWardrobe) {
    for (const w of wardrobe.filter((w) => wardrobeSlotMatches(w, rs))) {
      const occ = w.occasions.length ? occasionMatch(w.occasions, req.occasion) : 65;
      const sm = styleMatch(w.styles, styleTargets);
      cands.push({
        key: rs.key,
        wardrobeItem: w,
        price: 0,
        score: 85 * 0.42 + occ * 0.22 + sm * 0.22 + 70 * 0.14 + 4, // small bonus: already owned
        styleMatch: (sm + occ) / 2,
        color: w.colorFamily,
        pattern: w.pattern,
        category: w.category,
        fitType: w.fit,
      });
    }
  }
  // Keep a spread of price points so every budget strategy has options.
  const sorted = cands.sort((a, b) => b.score - a.score);
  const top = sorted.slice(0, PER_SLOT);
  const cheapest = [...sorted].filter((c) => c.score > 55).sort((a, b) => a.price - b.price).slice(0, 3);
  const merged = [...top, ...cheapest.filter((c) => !top.includes(c))];
  return merged;
}

function budgetScore(total: number, budget: number) {
  const r = total / budget;
  if (r <= 1) return Math.round(100 - Math.max(0, r - 0.8) * 40);
  return Math.max(0, Math.round(70 - (r - 1) * 300));
}

interface Combo {
  picks: Candidate[];
  total: number;
  fit: number;
  style: number;
  harmony: number;
  harmonyNotes: string[];
  overall: number;
}

function evaluate(picks: Candidate[], budget: number): Combo {
  const total = picks.reduce((s, c) => s + c.price, 0);
  const sized = picks.filter((c) => !c.fit || c.fit.applicable);
  const fit = Math.round(sized.reduce((s, c) => s + (c.fit ? c.fit.overall : 85), 0) / (sized.length || 1));
  const style = Math.round(picks.reduce((s, c) => s + c.styleMatch, 0) / picks.length);
  const h = outfitHarmony(picks.map((c) => ({ color: c.color, pattern: c.pattern, slot: CATEGORY_SLOT[c.category], category: c.category })));
  const b = budgetScore(total, budget);
  const itemAvg = picks.reduce((s, c) => s + c.score, 0) / picks.length;
  const overall = Math.round(fit * 0.3 + style * 0.2 + h.score * 0.25 + b * 0.1 + itemAvg * 0.15);
  return { picks, total, fit, style, harmony: h.score, harmonyNotes: h.notes, overall };
}

function* combos(lists: (Candidate | null)[][], i = 0, acc: (Candidate | null)[] = []): Generator<Candidate[]> {
  if (i === lists.length) {
    yield acc.filter((x): x is Candidate => x !== null);
    return;
  }
  for (const c of lists[i]) yield* combos(lists, i + 1, [...acc, c]);
}

// ---------------------------------------------------------------------------
// Explanations
// ---------------------------------------------------------------------------
function itemWhy(c: Candidate, picks: Candidate[], occasion: Occasion): string {
  const name = CATEGORY_LABEL[c.category].toLowerCase();
  const color = COLOR_LABEL[c.color].toLowerCase();
  if (c.wardrobeItem) return `You already own this ${name} — reusing it keeps the outfit on budget.`;
  const top = picks.find((p) => CATEGORY_SLOT[p.category] === "top" || CATEGORY_SLOT[p.category] === "layer");
  switch (CATEGORY_SLOT[c.category]) {
    case "bottom": {
      const roomyTop = top?.fitType && ["relaxed", "oversized"].includes(top.fitType);
      if (roomyTop && c.fitType && ["straight", "tapered", "regular"].includes(c.fitType))
        return `The ${FIT_LABEL[c.fitType].toLowerCase()}-leg ${name} ${/s$/.test(name) ? "balance" : "balances"} the relaxed upper layer while keeping a clean silhouette.`;
      return `${cap(color)} ${name} in a ${c.fitType ? FIT_LABEL[c.fitType].toLowerCase() : "clean"} cut — ${c.fit?.why.toLowerCase().replace(/\.$/, "") ?? "a steady foundation"}.`;
    }
    case "footwear":
      return `${cap(color)} ${name} suit ${OCCASION_LABEL[occasion].toLowerCase()} and tie in with the ${picks.find((p) => CATEGORY_SLOT[p.category] === "bottom") ? COLOR_LABEL[picks.find((p) => CATEGORY_SLOT[p.category] === "bottom")!.color].toLowerCase() : "base"} bottom.`;
    case "accessory":
      return `A ${color} ${name} finishes the look without adding noise.`;
    case "layer":
      return `The ${color} ${name} adds structure at the shoulder and a second texture. ${c.fit?.risk === "LOW" ? "Low fit risk for your frame." : ""}`.trim();
    default:
      return `${c.fit?.why ?? "Matches your style profile."} ${cap(color)} works as the base for ${OCCASION_LABEL[occasion].toLowerCase()}.`;
  }
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function toOutfit(combo: Combo, recipe: Recipe, req: OutfitRequest, name: string, strategy: Outfit["strategy"], idx: number): Outfit {
  const items: OutfitItem[] = recipe.slots
    .map((rs) => {
      const c = combo.picks.find((p) => p.key === rs.key);
      if (!c) return null;
      return {
        key: rs.key,
        label: rs.label,
        slot: rs.slot,
        product: c.product,
        wardrobeItem: c.wardrobeItem,
        price: c.price,
        fit: c.fit,
        why: itemWhy(c, combo.picks, req.occasion),
      } as OutfitItem;
    })
    .filter((x): x is OutfitItem => x !== null);
  const budget = budgetScore(combo.total, req.budget);
  const owned = items.filter((i) => i.wardrobeItem).length;
  const explanation = [
    `${recipe.name} formula for ${OCCASION_LABEL[req.occasion].toLowerCase()}${req.context ? ` (${req.context})` : ""}.`,
    combo.harmonyNotes[0] ? `${combo.harmonyNotes[0]}.` : "",
    owned ? `Uses ${owned} piece${owned > 1 ? "s" : ""} you already own.` : "",
    req.weather ? weatherNote(req) : "",
  ]
    .filter(Boolean)
    .join(" ");
  return {
    id: `${recipe.id}-${strategy}-${idx}-${combo.picks.map((p) => p.product?.id ?? p.wardrobeItem?.id).join("|").length}`,
    name,
    strategy,
    occasion: req.occasion,
    items,
    total: combo.total,
    scores: { fit: combo.fit, style: combo.style, budget, harmony: combo.harmony, overall: combo.overall },
    explanation,
    recipeId: recipe.id,
    budget: req.budget,
    notes: combo.harmonyNotes,
  };
}

function weatherNote(req: OutfitRequest) {
  const w = req.weather!;
  const where = w.city ? ` in ${w.city}` : "";
  const src = w.source === "provider" ? `${w.providerName ?? "weather provider"} reports` : "you said";
  const map: Record<string, string> = {
    rain: "favours practical, water-friendly footwear and lighter layers",
    hot: "favours breathable, lighter fabrics",
    humid: "favours breathable, lighter fabrics",
    cool: "adds a mid-weight layer",
    cold: "adds a warmer layer",
    mild: "keeps layering optional",
  };
  return `Weather: ${src} ${w.condition}${w.tempC !== undefined ? ` (${Math.round(w.tempC)}°C)` : ""}${where} — ${map[w.condition]}.`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export interface OutfitResult {
  recipe: Recipe;
  outfits: Outfit[];
  cheapestPossible?: number;
  message?: string;
}

export function generateOutfits(
  catalog: Product[],
  profile: UserProfile,
  req: OutfitRequest,
  ctx: FitContext = {},
  wardrobe: WardrobeItem[] = [],
): OutfitResult {
  const recipe = recipeById(req.recipeId) ?? chooseRecipe(req.occasion, req.style, profile.style.styles);
  const styleTargets: StyleTag[] = req.style ? [req.style] : profile.style.styles.length ? profile.style.styles : recipe.styles;
  const needLayer = req.weather && ["cool", "cold"].includes(req.weather.condition);
  const skipLayer = req.weather && ["hot", "humid"].includes(req.weather.condition);

  const lists: (Candidate | null)[][] = recipe.slots.map((rs) => {
    const c = buildCandidates(recipe, rs, catalog, profile, req, ctx, wardrobe, styleTargets);
    const isLayer = rs.slot === "layer";
    if (isLayer && skipLayer) return [null];
    if (rs.optional && !(isLayer && needLayer)) return [null, ...c];
    return c.length ? c : [null];
  });

  const limit = req.allowOverBudget ? Infinity : req.budget;
  const all: Combo[] = [];
  let cheapest = Infinity;
  for (const picks of combos(lists)) {
    const total = picks.reduce((s, c) => s + c.price, 0);
    const required = recipe.slots.filter((s) => !s.optional).every((s) => picks.some((p) => p.key === s.key));
    if (!required) continue;
    cheapest = Math.min(cheapest, total);
    if (total > limit) continue;
    all.push(evaluate(picks, req.budget));
  }

  if (all.length === 0) {
    return {
      recipe,
      outfits: [],
      cheapestPossible: Number.isFinite(cheapest) ? cheapest : undefined,
      message: Number.isFinite(cheapest)
        ? `No complete ${recipe.name.toLowerCase()} outfit fits within ₹${req.budget.toLocaleString("en-IN")} in the current catalogue. The lowest-priced complete look is ₹${cheapest.toLocaleString("en-IN")}.`
        : "Not enough matching products are available right now for this recipe.",
    };
  }

  all.sort((a, b) => b.overall - a.overall);
  const distinct = (a: Combo, b: Combo) => a.picks.filter((p, i) => b.picks[i] && (p.product?.id ?? p.wardrobeItem?.id) !== (b.picks[i].product?.id ?? b.picks[i].wardrobeItem?.id)).length >= 2 || a.picks.length !== b.picks.length;
  const chosen: { combo: Combo; name: string; strategy: Outfit["strategy"] }[] = [];

  const premium = all[0];
  chosen.push({ combo: premium, name: "Premium", strategy: "premium" });
  // Budget Saver: cheapest look that still scores close to the best one.
  const floor = Math.max(66, premium.overall - 10);
  const saver = [...all]
    .filter((c) => c.overall >= floor && c.total <= premium.total * 0.88 && distinct(c, premium))
    .sort((a, b) => a.total - b.total || b.overall - a.overall)[0];
  if (saver) chosen.push({ combo: saver, name: "Budget Saver", strategy: "saver" });
  // Balanced: best look priced between the two.
  if (saver) {
    const balanced = all.find((c) => c.total > saver.total && c.total < premium.total && distinct(c, premium) && distinct(c, saver));
    if (balanced) chosen.push({ combo: balanced, name: "Balanced", strategy: "balanced" });
  }

  // Present cheapest → most complete.
  chosen.sort((a, b) => a.combo.total - b.combo.total);
  if (req.useWardrobe && chosen.every((c) => !c.combo.picks.some((p) => p.wardrobeItem))) {
    const wardrobeFirst = all.find((c) => c.picks.some((p) => p.wardrobeItem));
    if (wardrobeFirst) chosen.unshift({ combo: wardrobeFirst, name: "Use What You Own", strategy: "wardrobe" });
  }
  return { recipe, outfits: chosen.map((c, i) => toOutfit(c.combo, recipe, req, c.name, c.strategy, i)) };
}

/** Change ONE slot while preserving budget, occasion, style and colour harmony. */
export function swapOptions(
  outfit: Outfit,
  key: string,
  catalog: Product[],
  profile: UserProfile,
  req: OutfitRequest,
  ctx: FitContext = {},
  wardrobe: WardrobeItem[] = [],
): Outfit[] {
  const recipe = recipeById(outfit.recipeId);
  if (!recipe) return [];
  const rs = recipe.slots.find((s) => s.key === key);
  if (!rs) return [];
  const styleTargets = req.style ? [req.style] : profile.style.styles;
  const current = outfit.items.find((i) => i.key === key);
  const others = outfit.items.filter((i) => i.key !== key);
  const othersTotal = others.reduce((s, i) => s + i.price, 0);
  const remaining = req.allowOverBudget ? Infinity : req.budget - othersTotal;
  const fixed: Candidate[] = others.map((i) => ({
    key: i.key,
    product: i.product,
    wardrobeItem: i.wardrobeItem,
    price: i.price,
    fit: i.fit,
    score: 80,
    styleMatch: 80,
    color: (i.product?.attrs.colorFamily ?? i.wardrobeItem?.colorFamily)!,
    pattern: (i.product?.attrs.pattern ?? i.wardrobeItem?.pattern)!,
    category: (i.product?.category ?? i.wardrobeItem?.category)!,
    fitType: i.product?.fit ?? i.wardrobeItem?.fit,
  }));
  const pool = buildCandidatesWide(rs, catalog, profile, req, ctx, wardrobe, styleTargets).filter(
    (c) => c.price <= remaining && (c.product?.id ?? c.wardrobeItem?.id) !== (current?.product?.id ?? current?.wardrobeItem?.id),
  );
  const scored = pool
    .map((c) => evaluate([...fixed, c], req.budget))
    .sort((a, b) => b.overall - a.overall)
    .slice(0, 6);
  return scored.map((combo, i) => {
    const o = toOutfit(combo, recipe, req, outfit.name, outfit.strategy, i);
    return { ...o, id: `${outfit.id}-swap-${i}` };
  });
}

function buildCandidatesWide(rs: RecipeSlot, catalog: Product[], profile: UserProfile, req: OutfitRequest, ctx: FitContext, wardrobe: WardrobeItem[], styleTargets: StyleTag[]) {
  const recipe = { id: "wide", name: "", description: "", styles: [], occasions: [], slots: [] } as Recipe;
  return buildCandidates(recipe, rs, catalog, profile, req, ctx, wardrobe, styleTargets).concat(
    // widen: include more of the pool than the optimiser's top-K
    dedupeByModel(catalog.filter((p) => rs.categories.includes(p.category) && p.availability && !p.source.sponsored && (!rs.accept || rs.accept(p))))
      .slice(0, 20)
      .map((p) => {
        const fit = analyzeFit(p, profile, ctx);
        const sm = styleMatch(p.attrs.styles, styleTargets);
        const occ = occasionMatch(p.attrs.occasions, req.occasion);
        return { key: rs.key, product: p, price: p.price, fit, score: fit.overall * 0.5 + sm * 0.25 + occ * 0.25 - (fit.risk === "HIGH" ? 25 : 0), styleMatch: (sm + occ) / 2, color: p.attrs.colorFamily, pattern: p.attrs.pattern, category: p.category, fitType: p.fit };
      }),
  ).filter((c, i, arr) => arr.findIndex((x) => (x.product?.id ?? x.wardrobeItem?.id) === (c.product?.id ?? c.wardrobeItem?.id)) === i);
}

/** "Complete the look" around a product the user is viewing. */
export function completeTheLook(anchor: Product, catalog: Product[], profile: UserProfile, ctx: FitContext = {}): Outfit | null {
  const occasion = anchor.attrs.occasions[0] ?? "casual";
  const preferred = chooseRecipe(occasion, anchor.attrs.styles[0], profile.style.styles);
  const recipe = preferred.slots.some((s) => s.categories.includes(anchor.category)) ? preferred : RECIPES_WITH(anchor);
  if (!recipe) return null;
  const anchorSlot = recipe.slots.find((s) => s.categories.includes(anchor.category))!;
  const req: OutfitRequest = { budget: Math.max(profile.budget.perOutfit, anchor.price * 2.5), occasion, allowOverBudget: false };
  const lockedRecipe: Recipe = {
    ...recipe,
    slots: recipe.slots.map((s) => (s.key === anchorSlot.key ? { ...s, categories: [anchor.category], accept: undefined, optional: false } : s)),
  };
  // The anchor slot may only contain the anchor listing itself.
  const cat = catalog.filter((p) => p.id === anchor.id || p.category !== anchor.category);
  const res = generateOutfitsWithRecipe(cat, profile, req, ctx, lockedRecipe);
  return res.outfits.sort((a, b) => b.scores.overall - a.scores.overall)[0] ?? null;
}

function RECIPES_WITH(p: Product) {
  return RECIPES.filter((r) => r.slots.some((s) => s.categories.includes(p.category))).sort(
    (a, b) => b.styles.filter((s) => p.attrs.styles.includes(s)).length - a.styles.filter((s) => p.attrs.styles.includes(s)).length,
  )[0];
}

function generateOutfitsWithRecipe(catalog: Product[], profile: UserProfile, req: OutfitRequest, ctx: FitContext, recipe: Recipe) {
  const lists: (Candidate | null)[][] = recipe.slots.map((rs) => {
    const c = buildCandidates(recipe, rs, catalog, profile, req, ctx, [], profile.style.styles);
    if (rs.optional) return [null, ...c.slice(0, 3)];
    return c.length ? c.slice(0, 4) : [null];
  });
  const out: Combo[] = [];
  for (const picks of combos(lists)) {
    const required = recipe.slots.filter((s) => !s.optional).every((s) => picks.some((p) => p.key === s.key));
    if (!required) continue;
    const total = picks.reduce((s, c) => s + c.price, 0);
    if (total > req.budget) continue;
    out.push(evaluate(picks, req.budget));
  }
  out.sort((a, b) => b.overall - a.overall);
  return { outfits: out.slice(0, 1).map((c, i) => toOutfit(c, recipe, req, "Complete the look", "balanced", i)) };
}

/** Cheapest complete outfit per recipe with an acceptable overall score. */
export function cheapestOutfits(catalog: Product[], profile: UserProfile, ctx: FitContext = {}): Outfit[] {
  const res: Outfit[] = [];
  for (const r of RECIPES) {
    const occasion = r.occasions[0];
    const req: OutfitRequest = { budget: 100000, occasion, recipeId: r.id };
    const lists = r.slots.filter((s) => !s.optional).map((rs) => buildCandidates(r, rs, catalog, profile, req, ctx, [], r.styles));
    if (lists.some((l) => l.length === 0)) continue;
    let best: Combo | null = null;
    for (const picks of combos(lists)) {
      const total = picks.reduce((s, c) => s + c.price, 0);
      const c = evaluate(picks, total * 1.15);
      if (c.overall < 68) continue;
      if (!best || c.total < best.total) best = c;
    }
    if (best) res.push(toOutfit(best, { ...r, slots: r.slots.filter((s) => !s.optional) }, { ...req, budget: Math.ceil(best.total / 500) * 500 }, r.name, "saver", 0));
  }
  return res.sort((a, b) => a.total - b.total);
}
