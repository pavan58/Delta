import { describe, expect, it } from "vitest";
import { DEMO_PRODUCTS } from "@/lib/data/demo-catalog";
import { analyzeFit, purchaseConfidence } from "@/lib/engines/fit";
import { generateOutfits, swapOptions } from "@/lib/engines/outfit";
import { exactMatches, similarProducts } from "@/lib/engines/matching";
import { cheaperAlternatives, betterFitAlternatives } from "@/lib/engines/alternatives";
import { gapAnalysis, wardrobeUtility } from "@/lib/engines/wardrobe";
import { parseQuery } from "@/lib/engines/nlp";
import { priceStats } from "@/lib/engines/price";
import { dealScore } from "@/lib/engines/deal";
import { personalizeTrend } from "@/lib/engines/trends";
import { TRENDS } from "@/lib/data/trends";
import type { WardrobeItem } from "@/lib/types";
import { slimProfile } from "./fixtures";

const byCode = (c: string) => DEMO_PRODUCTS.find((p) => p.attrs.modelCode === c)!;

describe("fit engine", () => {
  it("flags a slim-leg jean as higher risk than a straight jean for a relaxed/straight preference", () => {
    const skinny = analyzeFit(byCode("RT-SKN-BLU"), slimProfile);
    const straight = analyzeFit(byCode("UQ-STR-JNS-BLU"), slimProfile);
    expect(straight.overall).toBeGreaterThan(skinny.overall);
    expect(skinny.risk).not.toBe("LOW");
    expect(skinny.riskReasons.join(" ")).toMatch(/slimmer leg/);
  });
  it("recommends a waist size for bottoms and a chest-based size for tops", () => {
    expect(analyzeFit(byCode("HM-STR-CHN-NVY"), slimProfile).recommendedSize).toBe("30");
    expect(analyzeFit(byCode("UQ-OXF-WHT"), slimProfile).recommendedSize).toBe("S");
  });
  it("uses fit feedback for the same brand", () => {
    const p = byCode("UQ-OXF-WHT");
    const fb = [{ id: "1", productId: p.id, brand: "Uniqlo", retailer: "uniqlo", category: "shirt" as const, size: "S", outcome: "too-tight" as const, buyAgain: true, createdAt: new Date().toISOString() }];
    expect(analyzeFit(p, slimProfile, { feedback: fb }).recommendedSize).toBe("M");
  });
  it("watches carry no sizing risk", () => {
    const f = analyzeFit(byCode("TMX-MIN-WCH"), slimProfile);
    expect(f.applicable).toBe(false);
    expect(f.risk).toBe("LOW");
  });
  it("purchase confidence is bounded", () => {
    const c = purchaseConfidence(byCode("HM-STR-CHN-NVY"), slimProfile);
    expect(c.percent).toBeGreaterThan(15);
    expect(c.percent).toBeLessThanOrEqual(97);
  });
});

describe("outfit budget optimizer", () => {
  it("builds smart-casual office outfits for a slim 5'7 user within ₹3,000", () => {
    const res = generateOutfits(DEMO_PRODUCTS, slimProfile, { budget: 3000, occasion: "office", style: "smart-casual" });
    expect(res.outfits.length).toBeGreaterThanOrEqual(2);
    for (const o of res.outfits) {
      expect(o.total).toBeLessThanOrEqual(3000);
      expect(o.items.some((i) => i.slot === "top")).toBe(true);
      expect(o.items.some((i) => i.slot === "bottom")).toBe(true);
      expect(o.items.some((i) => i.slot === "footwear")).toBe(true);
    }
  });
  it("never exceeds budget across occasions", () => {
    for (const [occasion, budget] of [["wedding", 5000], ["college", 2000], ["interview", 4000], ["haldi", 3500]] as const) {
      const res = generateOutfits(DEMO_PRODUCTS, slimProfile, { budget, occasion });
      for (const o of res.outfits) expect(o.total).toBeLessThanOrEqual(budget);
    }
  });
  it("reports the cheapest possible look when budget is too low", () => {
    const res = generateOutfits(DEMO_PRODUCTS, slimProfile, { budget: 500, occasion: "wedding" });
    expect(res.outfits).toHaveLength(0);
    expect(res.cheapestPossible).toBeGreaterThan(500);
  });
  it("swap changes only the requested slot and stays within budget", () => {
    const req = { budget: 5000, occasion: "office" as const, style: "smart-casual" as const };
    const o = generateOutfits(DEMO_PRODUCTS, slimProfile, req).outfits[0];
    const swaps = swapOptions(o, "footwear", DEMO_PRODUCTS, slimProfile, req);
    expect(swaps.length).toBeGreaterThan(0);
    for (const s of swaps) {
      expect(s.total).toBeLessThanOrEqual(5000);
      for (const it of s.items.filter((i) => i.key !== "footwear")) {
        expect(it.product?.id).toBe(o.items.find((x) => x.key === it.key)?.product?.id);
      }
      expect(s.items.find((i) => i.key === "footwear")?.product?.id).not.toBe(o.items.find((i) => i.key === "footwear")?.product?.id);
    }
  });
});

