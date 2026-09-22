import type { Category, Occasion, Product, Slot, StyleTag } from "../types";

export interface RecipeSlot {
  key: string;
  slot: Slot;
  label: string; // ingredient name: Base, Bottom, Shoes, Layer, Accessory
  categories: Category[];
  optional?: boolean;
  hint: string;
  accept?: (p: { category: Category; subcategory?: string; fit?: string; attrs: Product["attrs"] }) => boolean;
}

export interface Recipe {
  id: string;
  name: string;
  description: string;
  styles: StyleTag[];
  occasions: Occasion[];
  slots: RecipeSlot[];
}

const notEthnicBottom = (p: { subcategory?: string }) => !["churidar", "pyjama"].includes(p.subcategory ?? "");
const ethnicBottom = (p: { subcategory?: string }) => ["churidar", "pyjama"].includes(p.subcategory ?? "");

export const RECIPES: Recipe[] = [
  {
    id: "smart-casual",
    name: "Smart Casual",
    description: "Collared base, clean chinos, minimal shoes. The workhorse office-to-dinner formula.",
    styles: ["smart-casual", "minimal", "old-money"],
    occasions: ["office", "date", "first-day", "business-meeting", "college", "casual"],
    slots: [
      { key: "top", slot: "top", label: "Base", categories: ["shirt", "polo"], hint: "Oxford or linen shirt, or a piqué/knit polo", accept: (p) => !["cuban"].includes(p.subcategory ?? "") && p.attrs.pattern !== "print" },
      { key: "bottom", slot: "bottom", label: "Bottom", categories: ["chinos", "trousers", "jeans"], hint: "Straight chinos or clean dark denim", accept: (p) => notEthnicBottom(p) && p.fit !== "skinny" },
      { key: "footwear", slot: "footwear", label: "Shoes", categories: ["sneakers", "loafers"], hint: "Minimal white sneakers or suede loafers", accept: (p) => p.attrs.styles.includes("minimal") || p.attrs.styles.includes("smart-casual") },
      { key: "layer", slot: "layer", label: "Layer", categories: ["overshirt", "blazer", "sweater"], optional: true, hint: "Overshirt or unstructured blazer" },
      { key: "watch", slot: "accessory", label: "Accessory", categories: ["watch"], optional: true, hint: "Minimal analog watch", accept: (p) => !p.attrs.styles.includes("traditional") },
    ],
  },
  {
    id: "office-formal",
    name: "Office Formal",
    description: "Crisp shirt, tailored trousers, polished leather. Interview- and meeting-ready.",
    styles: ["formal", "minimal"],
    occasions: ["office", "interview", "business-meeting", "first-day"],
    slots: [
      { key: "top", slot: "top", label: "Base", categories: ["shirt"], hint: "Solid formal or oxford shirt", accept: (p) => ["formal", "oxford"].includes(p.subcategory ?? "") },
      { key: "bottom", slot: "bottom", label: "Bottom", categories: ["trousers", "chinos"], hint: "Tailored trousers", accept: (p) => notEthnicBottom(p) },
      { key: "footwear", slot: "footwear", label: "Shoes", categories: ["formal-shoes", "loafers"], hint: "Derby, oxford or leather loafers" },
      { key: "belt", slot: "accessory", label: "Belt", categories: ["belt"], hint: "Leather belt matched to shoes" },
      { key: "watch", slot: "accessory", label: "Accessory", categories: ["watch"], optional: true, hint: "Analog watch", accept: (p) => !p.attrs.styles.includes("streetwear") },
    ],
  },
  {
    id: "modern-indian",
    name: "Modern Indian",
    description: "Kurta with a clean bottom, optional Nehru jacket and mojaris. Wedding & festive.",
    styles: ["traditional", "indo-western"],
    occasions: ["wedding", "reception", "diwali", "eid", "festival", "haldi"],
    slots: [
      { key: "top", slot: "top", label: "Base", categories: ["kurta"], hint: "Silk-blend or cotton kurta" },
      { key: "bottom", slot: "bottom", label: "Bottom", categories: ["trousers"], hint: "Churidar, pyjama or slim trousers", accept: (p) => ethnicBottom(p) || p.attrs.styles.includes("formal") },
      { key: "footwear", slot: "footwear", label: "Shoes", categories: ["mojaris", "loafers"], hint: "Mojaris or loafers" },
      { key: "layer", slot: "layer", label: "Layer", categories: ["nehru-jacket"], optional: true, hint: "Nehru jacket" },
      { key: "watch", slot: "accessory", label: "Accessory", categories: ["watch"], optional: true, hint: "Gold-tone or minimal watch" },
    ],
  },
  {
    id: "relaxed-street",
    name: "Relaxed Streetwear",
    description: "Heavy tee, relaxed denim, clean sneakers, one statement layer.",
    styles: ["streetwear", "korean", "casual"],
    occasions: ["college", "casual", "party", "travel"],
    slots: [
      { key: "top", slot: "top", label: "Base", categories: ["tshirt", "shirt"], hint: "Heavyweight tee or relaxed shirt", accept: (p) => p.attrs.styles.includes("streetwear") || p.attrs.styles.includes("korean") || p.attrs.styles.includes("casual") },
      { key: "bottom", slot: "bottom", label: "Bottom", categories: ["jeans", "joggers", "chinos"], hint: "Relaxed or straight denim", accept: (p) => notEthnicBottom(p) },
      { key: "footwear", slot: "footwear", label: "Shoes", categories: ["sneakers"], hint: "Chunky or classic sneakers" },
      { key: "layer", slot: "layer", label: "Layer", categories: ["overshirt", "jacket"], optional: true, hint: "Overshirt or bomber" },
      { key: "watch", slot: "accessory", label: "Accessory", categories: ["watch", "bag"], optional: true, hint: "Digital watch or tote" },
    ],
  },
  {
    id: "minimal-casual",
    name: "Minimal Casual",
    description: "Quality tee, straight jeans, white sneakers. Nothing extra.",
    styles: ["minimal", "casual", "korean"],
    occasions: ["casual", "college", "travel", "date", "vacation"],
    slots: [
      { key: "top", slot: "top", label: "Base", categories: ["tshirt", "polo"], hint: "Solid crew-neck tee", accept: (p) => p.attrs.pattern === "solid" || p.attrs.pattern === "texture" },
      { key: "bottom", slot: "bottom", label: "Bottom", categories: ["jeans", "chinos", "shorts"], hint: "Straight jeans or chinos", accept: (p) => notEthnicBottom(p) },
      { key: "footwear", slot: "footwear", label: "Shoes", categories: ["sneakers", "loafers", "sandals"], hint: "White sneakers" },
      { key: "layer", slot: "layer", label: "Layer", categories: ["overshirt", "jacket"], optional: true, hint: "Light overshirt" },
      { key: "watch", slot: "accessory", label: "Accessory", categories: ["watch", "sunglasses"], optional: true, hint: "Minimal watch" },
    ],
  },
  {
    id: "old-money",
    name: "Old Money",
    description: "Knit polo or oxford, pleated trousers, loafers. Quiet and textured.",
    styles: ["old-money", "smart-casual"],
    occasions: ["date", "reception", "party", "office", "vacation"],
    slots: [
      { key: "top", slot: "top", label: "Base", categories: ["polo", "shirt"], hint: "Knit polo or oxford", accept: (p) => p.attrs.styles.includes("old-money") },
      { key: "bottom", slot: "bottom", label: "Bottom", categories: ["trousers", "chinos"], hint: "Pleated trousers or chinos", accept: (p) => notEthnicBottom(p) },
      { key: "footwear", slot: "footwear", label: "Shoes", categories: ["loafers", "boots"], hint: "Suede or leather loafers" },
      { key: "layer", slot: "layer", label: "Layer", categories: ["blazer", "sweater"], optional: true, hint: "Linen blazer or merino crew" },
      { key: "watch", slot: "accessory", label: "Accessory", categories: ["watch"], optional: true, hint: "Leather-strap watch", accept: (p) => p.attrs.styles.includes("old-money") || p.attrs.styles.includes("minimal") },
    ],
  },
  {
    id: "reception-sharp",
    name: "Reception Sharp",
    description: "Blazer over a clean shirt with tailored trousers.",
    styles: ["formal", "smart-casual", "old-money"],
    occasions: ["reception", "wedding", "party", "business-meeting"],
    slots: [
      { key: "layer", slot: "layer", label: "Layer", categories: ["blazer"], hint: "Structured or linen blazer" },
      { key: "top", slot: "top", label: "Base", categories: ["shirt"], hint: "Solid shirt", accept: (p) => p.attrs.pattern === "solid" },
      { key: "bottom", slot: "bottom", label: "Bottom", categories: ["trousers"], hint: "Tailored trousers", accept: (p) => notEthnicBottom(p) },
      { key: "footwear", slot: "footwear", label: "Shoes", categories: ["loafers", "formal-shoes"], hint: "Loafers or oxfords" },
      { key: "watch", slot: "accessory", label: "Accessory", categories: ["watch"], optional: true, hint: "Dress watch" },
    ],
  },
];

export function recipeById(id?: string) {
  return RECIPES.find((r) => r.id === id);
}

/** Picks the recipe that best fits occasion + style. */
export function chooseRecipe(occasion: Occasion, style?: StyleTag, userStyles: StyleTag[] = []): Recipe {
  let best = RECIPES[0];
  let bestScore = -1;
  for (const r of RECIPES) {
    let s = 0;
    if (r.occasions.includes(occasion)) s += 10;
    if (r.occasions[0] === occasion) s += 2;
    if (style && r.styles.includes(style)) s += 8;
    if (style && r.styles[0] === style) s += 3;
    s += userStyles.filter((u) => r.styles.includes(u)).length;
    if (s > bestScore) (best = r), (bestScore = s);
  }
  return best;
}
