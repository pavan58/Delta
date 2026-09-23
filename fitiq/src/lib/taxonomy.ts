import type { BodyBuild, Category, ColorFamily, FitType, Occasion, Pattern, Slot, StyleTag } from "./types";

export const CATEGORY_LABEL: Record<Category, string> = {
  shirt: "Shirt",
  tshirt: "T-shirt",
  polo: "Polo",
  overshirt: "Overshirt",
  jacket: "Jacket",
  blazer: "Blazer",
  sweater: "Sweater",
  kurta: "Kurta",
  "nehru-jacket": "Nehru jacket",
  jeans: "Jeans",
  chinos: "Chinos",
  trousers: "Trousers",
  joggers: "Joggers",
  shorts: "Shorts",
  sneakers: "Sneakers",
  loafers: "Loafers",
  "formal-shoes": "Formal shoes",
  mojaris: "Mojaris",
  boots: "Boots",
  sandals: "Sandals",
  watch: "Watch",
  belt: "Belt",
  sunglasses: "Sunglasses",
  bag: "Bag",
};

export const CATEGORY_SLOT: Record<Category, Slot> = {
  shirt: "top",
  tshirt: "top",
  polo: "top",
  kurta: "top",
  sweater: "layer",
  overshirt: "layer",
  jacket: "layer",
  blazer: "layer",
  "nehru-jacket": "layer",
  jeans: "bottom",
  chinos: "bottom",
  trousers: "bottom",
  joggers: "bottom",
  shorts: "bottom",
  sneakers: "footwear",
  loafers: "footwear",
  "formal-shoes": "footwear",
  mojaris: "footwear",
  boots: "footwear",
  sandals: "footwear",
  watch: "accessory",
  belt: "accessory",
  sunglasses: "accessory",
  bag: "accessory",
};

export const SLOT_LABEL: Record<Slot, string> = {
  top: "Top",
  layer: "Layer",
  bottom: "Bottom",
  footwear: "Shoes",
  accessory: "Accessory",
};

export const TOP_CATEGORIES: Category[] = ["shirt", "tshirt", "polo", "kurta", "overshirt", "jacket", "blazer", "sweater", "nehru-jacket"];
export const BOTTOM_CATEGORIES: Category[] = ["jeans", "chinos", "trousers", "joggers", "shorts"];
export const FOOTWEAR_CATEGORIES: Category[] = ["sneakers", "loafers", "formal-shoes", "mojaris", "boots", "sandals"];
/** Categories where body measurements are irrelevant to fit. */
export const NON_SIZED: Category[] = ["watch", "sunglasses", "bag"];

export const STYLE_LABEL: Record<StyleTag, string> = {
  minimal: "Minimal",
  "smart-casual": "Smart Casual",
  streetwear: "Streetwear",
  formal: "Formal",
  "old-money": "Old Money",
  korean: "Korean-inspired",
  casual: "Casual",
  traditional: "Traditional",
  "indo-western": "Indo-western",
  athleisure: "Athleisure",
};

export const OCCASION_LABEL: Record<Occasion, string> = {
  office: "Office",
  interview: "Interview",
  college: "College",
  date: "Date",
  wedding: "Wedding",
  reception: "Reception",
  haldi: "Haldi",
  diwali: "Diwali",
  eid: "Eid",
  festival: "Festival",
  party: "Party",
  travel: "Travel",
  vacation: "Vacation",
  casual: "Casual",
  "business-meeting": "Business meeting",
  "first-day": "First day at work",
};

export const FIT_LABEL: Record<FitType, string> = {
  skinny: "Skinny",
  slim: "Slim",
  regular: "Regular",
  straight: "Straight",
  tapered: "Tapered",
  relaxed: "Relaxed",
  oversized: "Oversized",
};

export const BUILD_LABEL: Record<BodyBuild, string> = {
  slim: "Slim / lean",
  average: "Average",
  athletic: "Athletic",
  muscular: "Muscular",
  fuller: "Fuller build",
  "big-tall": "Big & tall",
};