describe("matching", () => {
  it("exact matches share a model code; similar products never do", () => {
    const p = byCode("LEV-511-IND");
    const ex = exactMatches(p, DEMO_PRODUCTS);
    expect(ex.length).toBeGreaterThan(0);
    ex.forEach((m) => expect(m.product.attrs.modelCode).toBe("LEV-511-IND"));
    similarProducts(p, DEMO_PRODUCTS).forEach((m) => expect(m.product.attrs.modelCode).not.toBe("LEV-511-IND"));
  });
  it("cheaper alternatives are actually cheaper; better-fit are better", () => {
    const p = byCode("ADI-STAN-WHT");
    cheaperAlternatives(p, DEMO_PRODUCTS, slimProfile).forEach((a) => expect(a.product.price).toBeLessThan(p.price));
    const j = byCode("RT-SKN-BLU");
    const cur = analyzeFit(j, slimProfile).overall;
    betterFitAlternatives(j, DEMO_PRODUCTS, slimProfile).forEach((a) => expect(a.fit.overall).toBeGreaterThan(cur));
  });
});

describe("wardrobe", () => {
  const w = (id: string, category: WardrobeItem["category"], colorFamily: WardrobeItem["colorFamily"]): WardrobeItem => ({ id, category, colorFamily, pattern: "solid", styles: ["smart-casual"], seasons: ["all"], occasions: [], label: id, addedAt: "" });
  const items = [w("a", "shirt", "white"), w("b", "jeans", "black"), w("c", "jeans", "blue"), w("d", "sneakers", "white"), w("e", "belt", "brown")];
  it("finds gaps and flags redundancy", () => {
    const g = gapAnalysis(items, DEMO_PRODUCTS);
    expect(g.currentOutfits).toBeGreaterThan(0);
    expect(g.suggestions[0].newOutfits).toBeGreaterThan(0);
    expect(g.redundancies.join(" ")).toMatch(/white oxford shirt/i);
  });
  it("computes wardrobe utility", () => {
    const u = wardrobeUtility(byCode("HM-OVS-BEI"), items);
    expect(u.newOutfits).toBeGreaterThan(0);
    expect(u.costPerOutfit).toBeGreaterThan(0);
  });
});

describe("nlp", () => {
  it("parses the core journey", () => {
    const q = parseQuery("Give me a smart casual outfit for a skinny guy under 3000.");
    expect(q).toMatchObject({ budget: 3000, build: "slim", style: "smart-casual" });
  });
  it("parses relationship context", () => {
    const q = parseQuery("Wedding outfit for my brother under 5k");
    expect(q.occasion).toBe("wedding");
    expect(q.budget).toBe(5000);
    expect(q.relationship).toBe("Brother's wedding");
  });
});

describe("prices, deals, trends", () => {
  it("never reports history stats without history", () => {
    const p = DEMO_PRODUCTS[0];
    const s = priceStats(p, []);
    expect(s.hasHistory).toBe(false);
    expect(s.lowest).toBeUndefined();
    const d = dealScore(p, s);
    expect(d.components.find((c) => c.label.includes("history"))).toBeUndefined();
  });
  it("tones down extreme trends for a slim, shorter user", () => {
    const t = TRENDS.find((x) => x.id === "oversized-shirt")!;
    expect(personalizeTrend(t, { ...slimProfile, body: { ...slimProfile.body, heightCm: 170 }, fit: { tops: "relaxed", bottoms: "straight" } }).verdict).toBe("MODERATE");
  });
});

import { styleExperiments } from "@/lib/engines/experiments";
describe("style experiments", () => {
  it("always changes at least one piece", () => {
    const wardrobe: WardrobeItem[] = [
      { id: "a", category: "shirt", colorFamily: "white", pattern: "solid", styles: ["smart-casual"], seasons: ["all"], occasions: [], label: "White shirt", addedAt: "" },
      { id: "b", category: "jeans", colorFamily: "black", pattern: "solid", styles: ["casual"], seasons: ["all"], occasions: [], label: "Black jeans", addedAt: "" },
      { id: "c", category: "sneakers", colorFamily: "white", pattern: "solid", styles: ["minimal"], seasons: ["all"], occasions: [], label: "White sneakers", addedAt: "" },
    ];
    for (const e of styleExperiments(slimProfile, wardrobe, DEMO_PRODUCTS)) {
      expect(e.toBuy.length).toBeGreaterThan(0);
      expect(e.cost).toBeGreaterThan(0);
    }
  });
});
