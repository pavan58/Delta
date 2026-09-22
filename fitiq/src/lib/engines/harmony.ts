import type { ColorFamily, Pattern } from "../types";
import { NEUTRALS } from "../taxonomy";

const GOOD_PAIRS: [ColorFamily, ColorFamily][] = [
  ["light-blue", "beige"], ["light-blue", "navy"], ["pink", "navy"], ["pink", "grey"], ["olive", "cream"],
  ["olive", "white"], ["rust", "navy"], ["rust", "cream"], ["maroon", "cream"], ["maroon", "gold"], ["yellow", "white"],
  ["yellow", "navy"], ["lavender", "grey"], ["lavender", "white"], ["green", "cream"], ["blue", "beige"], ["gold", "cream"],
  ["gold", "navy"], ["indigo", "white"], ["indigo", "beige"], ["tan", "navy"], ["brown", "light-blue"],
];
const CLASH_PAIRS: [ColorFamily, ColorFamily][] = [
  ["red", "pink"], ["red", "green"], ["red", "maroon"], ["yellow", "pink"], ["green", "pink"], ["lavender", "yellow"],
  ["rust", "pink"], ["red", "rust"], ["green", "blue"], ["red", "lavender"],
];

const has = (list: [ColorFamily, ColorFamily][], a: ColorFamily, b: ColorFamily) => list.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

export function pairHarmony(a: ColorFamily, b: ColorFamily): number {
  if (a === b) return NEUTRALS.includes(a) ? 0.82 : 0.7; // tonal
  if (has(CLASH_PAIRS, a, b)) return 0.3;
  if (has(GOOD_PAIRS, a, b)) return 0.97;
  const na = NEUTRALS.includes(a), nb = NEUTRALS.includes(b);
  if (na && nb) return 0.94;
  if (na || nb) return 0.9;
  return 0.58;
}

export interface HarmonyInput {
  color: ColorFamily;
  pattern: Pattern;
  slot: string;
  category: string;
}

/** Colour harmony 0-100 for the clothing pieces of an outfit. */
export function outfitHarmony(items: HarmonyInput[]): { score: number; notes: string[] } {
  const clothes = items.filter((i) => i.slot !== "accessory");
  const notes: string[] = [];
  if (clothes.length < 2) return { score: 85, notes };
  let total = 0, n = 0;
  for (let i = 0; i < clothes.length; i++)
    for (let j = i + 1; j < clothes.length; j++) {
      // Top–bottom contrast matters most; footwear pairs weigh less.
      const w = clothes[i].slot === "footwear" || clothes[j].slot === "footwear" ? 0.6 : 1;
      total += pairHarmony(clothes[i].color, clothes[j].color) * w;
      n += w;
    }
  let score = (total / n) * 100;
  const bold = new Set(clothes.map((c) => c.color).filter((c) => !NEUTRALS.includes(c)));
  if (bold.size > 1) (score -= 8 * (bold.size - 1)), notes.push("More than one bold colour");
  const busy = clothes.filter((c) => ["print", "check", "stripe"].includes(c.pattern)).length;
  if (busy > 1) (score -= 10), notes.push("Two competing patterns");
  const shoe = items.find((i) => i.slot === "footwear");
  const belt = items.find((i) => i.category === "belt");
  if (shoe && belt) {
    const brownish = (c: ColorFamily) => ["brown", "tan"].includes(c);
    if ((brownish(shoe.color) && brownish(belt.color)) || shoe.color === belt.color) (score += 4), notes.push("Belt matches shoes");
    else if (!(shoe.color === "white")) score -= 4;
  }
  if (bold.size === 0 && busy === 0) notes.push("Neutral palette — easy to wear");
  return { score: Math.max(0, Math.min(100, Math.round(score))), notes };
}