export const BUILD_BLURB: Record<BodyBuild, string> = {
  slim: "Narrower frame, lighter weight for height",
  average: "Balanced proportions, no strong emphasis",
  athletic: "Defined shoulders, trimmer waist",
  muscular: "Broad chest and arms, larger thighs",
  fuller: "More volume through the midsection",
  "big-tall": "Taller and broader overall",
};

export const PATTERN_LABEL: Record<Pattern, string> = {
  solid: "Solid",
  stripe: "Stripe",
  check: "Check",
  print: "Print",
  texture: "Texture",
  embroidered: "Embroidered",
};

export const COLOR_HEX: Record<ColorFamily, string> = {
  white: "#F4F2EC",
  black: "#1B1B1B",
  navy: "#1F2A44",
  grey: "#8A8C8E",
  beige: "#D8C7A6",
  brown: "#6B4A32",
  olive: "#6B6B3A",
  blue: "#2F5DA8",
  "light-blue": "#A9C4E4",
  green: "#2F6B4A",
  maroon: "#6B1F2A",
  red: "#B3261E",
  yellow: "#E0B53A",
  pink: "#E8B4B8",
  cream: "#EFE6D2",
  tan: "#B88A5A",
  rust: "#A5502A",
  lavender: "#B9A9D6",
  gold: "#C9A24A",
  silver: "#BFC3C7",
  indigo: "#2E3A6E",
};

export const COLOR_LABEL: Record<ColorFamily, string> = Object.fromEntries(
  Object.keys(COLOR_HEX).map((c) => [c, c.replace("-", " ").replace(/^\w/, (m) => m.toUpperCase())]),
) as Record<ColorFamily, string>;

export const NEUTRALS: ColorFamily[] = ["white", "black", "navy", "grey", "beige", "cream", "tan", "brown", "olive", "indigo", "silver"];

export const ALL_STYLES = Object.keys(STYLE_LABEL) as StyleTag[];
export const ALL_OCCASIONS = Object.keys(OCCASION_LABEL) as Occasion[];
export const ALL_COLORS = Object.keys(COLOR_HEX) as ColorFamily[];
export const ALL_FITS = Object.keys(FIT_LABEL) as FitType[];
export const ALL_BUILDS = Object.keys(BUILD_LABEL) as BodyBuild[];
export const ALL_CATEGORIES = Object.keys(CATEGORY_LABEL) as Category[];

export const RETAILERS: { id: string; name: string; integration: string }[] = [
  { id: "myntra", name: "Myntra", integration: "Affiliate feed (planned)" },
  { id: "ajio", name: "AJIO", integration: "Affiliate feed (planned)" },
  { id: "amazon", name: "Amazon India", integration: "Product Advertising API (planned)" },
  { id: "flipkart", name: "Flipkart", integration: "Affiliate API (planned)" },
  { id: "tatacliq", name: "Tata CLiQ", integration: "Affiliate network (planned)" },
  { id: "nykaafashion", name: "Nykaa Fashion", integration: "Affiliate network (planned)" },
  { id: "hm", name: "H&M India", integration: "Merchant feed (planned)" },
  { id: "uniqlo", name: "Uniqlo India", integration: "Merchant feed (planned)" },
  { id: "westside", name: "Westside", integration: "Merchant feed (planned)" },
  { id: "snitch", name: "Snitch", integration: "D2C merchant feed (planned)" },
  { id: "bewakoof", name: "Bewakoof", integration: "D2C merchant feed (planned)" },
  { id: "levis", name: "Levi's India", integration: "Brand feed (planned)" },
];

export const RETAILER_NAME: Record<string, string> = Object.fromEntries(RETAILERS.map((r) => [r.id, r.name]));

export function formatINR(n: number): string {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

export function cmToFeetIn(cm: number): string {
  const totalIn = Math.round(cm / 2.54);
  return `${Math.floor(totalIn / 12)}'${totalIn % 12}"`;
}

export function feetInToCm(ft: number, inch: number): number {
  return Math.round((ft * 12 + inch) * 2.54);
}
