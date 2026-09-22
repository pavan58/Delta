import { z } from "zod";
import { ALL_BUILDS, ALL_CATEGORIES, ALL_COLORS, ALL_FITS, ALL_OCCASIONS, ALL_STYLES } from "../taxonomy";

const e = <T extends string>(vals: T[]) => z.enum(vals as [T, ...T[]]);

export const ProfileSchema = z.object({
  version: z.literal(1),
  name: z.string().max(60).optional(),
  city: z.string().max(60).optional(),
  body: z.object({
    heightCm: z.number().min(120).max(230),
    weightKg: z.number().min(30).max(250),
    waistIn: z.number().min(22).max(60),
    chestIn: z.number().min(28).max(64),
    shoulderIn: z.number().min(12).max(26).optional(),
    inseamIn: z.number().min(22).max(40).optional(),
    shoeUK: z.number().min(4).max(15).optional(),
    build: e(ALL_BUILDS),
    legProportion: z.enum(["shorter", "balanced", "longer"]).optional(),
  }),
  fit: z.object({ tops: e(ALL_FITS), bottoms: e(ALL_FITS) }),
  style: z.object({
    styles: z.array(e(ALL_STYLES)),
    colors: z.array(e(ALL_COLORS)),
    avoidColors: z.array(e(ALL_COLORS)),
    brands: z.array(z.string().max(40)).max(30),
    materials: z.array(z.string().max(40)).max(20),
    patterns: z.array(z.enum(["solid", "stripe", "check", "print", "texture", "embroidered"])),
    shoes: z.array(e(ALL_CATEGORIES)),
    accessories: z.array(e(ALL_CATEGORIES)),
  }),
  budget: z.object({ perOutfit: z.number().min(300).max(500000), monthly: z.number().optional(), daily: z.number().optional() }),
  photoConsent: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const FeedbackSchema = z.object({
  id: z.string(),
  productId: z.string(),
  brand: z.string(),
  retailer: z.string(),
  category: e(ALL_CATEGORIES),
  size: z.string(),
  outcome: z.enum(["too-tight", "perfect", "too-loose", "too-short", "too-long"]),
  buyAgain: z.boolean(),
  createdAt: z.string(),
});

export const WardrobeItemSchema = z.object({
  id: z.string(),
  category: e(ALL_CATEGORIES),
  colorFamily: e(ALL_COLORS),
  pattern: z.enum(["solid", "stripe", "check", "print", "texture", "embroidered"]),
  styles: z.array(e(ALL_STYLES)),
  fit: e(ALL_FITS).optional(),
  seasons: z.array(z.enum(["summer", "monsoon", "winter", "all"])),
  occasions: z.array(e(ALL_OCCASIONS)),
  label: z.string().max(80),
  image: z.string().optional(),
  addedAt: z.string(),
  detectedBy: z.enum(["user", "rules", "ai"]).optional(),
});

export const SizeMapSchema = z.object({
  brand: z.string(),
  retailer: z.string().optional(),
  category: e(ALL_CATEGORIES),
  size: z.string(),
  source: z.enum(["feedback", "manual"]),
  confidence: z.number(),
  updatedAt: z.string(),
});

/** Common envelope: the client sends its (local) personal context with requests in demo mode. */
export const ContextSchema = z.object({
  profile: ProfileSchema.nullable().optional(),
  feedback: z.array(FeedbackSchema).max(500).optional(),
  sizeMap: z.array(SizeMapSchema).max(200).optional(),
  wardrobe: z.array(WardrobeItemSchema.omit({ image: true }).extend({ image: z.string().optional() })).max(400).optional(),
});

export const WeatherSchema = z.object({
  condition: z.enum(["hot", "humid", "rain", "mild", "cool", "cold"]),
  tempC: z.number().optional(),
  source: z.enum(["provider", "user"]),
  providerName: z.string().optional(),
  observedAt: z.string().optional(),
  city: z.string().optional(),
});
