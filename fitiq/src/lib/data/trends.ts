import type { Category, FitType, StyleTag } from "../types";

// Trend records. In DEMO MODE there is no licensed trend data source, so every
// trend is labelled "FITIQ editorial recommendation" and carries NO statistics.
// A real TrendProvider (search-trend API, merchant popularity feed) attaches
// `source` + `metric` — the UI only shows a metric when one exists.
export interface Trend {
  id: string;
  name: string;
  description: string;
  category: Category;
  fit?: FitType;
  styles: StyleTag[];
  /** How extreme the silhouette is: 0 subtle → 1 extreme. Drives personal-fit logic. */
  volume: number;
  source: { kind: "editorial" | "search-trends" | "merchant-popularity"; label: string; url?: string; asOf?: string };
  metric?: { label: string; value: string };
  query: string;
}

export const TRENDS: Trend[] = [
  { id: "oversized-shirt", name: "Oversized shirts", description: "Dropped shoulders and a longer body, worn open or half-tucked.", category: "shirt", fit: "oversized", styles: ["streetwear", "korean", "casual"], volume: 0.9, source: { kind: "editorial", label: "FITIQ editorial recommendation" }, query: "oversized shirt" },
  { id: "overshirt", name: "Utility overshirts", description: "A structured shirt-jacket that works as a light layer over tees.", category: "overshirt", fit: "relaxed", styles: ["smart-casual", "streetwear", "minimal"], volume: 0.4, source: { kind: "editorial", label: "FITIQ editorial recommendation" }, query: "overshirt" },
  { id: "wide-leg", name: "Wide-leg & baggy denim", description: "Fuller leg openings, often with a longer break.", category: "jeans", fit: "relaxed", styles: ["streetwear", "korean"], volume: 0.85, source: { kind: "editorial", label: "FITIQ editorial recommendation" }, query: "baggy jeans" },
  { id: "pleated-trousers", name: "Pleated trousers", description: "Pleats add room at the hip; pairs with knit polos and loafers.", category: "trousers", fit: "straight", styles: ["old-money", "smart-casual", "korean"], volume: 0.5, source: { kind: "editorial", label: "FITIQ editorial recommendation" }, query: "pleated trousers" },
  { id: "knit-polo", name: "Knitted polos", description: "Textured knit polos as a smarter alternative to tees.", category: "polo", fit: "regular", styles: ["old-money", "korean", "smart-casual"], volume: 0.2, source: { kind: "editorial", label: "FITIQ editorial recommendation" }, query: "knitted polo" },
  { id: "short-kurta", name: "Short kurtas", description: "Hip-length kurtas worn with trousers or jeans for festive-casual.", category: "kurta", fit: "regular", styles: ["indo-western", "traditional"], volume: 0.3, source: { kind: "editorial", label: "FITIQ editorial recommendation" }, query: "short kurta" },
  { id: "boxy-tee", name: "Heavyweight boxy tees", description: "Thick cotton, wide body and dropped shoulders.", category: "tshirt", fit: "oversized", styles: ["streetwear", "korean", "casual"], volume: 0.7, source: { kind: "editorial", label: "FITIQ editorial recommendation" }, query: "oversized heavyweight t-shirt" },
  { id: "linen", name: "Linen shirts", description: "Breathable, textured shirting — practical for Indian summers.", category: "shirt", fit: "regular", styles: ["old-money", "smart-casual"], volume: 0.2, source: { kind: "editorial", label: "FITIQ editorial recommendation" }, query: "linen shirt" },
];
