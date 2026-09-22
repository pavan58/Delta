// TREND → PERSONAL FIT. Trending ≠ automatically recommended.
import type { Trend } from "../data/trends";
import type { FitType, UserProfile } from "../types";
import { BUILD_LABEL, FIT_LABEL, cmToFeetIn } from "../taxonomy";

export type TrendVerdict = "RECOMMENDED" | "MODERATE" | "SKIP";

export interface PersonalTrend {
  trend: Trend;
  verdict: TrendVerdict;
  recommendation: string;
  avoid?: string;
  reason: string;
  profileSummary: string;
  suggestedFit?: FitType;
}

export function personalizeTrend(t: Trend, profile: UserProfile): PersonalTrend {
  const b = profile.body;
  const short = b.heightCm < 170;
  const tall = b.heightCm > 185;
  const bottom = ["jeans", "trousers", "chinos"].includes(t.category);
  const pref = bottom ? profile.fit.bottoms : profile.fit.tops;
  const prefersRoomy = ["relaxed", "oversized", "straight"].includes(pref);
  const styleOverlap = t.styles.some((s) => profile.style.styles.includes(s));
  const profileSummary = `${BUILD_LABEL[b.build]} · ${cmToFeetIn(b.heightCm)} · prefers ${FIT_LABEL[pref].toLowerCase()} ${bottom ? "bottoms" : "tops"}`;

  let volumeTolerance = 0.9;
  if (b.build === "slim") volumeTolerance -= 0.25;
  if (short) volumeTolerance -= 0.2;
  if (tall || b.build === "big-tall" || b.build === "muscular") volumeTolerance += 0.1;
  if (prefersRoomy) volumeTolerance += 0.15;
  if (["slim", "skinny"].includes(pref)) volumeTolerance -= 0.2;

  if (t.volume <= volumeTolerance) {
    return {
      trend: t,
      verdict: styleOverlap ? "RECOMMENDED" : "MODERATE",
      recommendation: styleOverlap ? `Go for it — ${t.name.toLowerCase()} suit your profile as-is.` : `Compatible with your frame; a small step outside your usual style.`,
      reason: styleOverlap ? "Silhouette volume sits within what balances your proportions, and it overlaps your Style DNA." : "Proportions work; style overlap is limited, so treat it as a low-risk experiment.",
      profileSummary,
      suggestedFit: t.fit,
    };
  }
  if (t.volume - volumeTolerance < 0.35) {
    const moderate: FitType = t.fit === "oversized" ? "relaxed" : t.fit === "relaxed" ? "straight" : "regular";
    return {
      trend: t,
      verdict: "MODERATE",
      recommendation: `MODERATE version — choose a ${FIT_LABEL[moderate].toLowerCase()} cut rather than an extreme one.`,
      avoid: `Extreme ${t.fit ? FIT_LABEL[t.fit].toLowerCase() : ""} ${t.name.toLowerCase()}`.replace(/\s+/g, " "),
      reason: `Maintains proportion${short ? " at your height" : ""}${b.build === "slim" ? " on a leaner frame" : ""} while keeping the current trend.`,
      profileSummary,
      suggestedFit: moderate,
    };
  }
  return {
    trend: t,
    verdict: "SKIP",
    recommendation: "Not the best match right now — try a related, lower-volume take instead.",
    avoid: t.name,
    reason: "The silhouette's volume is well outside what balances your recorded proportions and preferred fit.",
    profileSummary,
    suggestedFit: "regular",
  };
}
