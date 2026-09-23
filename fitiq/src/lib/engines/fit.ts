// ---------------------------------------------------------------------------
// FIT INTELLIGENCE ENGINE
//
// Produces a *shopping recommendation score* — not a medical or scientific
// measurement. Inputs: body profile, preferred fit, garment attributes,
// size chart (when the feed supplies one), brand sizing and the user's own
// fit feedback / size map.
// ---------------------------------------------------------------------------
import type {
  BodyBuild,
  Category,
  FitAnalysis,
  FitFeedback,
  FitRisk,
  FitType,
  Product,
  PurchaseConfidence,
  SizeMapEntry,
  UserProfile,
} from "../types";
import { BOTTOM_CATEGORIES, CATEGORY_LABEL, CATEGORY_SLOT, FIT_LABEL, FOOTWEAR_CATEGORIES, NON_SIZED } from "../taxonomy";

export interface FitContext {
  feedback?: FitFeedback[];
  sizeMap?: SizeMapEntry[];
}

type FitTable = Record<FitType, number>;

/** Recommended-silhouette tables: how well each cut tends to balance a build. */
const BODY_TOP: Record<BodyBuild, FitTable> = {
  slim: { skinny: 50, slim: 78, regular: 92, straight: 90, tapered: 85, relaxed: 90, oversized: 72 },
  average: { skinny: 55, slim: 85, regular: 92, straight: 90, tapered: 88, relaxed: 87, oversized: 76 },
  athletic: { skinny: 50, slim: 90, regular: 91, straight: 88, tapered: 90, relaxed: 82, oversized: 72 },
  muscular: { skinny: 35, slim: 70, regular: 92, straight: 88, tapered: 86, relaxed: 89, oversized: 76 },
  fuller: { skinny: 30, slim: 60, regular: 90, straight: 92, tapered: 70, relaxed: 88, oversized: 68 },
  "big-tall": { skinny: 30, slim: 62, regular: 92, straight: 92, tapered: 75, relaxed: 88, oversized: 72 },
};

const BODY_BOTTOM: Record<BodyBuild, FitTable> = {
  slim: { skinny: 55, slim: 80, regular: 88, straight: 95, tapered: 88, relaxed: 84, oversized: 62 },
  average: { skinny: 55, slim: 85, regular: 90, straight: 92, tapered: 92, relaxed: 83, oversized: 65 },
  athletic: { skinny: 45, slim: 78, regular: 88, straight: 88, tapered: 95, relaxed: 85, oversized: 65 },
  muscular: { skinny: 30, slim: 65, regular: 88, straight: 90, tapered: 92, relaxed: 90, oversized: 70 },
  fuller: { skinny: 30, slim: 60, regular: 90, straight: 94, tapered: 76, relaxed: 90, oversized: 65 },
  "big-tall": { skinny: 30, slim: 62, regular: 90, straight: 94, tapered: 80, relaxed: 90, oversized: 68 },
};

/** Position of each cut on a close → roomy scale. */
const FIT_AXIS: Record<FitType, number> = { skinny: 0, slim: 1, tapered: 1.8, regular: 2, straight: 2.4, relaxed: 3.2, oversized: 4.3 };

const TOP_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL"];
const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

export function isBottom(c: Category) {
  return BOTTOM_CATEGORIES.includes(c);
}
export function isFootwear(c: Category) {
  return FOOTWEAR_CATEGORIES.includes(c);
}
export function isSized(c: Category) {
  return !NON_SIZED.includes(c);
}
function isTop(c: Category) {
  const s = CATEGORY_SLOT[c];
  return s === "top" || s === "layer";
}

/** Group used to transfer feedback between closely related categories. */
function sizeGroup(c: Category): string {
  if (isBottom(c)) return "bottom";
  if (isFootwear(c)) return "footwear";
  if (isTop(c)) return "top";
  return c;
}

// ---------------------------------------------------------------------------
// Size recommendation
// ---------------------------------------------------------------------------
interface SizePick {
  size?: string;
  confidence: number;
  note?: string;
  between?: boolean;
  basis: "chart" | "feedback" | "size-map" | "standard" | "none";
  issues: string[];
  evidence: string[];
}

function topEase(fit?: FitType) {
  return ({ skinny: -2, slim: -1.5, regular: 0, straight: 0.5, tapered: 0, relaxed: 2.5, oversized: 6 } as Record<FitType, number>)[fit ?? "regular"] ?? 0;
}

