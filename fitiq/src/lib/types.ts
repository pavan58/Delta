// ---------------------------------------------------------------------------
// FITIQ domain types
// ---------------------------------------------------------------------------

/** Normalized product shape every provider adapter must produce. */
export interface Product {
  id: string;
  retailer: string;
  brand: string;
  title: string;
  category: Category;
  subcategory?: string;

  price: number;
  mrp?: number;
  discountPercent?: number;

  currency: "INR";

  sizes: string[];
  colors: string[];

  fit?: FitType;
  material?: string;

  rating?: number;
  reviewCount?: number;

  imageUrl: string;
  productUrl: string;

  availability: boolean;

  lastCheckedAt: string;

  /** FITIQ enrichment (derived from feed attributes, never invented for live data). */
  attrs: ProductAttributes;
  /** Where this record came from. Demo records are always labelled in the UI. */
  source: ProductSource;
}

export interface ProductSource {
  providerId: string;
  kind: "demo" | "affiliate-feed" | "merchant-feed" | "official-api";
  /** True only when the provider contractually supplies real-time pricing. */
  realtime: boolean;
  sponsored?: boolean;
}

export interface ProductAttributes {
  /** Model identifier shared by the same product across retailers (exact-match key). */
  modelCode?: string;
  sku?: string;
  colorFamily: ColorFamily;
  pattern: Pattern;
  styles: StyleTag[];
  occasions: Occasion[];
  fabricWeight: "light" | "medium" | "heavy";
  structured: boolean;
  stretch: boolean;
  rainFriendly?: boolean;
  seasons: Season[];
  /** Brand sizing tendency from size chart / aggregate feedback. */
  brandSizing?: "runs-small" | "true" | "runs-large";
  /** Garment measurements per size (inches). Only present when provided by the feed. */
  sizeChart?: Record<string, GarmentMeasure>;
  /** 0-100 relative popularity from provider engagement data. */
  popularity?: number;
  lengthProfile?: "cropped" | "regular" | "long";
}

export interface GarmentMeasure {
  chest?: number; // garment chest circumference
  waist?: number; // garment waist
  length?: number;
  sleeve?: number;
  inseam?: number;
  shoulder?: number;
}

export type Category =
  | "shirt"
  | "tshirt"
  | "polo"
  | "overshirt"
  | "jacket"
  | "blazer"
  | "sweater"
  | "kurta"
  | "nehru-jacket"
  | "jeans"
  | "chinos"
  | "trousers"
  | "joggers"
  | "shorts"
  | "sneakers"
  | "loafers"
  | "formal-shoes"
  | "mojaris"
  | "boots"
  | "sandals"
  | "watch"
  | "belt"
  | "sunglasses"
  | "bag";

export type Slot = "top" | "layer" | "bottom" | "footwear" | "accessory";

export type FitType =
  | "skinny"
  | "slim"
  | "regular"
  | "straight"
  | "tapered"
  | "relaxed"
  | "oversized";

export type ColorFamily =
  | "white"
  | "black"
  | "navy"
  | "grey"
  | "beige"
  | "brown"
  | "olive"
  | "blue"
  | "light-blue"
  | "green"
  | "maroon"
  | "red"
  | "yellow"
  | "pink"
  | "cream"
  | "tan"
  | "rust"
  | "lavender"
  | "gold"
  | "silver"
  | "indigo";

export type Pattern = "solid" | "stripe" | "check" | "print" | "texture" | "embroidered";

export type StyleTag =
  | "minimal"
  | "smart-casual"
  | "streetwear"
  | "formal"
  | "old-money"
  | "korean"
  | "casual"
  | "traditional"
  | "indo-western"
  | "athleisure";

export type Occasion =
  | "office"
  | "interview"
  | "college"
  | "date"
  | "wedding"
  | "reception"
  | "haldi"
  | "diwali"
  | "eid"
  | "festival"
  | "party"
  | "travel"
  | "vacation"
  | "casual"
  | "business-meeting"
  | "first-day";

export type Season = "summer" | "monsoon" | "winter" | "all";

export type BodyBuild = "slim" | "average" | "athletic" | "muscular" | "fuller" | "big-tall";

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

export interface BodyProfile {
  heightCm: number;
  weightKg: number;
  waistIn: number;
  chestIn: number;
  shoulderIn?: number;
  inseamIn?: number;
  shoeUK?: number;
  build: BodyBuild;
  legProportion?: "shorter" | "balanced" | "longer";
}

