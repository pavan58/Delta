// STYLE EXPERIMENT MODE — low-risk ways to try a new style, reusing as much of
// the user's wardrobe as possible and changing only one or two pieces.
import type { Product, StyleTag, UserProfile, WardrobeItem } from "../types";
import { STYLE_LABEL } from "../taxonomy";
import { analyzeFit, type FitContext } from "./fit";
import { chooseRecipe, RECIPES } from "./recipes";
import { compatible, fromProduct, fromWardrobe } from "./wardrobe";
import { dedupeByModel } from "./matching";

export interface Experiment {
  style: StyleTag;
  title: string;
  risk: "LOW-RISK" | "STARTER";
  owned: WardrobeItem[];
  toBuy: Product[];
  cost: number;
  note: string;
}

const CANDIDATES: StyleTag[] = ["smart-casual", "streetwear", "indo-western", "old-money", "korean", "minimal"];

export function styleExperiments(profile: UserProfile, wardrobe: WardrobeItem[], catalog: Product[], ctx: FitContext = {}): Experiment[] {
  const targets = CANDIDATES.filter((s) => !profile.style.styles.includes(s)).slice(0, 3);
  const pool = dedupeByModel(catalog.filter((p) => p.availability && !p.source.sponsored));
  return targets.map((style) => {
    const recipe = RECIPES.find((r) => r.styles[0] === style) ?? RECIPES.find((r) => r.styles.includes(style)) ?? chooseRecipe("casual", style);
    const owned: WardrobeItem[] = [];
    const toBuy: Product[] = [];
    for (const slot of recipe.slots.filter((s) => !s.optional)) {
      // The base piece carries the new style: reuse it only if what you own already has that style.
      const defining = slot.key === "top";
      const mine = wardrobe.find((w) => slot.categories.includes(w.category) && (!defining || w.styles.includes(style)) && [...owned.map(fromWardrobe), ...toBuy.map(fromProduct)].every((o) => compatible(o, fromWardrobe(w)) > 0));
      if (mine) {
        owned.push(mine);
        continue;
      }
      const best = pool
        .filter((p) => slot.categories.includes(p.category) && p.attrs.styles.some((s) => recipe.styles.includes(s)) && (!slot.accept || slot.accept(p)))
        .map((p) => ({ p, f: analyzeFit(p, profile, ctx) }))
        .filter(({ p, f }) => f.risk !== "HIGH" && [...owned.map(fromWardrobe), ...toBuy.map(fromProduct)].every((o) => compatible(o, fromProduct(p)) > 0))
        .sort((a, b) => b.f.overall - a.f.overall + (a.p.price - b.p.price) / 400)[0];
      if (best) toBuy.push(best.p);
    }
    const cost = toBuy.reduce((s, p) => s + p.price, 0);
    return {
      style,
      title: `Try ${STYLE_LABEL[style].toLowerCase()}`,
      risk: owned.length > 0 && toBuy.length <= 2 ? "LOW-RISK" : "STARTER",
      owned,
      toBuy,
      cost,
      note: owned.length ? `Keeps ${owned.length} piece${owned.length > 1 ? "s" : ""} you own and changes ${toBuy.length}.` : "Add wardrobe items to turn this into a low-risk experiment.",
    } as Experiment;
  });
}
