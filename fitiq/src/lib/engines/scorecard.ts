// MEN'S STYLE SCORECARD — private product metrics about the user's wardrobe
// and shopping decisions. NOT judgments about appearance.
import type { FitFeedback, Product, UserProfile, WardrobeItem } from "../types";
import { NEUTRALS } from "../taxonomy";
import { analyzeFit } from "./fit";
import { enumerateOutfits, fromWardrobe } from "./wardrobe";

export interface Scorecard {
  metrics: { key: string; label: string; value: number | null; hint: string }[];
}

export function scorecard(profile: UserProfile, wardrobe: WardrobeItem[], feedback: FitFeedback[], catalog: Product[], saved: Product[] = []): Scorecard {
  const perfect = feedback.filter((f) => f.outcome === "perfect").length;
  const fitFromFeedback = feedback.length ? Math.round((perfect / feedback.length) * 100) : null;
  const fitFromSaved = saved.length ? Math.round(saved.reduce((s, p) => s + analyzeFit(p, profile, { feedback }).overall, 0) / saved.length) : null;
  const fitCompat = fitFromFeedback ?? fitFromSaved;

  const colors = wardrobe.map((w) => w.colorFamily);
  const neutralShare = colors.length ? colors.filter((c) => NEUTRALS.includes(c)).length / colors.length : null;
  const harmony = neutralShare === null ? null : Math.round(60 + Math.min(1, neutralShare / 0.7) * 35);

  const outfits = wardrobe.length ? enumerateOutfits(wardrobe.map(fromWardrobe)).length : 0;
  const versatility = wardrobe.length >= 3 ? Math.min(100, Math.round((outfits / wardrobe.length) * 25)) : null;

  const avgSaved = saved.length ? saved.reduce((s, p) => s + p.price, 0) / saved.length : null;
  const budgetEff = avgSaved === null ? null : Math.max(0, Math.min(100, Math.round(100 - Math.max(0, avgSaved / (profile.budget.perOutfit / 3) - 1) * 40)));

  const styles = wardrobe.flatMap((w) => w.styles);
  const inDNA = styles.length ? styles.filter((s) => profile.style.styles.includes(s)).length / styles.length : null;
  const consistency = inDNA === null ? null : Math.round(50 + inDNA * 50);

  return {
    metrics: [
      { key: "fit", label: "Fit Compatibility", value: fitCompat, hint: fitFromFeedback !== null ? "Share of purchases you reported as a perfect fit" : "Average fit score of items you saved" },
      { key: "harmony", label: "Colour Harmony", value: harmony, hint: "How easily your wardrobe colours pair together" },
      { key: "versatility", label: "Wardrobe Versatility", value: versatility, hint: `${outfits} working outfits from ${wardrobe.length} pieces` },
      { key: "budget", label: "Budget Efficiency", value: budgetEff, hint: "Saved items relative to your per-outfit budget" },
      { key: "consistency", label: "Style Consistency", value: consistency, hint: "Wardrobe pieces aligned to your Style DNA" },
    ],
  };
}