function brandFeedback(p: Product, ctx: FitContext) {
  const g = sizeGroup(p.category);
  return (ctx.feedback ?? [])
    .filter((f) => f.brand.toLowerCase() === p.brand.toLowerCase() && sizeGroup(f.category) === g)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function shiftSize(sizes: string[], size: string, by: number): string | undefined {
  const i = sizes.indexOf(size);
  if (i < 0) return undefined;
  return sizes[i + by];
}

function pickSize(p: Product, profile: UserProfile, ctx: FitContext): SizePick {
  const b = profile.body;
  const issues: string[] = [];
  const evidence: string[] = [];
  const chart = p.attrs.sizeChart;
  const sizing = p.attrs.brandSizing ?? "true";

  // 1) The user's own feedback for this brand is the strongest signal.
  const fb = brandFeedback(p, ctx)[0];
  if (fb) {
    const ladder = isBottom(p.category) || isFootwear(p.category) ? Object.keys(chart ?? {}).length ? Object.keys(chart!) : p.sizes : TOP_SIZES;
    let size: string | undefined = fb.size;
    if (fb.outcome === "too-tight") size = shiftSize(ladder, fb.size, 1) ?? fb.size;
    if (fb.outcome === "too-loose") size = shiftSize(ladder, fb.size, -1) ?? fb.size;
    const perfect = fb.outcome === "perfect";
    if (perfect) evidence.push(`Your previous ${p.brand} purchase in ${fb.size} fit well`);
    else issues.push(`Your last ${p.brand} ${CATEGORY_LABEL[fb.category].toLowerCase()} in ${fb.size} was ${fb.outcome.replace("-", " ")} — adjusted to ${size}`);
    return {
      size,
      confidence: perfect ? 95 : fb.outcome === "too-short" || fb.outcome === "too-long" ? 72 : 80,
      basis: "feedback",
      note: perfect ? `Based on your ${p.brand} feedback` : `Adjusted from your ${p.brand} feedback`,
      issues,
      evidence,
    };
  }

  // 2) Personal size map (manual entries).
  const mapped = (ctx.sizeMap ?? []).find(
    (s) => s.brand.toLowerCase() === p.brand.toLowerCase() && sizeGroup(s.category) === sizeGroup(p.category),
  );
  if (mapped) {
    evidence.push(`Your size map lists ${mapped.size} for ${p.brand}`);
    return { size: mapped.size, confidence: 86, basis: "size-map", note: "From your size map", issues, evidence };
  }

  // 3) Footwear.
  if (isFootwear(p.category)) {
    if (!b.shoeUK) return { confidence: 55, basis: "none", note: "Add your shoe size for a size pick", issues: ["Shoe size not in your profile"], evidence };
    let s = b.shoeUK;
    if (sizing === "runs-small") {
      s += 1;
      issues.push("This style is reported to run small — sized up by one");
    }
    if (sizing === "runs-large") {
      s -= 1;
      issues.push("This style is reported to run large — sized down by one");
    }
    return { size: String(s), confidence: sizing === "true" ? 84 : 74, basis: "standard", issues, evidence };
  }

  // 4) Bottoms and belts use waist.
  if (isBottom(p.category) || p.category === "belt") {
    const waist = b.waistIn;
    const sizes = chart ? Object.keys(chart).map(Number) : [28, 30, 32, 34, 36, 38, 40];
    let designed = sizes.find((s) => s >= waist - 0.25) ?? sizes[sizes.length - 1];
    let conf = chart ? 88 : 64;
    let between = false;
    if (Math.abs(designed - waist) >= 0.75 && Math.abs(designed - waist) < 2) {
      between = true;
      conf -= 10;
      issues.push(
        p.attrs.stretch
          ? `Your waist (${waist}") sits between sizes; the stretch fabric should help`
          : `Your waist (${waist}") sits between sizes — ${designed} may feel slightly roomy`,
      );
    }
    if (sizing === "runs-small") {
      const up = sizes[sizes.indexOf(designed) + 1];
      if (up) designed = up;
      conf -= 4;
      issues.push("Brand runs small — sized up");
    }
    if (chart) evidence.push(`Garment size chart available (${designed}" waist)`);
    else issues.push("No garment size chart supplied by this retailer");

    // Leg length check against inseam when both are known.
    const inseam = chart?.[String(designed)]?.inseam;
    if (b.inseamIn && inseam && p.category !== "shorts") {
      if (inseam - b.inseamIn > 1.5) issues.push(`Inseam is ~${Math.round(inseam - b.inseamIn)}" longer than yours — may need hemming`);
      if (b.inseamIn - inseam > 1.5) issues.push("Inseam may be slightly short for your leg length");
    } else if (!b.inseamIn && profile.body.heightCm < 168 && p.category !== "shorts" && p.attrs.lengthProfile !== "cropped") {
      issues.push("Standard 31–32\" inseam may need a small hem at your height");
    }
    return { size: String(designed), confidence: conf, between, basis: chart ? "chart" : "standard", issues, evidence };
  }

  // 5) Tops.
  const chest = b.chestIn;
  const ease = topEase(p.fit) + 4;
  let size: string | undefined;
  let conf = chart ? 88 : 62;
  let between = false;
  if (chart) {
    const entries = Object.entries(chart).filter(([, m]) => m.chest);
    // Designed body chest = garment chest − standard ease − fit ease.
    const designed = entries.map(([s, m]) => ({ s, body: (m.chest as number) - ease }));
    const pick = designed.find((d) => d.body >= chest - 0.5) ?? designed[designed.length - 1];
    size = pick?.s;
    if (pick && pick.body - chest >= 1 && pick.body - chest < 2) {
      between = true;
      conf -= 8;
      issues.push(`Your chest (${chest}") sits between sizes — ${size} is the roomier choice`);
    }
    if (pick && chest - pick.body > 0.5) {
      conf -= 25;
      issues.push("Your chest measurement is above this product's largest size");
    }
    // Shoulder check
    const m = size ? chart[size] : undefined;
    if (b.shoulderIn && m?.shoulder) {
      if (m.shoulder < b.shoulderIn - 0.5) issues.push("May feel snug across the shoulders");
      else if (m.shoulder > b.shoulderIn + 2 && p.fit !== "oversized") issues.push("Shoulder seam may sit slightly past your shoulder");
    }
    evidence.push(`Garment size chart available (${size}: ${m?.chest}" chest)`);
  } else {
    // Standard Indian menswear sizing when no chart: S 36–38, M 38–40, L 40–42, XL 42–44, XXL 44–46.
    const idx = clamp(Math.ceil((chest - 38) / 2) + 1, 0, 5);
    size = ["S", "S", "M", "L", "XL", "XXL"][idx];
    issues.push("No garment size chart from this retailer — using standard sizing");
  }
  if (sizing === "runs-small") {
    size = size ? shiftSize(TOP_SIZES, size, 1) ?? size : size;
    conf -= 4;
    issues.push("Brand runs small — sized up");
  } else if (sizing === "runs-large") {
    size = size ? shiftSize(TOP_SIZES, size, -1) ?? size : size;
    conf -= 4;
    issues.push("Brand runs large — sized down");
  }
  // Length / sleeve by height.
  const h = profile.body.heightCm;
  if (h < 168 && (p.attrs.lengthProfile === "long" || p.fit === "oversized")) issues.push("Sleeves and body length may feel slightly long at your height");
  if (h > 185 && p.attrs.lengthProfile !== "long") issues.push("Body length may feel slightly short — check the length on the size chart");
  return { size, confidence: conf, between, basis: chart ? "chart" : "standard", issues, evidence };
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------
function preferredFitFor(profile: UserProfile, c: Category): FitType {
  return isBottom(c) ? profile.fit.bottoms : profile.fit.tops;
}

function bodyScore(p: Product, profile: UserProfile): { score: number; notes: string[]; positives: string[] } {
  const notes: string[] = [];
  const positives: string[] = [];
  const build = profile.body.build;
  const fit = p.fit ?? "regular";
  const table = isBottom(p.category) ? BODY_BOTTOM[build] : BODY_TOP[build];
  let s = isFootwear(p.category) || p.category === "belt" ? 88 : table[fit];
  const a = p.attrs;
  const h = profile.body.heightCm;

  if (!isFootwear(p.category) && p.category !== "belt") {
    if (build === "slim") {
      if (a.fabricWeight !== "light" && !isBottom(p.category)) (s += 3), positives.push("mid-to-heavy fabric adds shape to a lean frame");
      if (a.structured && !isBottom(p.category)) (s += 3), positives.push("structured cut builds the shoulder line");
      if (a.pattern === "texture") (s += 2), positives.push("texture adds visual depth");
      if (fit === "oversized") notes.push("Very roomy cuts can swamp a narrower frame — a moderate relaxed fit keeps proportion");
      if (fit === "skinny") notes.push("A skinny leg can exaggerate a lean frame; straight or regular balances better");
    }
    if (build === "fuller" || build === "big-tall") {
      if (a.structured) (s += 4), positives.push("structure gives a clean line from the shoulder");
      if (a.stretch && (fit === "slim" || fit === "skinny") && a.fabricWeight === "light") (s -= 8), notes.push("Light stretch fabric in a close cut sits closer through the midsection; regular or straight offers more comfort");
      if (["navy", "black", "indigo", "grey", "olive", "brown"].includes(a.colorFamily)) (s += 2), positives.push("deeper tone works well for tonal outfits");
      if (a.pattern === "check" || a.pattern === "print") s -= 3;
      if (fit === "slim" || fit === "skinny") notes.push("Close cuts reduce comfort; a straight or regular silhouette is the recommended proportion");
    }
    if (build === "muscular" || build === "athletic") {
      if (a.stretch) (s += 3), positives.push("stretch gives room to move through chest and thighs");
      if (fit === "skinny") notes.push("A skinny cut can restrict movement through the thighs");
      if (build === "muscular" && fit === "slim" && !a.stretch) notes.push("Non-stretch slim cuts can pull across the chest and arms");
    }
    if (h < 168) {
      if (fit === "oversized") (s -= 6), notes.push("At your height, extreme oversizing shortens the leg line — go moderate");
      if (a.lengthProfile === "long" && !["kurta"].includes(p.category)) s -= 5;
      if (a.lengthProfile === "cropped") (s += 2), positives.push("shorter length lengthens the leg line");
    }
    if (h > 185 && a.lengthProfile === "cropped") (s -= 8), notes.push("Cropped lengths may ride up at your height");
  }
  return { score: clamp(Math.round(s)), notes, positives };
}

function silhouetteScore(p: Product, profile: UserProfile): { score: number; note?: string } {
  if (isFootwear(p.category) || p.category === "belt" || !p.fit) return { score: 88 };
  const pref = preferredFitFor(profile, p.category);
  const d = FIT_AXIS[p.fit] - FIT_AXIS[pref];
  const score = clamp(Math.round(100 - 17 * Math.abs(d)), 25, 100);
  if (Math.abs(d) < 0.7) return { score };
  const part = isBottom(p.category) ? "leg" : "body";
  const note =
    d < 0
      ? `Your preferred fit is ${FIT_LABEL[pref].toLowerCase()}. This product has a slimmer ${part} profile.`
      : `Your preferred fit is ${FIT_LABEL[pref].toLowerCase()}. This product has a roomier ${part} profile.`;
  return { score, note };
}

export function styleScore(p: Product, profile: UserProfile): number {
  const st = profile.style;
  const matches = p.attrs.styles.filter((s) => st.styles.includes(s)).length;
  let s = p.attrs.styles.length === 0 ? 60 : matches ? 72 + 9 * Math.min(matches, 3) : 48;
  if (st.colors.includes(p.attrs.colorFamily)) s += 5;
  if (st.avoidColors.includes(p.attrs.colorFamily)) s -= 20;
  if (st.patterns.length && p.attrs.pattern !== "solid") s += st.patterns.includes(p.attrs.pattern) ? 3 : -6;
  if (st.brands.some((b) => b.toLowerCase() === p.brand.toLowerCase())) s += 4;
  if (st.materials.length && p.material && st.materials.some((m) => p.material!.toLowerCase().includes(m.toLowerCase()))) s += 3;
  return clamp(Math.round(s));
}

function riskFrom(core: number, sizeAvailable: boolean): FitRisk {
  let r: FitRisk = core >= 80 ? "LOW" : core >= 66 ? "MEDIUM" : "HIGH";
  if (!sizeAvailable && r === "LOW") r = "MEDIUM";
  return r;
}

export function analyzeFit(p: Product, profile: UserProfile, ctx: FitContext = {}): FitAnalysis {
  const style = styleScore(p, profile);
  if (!isSized(p.category)) {
    return {
      overall: style,
      body: 100,
      silhouette: 100,
      sizeConfidence: 100,
      style,
      risk: "LOW",
      riskReasons: ["No body sizing needed for this item"],
      sizeAvailable: p.availability,
      applicable: false,
      why: style >= 80 ? "Matches your style profile; no sizing risk." : "No sizing risk, but it's a step away from your usual style.",
    };
  }

  const body = bodyScore(p, profile);
  const sil = silhouetteScore(p, profile);
  const size = pickSize(p, profile, ctx);
  const sizeAvailable = Boolean(size.size && p.availability && p.sizes.includes(size.size));
  let sizeConfidence = size.confidence;
  if (!sizeAvailable) sizeConfidence -= 20;
  sizeConfidence = clamp(Math.round(sizeConfidence));

  const overall = Math.round(body.score * 0.3 + sil.score * 0.3 + sizeConfidence * 0.2 + style * 0.2);
  const core = body.score * 0.35 + sil.score * 0.4 + sizeConfidence * 0.25;
  const risk = riskFrom(core, sizeAvailable);

  const reasons: string[] = [];
  if (sil.note) reasons.push(sil.note);
  reasons.push(...body.notes);
  if (!sizeAvailable && size.size) reasons.push(`Your likely size (${size.size}) is not currently listed as available`);
  reasons.push(...size.issues.filter((i) => /between|above|snug|No garment/.test(i)));
  if (reasons.length === 0) reasons.push("Cut, size range and fabric line up with your profile");

  const why = explainFit(p, profile, body.positives, sil.score, size);
  return {
    overall,
    body: body.score,
    silhouette: sil.score,
    sizeConfidence,
    style,
    risk,
    riskReasons: reasons.slice(0, 3),
    recommendedSize: size.size,
    sizeAvailable,
    sizeNote: size.note,
    applicable: true,
    why,
  };
}

function explainFit(p: Product, profile: UserProfile, positives: string[], sil: number, size: SizePick): string {
  const bits: string[] = [];
  const fitName = p.fit ? FIT_LABEL[p.fit].toLowerCase() : "";
  if (sil >= 85 && fitName) bits.push(`the ${fitName} cut ${sil >= 96 ? "matches" : "sits close to"} your preferred ${isBottom(p.category) ? "leg" : "fit"}`);
  if (positives[0]) bits.push(positives[0]);
  if (size.basis === "feedback" && size.confidence > 90) bits.push(`your past ${p.brand} size carries over`);
  else if (size.basis === "chart" && !size.between) bits.push("your measurements sit inside one size");
  if (bits.length === 0) return `A workable option, though the cut is a step away from your preferred ${fitName ? "silhouette" : "fit"}.`;
  const s = bits.length > 1 ? `${bits.slice(0, -1).join(", ")} and ${bits[bits.length - 1]}` : bits[0];
  return s.charAt(0).toUpperCase() + s.slice(1) + ".";
}

// ---------------------------------------------------------------------------
// Purchase confidence (return-risk indicator — not a guarantee)
// ---------------------------------------------------------------------------
export function purchaseConfidence(p: Product, profile: UserProfile, ctx: FitContext = {}, fit = analyzeFit(p, profile, ctx)): PurchaseConfidence {
  const evidence: string[] = [];
  const issues: string[] = [];
  const size = isSized(p.category) ? pickSize(p, profile, ctx) : undefined;

  if (fit.applicable) {
    if (fit.sizeConfidence >= 80) evidence.push(`Your measurements match size ${fit.recommendedSize}`);
    evidence.push(...(size?.evidence ?? []).filter((e) => !evidence.includes(e)));
    if (fit.silhouette >= 80) evidence.push("Preferred silhouette matches");
    if (fit.sizeAvailable) evidence.push(`Size ${fit.recommendedSize} currently listed in stock`);
    else issues.push(fit.recommendedSize ? `Size ${fit.recommendedSize} not listed as available` : "Could not determine a size");
    issues.push(...(size?.issues ?? []));
    if (fit.silhouette < 70 && fit.riskReasons[0]) issues.push(fit.riskReasons[0]);
  } else {
    evidence.push("No sizing needed");
  }
  const fb = brandFeedback(p, ctx)[0];
  if (fb && !fb.buyAgain) issues.push(`You said you wouldn't buy ${p.brand} again`);

  let ratingPts = 0;
  if (p.rating && p.reviewCount) {
    if (p.rating >= 4.2 && p.reviewCount >= 200) {
      evidence.push(`Well rated (${p.rating}★ from ${p.reviewCount.toLocaleString("en-IN")} reviews)`);
      ratingPts = 8;
    } else if (p.rating < 3.8) issues.push(`Below-average rating (${p.rating}★)`);
  }
  if (!p.availability) issues.push("Currently listed as unavailable");

  const base = fit.overall * 0.55 + fit.sizeConfidence * 0.3 + 12 + ratingPts;
  const percent = clamp(Math.round(base - issues.length * 4), 15, 97);
  return { percent, evidence: Array.from(new Set(evidence)).slice(0, 6), issues: Array.from(new Set(issues)).slice(0, 4) };
}

export const RISK_META: Record<FitRisk, { label: string; emoji: string; tone: string }> = {
  LOW: { label: "Low fit risk", emoji: "🟢", tone: "low" },
  MEDIUM: { label: "Medium fit risk", emoji: "🟡", tone: "med" },
  HIGH: { label: "High fit risk", emoji: "🔴", tone: "high" },
};