export interface FitPreferences {
  tops: FitType;
  bottoms: FitType;
}

export interface StylePreferences {
  styles: StyleTag[];
  colors: ColorFamily[];
  avoidColors: ColorFamily[];
  brands: string[];
  materials: string[];
  patterns: Pattern[];
  shoes: Category[];
  accessories: Category[];
}

export interface BudgetPreferences {
  perOutfit: number;
  monthly?: number;
  daily?: number;
}

export interface UserProfile {
  version: 1;
  name?: string;
  city?: string;
  body: BodyProfile;
  fit: FitPreferences;
  style: StylePreferences;
  budget: BudgetPreferences;
  photoConsent: boolean;
  createdAt: string;
  updatedAt: string;
}

export type FitOutcome = "too-tight" | "perfect" | "too-loose" | "too-short" | "too-long";

export interface FitFeedback {
  id: string;
  productId: string;
  brand: string;
  retailer: string;
  category: Category;
  size: string;
  outcome: FitOutcome;
  buyAgain: boolean;
  createdAt: string;
}

/** Personal size graph entry — learned from feedback or entered by the user. */
export interface SizeMapEntry {
  brand: string;
  retailer?: string;
  category: Category;
  size: string;
  source: "feedback" | "manual";
  confidence: number; // 0-1
  updatedAt: string;
}

export interface WardrobeItem {
  id: string;
  category: Category;
  colorFamily: ColorFamily;
  pattern: Pattern;
  styles: StyleTag[];
  fit?: FitType;
  seasons: Season[];
  occasions: Occasion[];
  label: string;
  /** Small, locally stored thumbnail (demo mode) or object storage key (prod). */
  image?: string;
  addedAt: string;
  detectedBy?: "user" | "rules" | "ai";
}

// ---------------------------------------------------------------------------
// Engine outputs
// ---------------------------------------------------------------------------

export type FitRisk = "LOW" | "MEDIUM" | "HIGH";

export interface FitAnalysis {
  overall: number;
  body: number;
  silhouette: number;
  sizeConfidence: number;
  style: number;
  risk: FitRisk;
  riskReasons: string[];
  recommendedSize?: string;
  sizeAvailable: boolean;
  sizeNote?: string;
  why: string;
  applicable: boolean; // false for items where body fit doesn't apply (watch etc.)
}

export interface PurchaseConfidence {
  percent: number;
  evidence: string[];
  issues: string[];
}

export interface PriceStats {
  current: number;
  previous?: number;
  lowest?: number;
  highest?: number;
  change?: number;
  thirtyDaysAgo?: number;
  points: number;
  firstSeen?: string;
  hasHistory: boolean;
}

export interface DealScore {
  score: number;
  components: { label: string; value: number; weight: number; note: string }[];
}

export interface OutfitItem {
  /** Recipe slot key, e.g. "top", "layer", "watch". */
  key: string;
  /** Recipe ingredient label, e.g. "Base", "Layer". */
  label: string;
  slot: Slot;
  product?: Product;
  wardrobeItem?: WardrobeItem;
  price: number;
  fit?: FitAnalysis;
  why: string;
}

export interface Outfit {
  id: string;
  name: string;
  strategy?: "saver" | "balanced" | "premium" | "wardrobe" | "experiment";
  occasion: Occasion;
  items: OutfitItem[];
  total: number;
  scores: { fit: number; style: number; budget: number; harmony: number; overall: number };
  explanation: string;
  recipeId: string;
  budget: number;
  notes: string[];
}

export interface OutfitRequest {
  budget: number;
  occasion: Occasion;
  style?: StyleTag;
  allowOverBudget?: boolean;
  useWardrobe?: boolean;
  weather?: WeatherContext;
  recipeId?: string;
  context?: string;
}

export interface WeatherContext {
  condition: "hot" | "humid" | "rain" | "mild" | "cool" | "cold";
  tempC?: number;
  source: "provider" | "user";
  providerName?: string;
  observedAt?: string;
  city?: string;
}

export interface ParsedQuery {
  budget?: number;
  build?: BodyBuild;
  style?: StyleTag;
  occasion?: Occasion;
  category?: Category;
  colors: ColorFamily[];
  heightCm?: number;
  relationship?: string;
  gender: "male";
  keywords: string[];
  weather?: WeatherContext["condition"];
  understood: { label: string; value: string }[];
}
