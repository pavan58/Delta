// Rule-based natural-language query understanding. The AI layer can replace
// or augment this (src/lib/ai), but this parser always works offline.
import type { BodyBuild, Category, ColorFamily, Occasion, ParsedQuery, StyleTag } from "../types";
import { ALL_COLORS, BUILD_LABEL, CATEGORY_LABEL, COLOR_LABEL, OCCASION_LABEL, STYLE_LABEL, formatINR } from "../taxonomy";

const BUILD_WORDS: [RegExp, BodyBuild][] = [
  [/\b(skinny|slim|thin|lean|lanky)\b(?!\s*fit)/, "slim"],
  [/\b(athletic|fit guy|sporty)\b/, "athletic"],
  [/\b(muscular|bulky|gym|broad)\b/, "muscular"],
  [/\b(big\s*(and|&)\s*tall|tall and broad)\b/, "big-tall"],
  [/\b(fat|chubby|heavy|heavier|plus|overweight|fuller|big guy|belly)\b/, "fuller"],
  [/\b(average|normal build|medium build)\b/, "average"],
];
const STYLE_WORDS: [RegExp, StyleTag][] = [
  [/smart[\s-]?casual/, "smart-casual"],
  [/old[\s-]?money/, "old-money"],
  [/street\s*wear|streetwear|street/, "streetwear"],
  [/korean|k-?style/, "korean"],
  [/indo[\s-]?western|modern indian/, "indo-western"],
  [/traditional|ethnic|desi/, "traditional"],
  [/minimal|minimalist|clean/, "minimal"],
  [/athleisure|gym wear|sporty/, "athleisure"],
  [/\bformal\b/, "formal"],
  [/\bcasual\b/, "casual"],
];
const OCCASION_WORDS: [RegExp, Occasion][] = [
  [/first day/, "first-day"],
  [/interview/, "interview"],
  [/business meeting|client meeting|meeting/, "business-meeting"],
  [/office|work|workplace|corporate/, "office"],
  [/college|campus|class/, "college"],
  [/\bdate\b|dinner date/, "date"],
  [/reception/, "reception"],
  [/haldi/, "haldi"],
  [/mehendi|sangeet|wedding|shaadi|marriage/, "wedding"],
  [/diwali/, "diwali"],
  [/\beid\b/, "eid"],
  [/festival|festive|puja|pooja|navratri|holi/, "festival"],
  [/party|club/, "party"],
  [/vacation|holiday|goa|beach/, "vacation"],
  [/travel|trip|flight/, "travel"],
];
const CATEGORY_WORDS: [RegExp, Category][] = [
  [/overshirt|shacket/, "overshirt"], [/t-?shirt|tee\b|tees\b/, "tshirt"], [/polo/, "polo"], [/kurta/, "kurta"],
  [/nehru|bandhgala/, "nehru-jacket"], [/blazer/, "blazer"], [/jacket/, "jacket"], [/sweater|pullover/, "sweater"],
  [/jeans|denim\b/, "jeans"], [/chino/, "chinos"], [/trouser|pants/, "trousers"], [/jogger/, "joggers"], [/shorts/, "shorts"],
  [/sneaker|trainers/, "sneakers"], [/loafer/, "loafers"], [/mojari|jutti/, "mojaris"], [/formal shoes|derby|oxfords?\s+shoes|brogue/, "formal-shoes"],
  [/boots?/, "boots"], [/watch/, "watch"], [/belt/, "belt"], [/sunglass|shades/, "sunglasses"], [/shirt/, "shirt"],
];

export function parseBudget(t: string): number | undefined {
  const m = t.match(/(?:under|below|within|less than|max|upto|up to|budget(?: of)?|₹|rs\.?|inr)\s*₹?\s*(\d[\d,]*(?:\.\d+)?)\s*(k|thousand)?/i)
    ?? t.match(/(\d[\d,]*(?:\.\d+)?)\s*(k|thousand)?\s*(?:rs|rupees|inr|budget)/i)
    ?? t.match(/\b(\d{1,2}(?:\.\d)?)\s*(k)\b/i);
  if (!m) return undefined;
  let n = parseFloat(m[1].replace(/,/g, ""));
  if (m[2]) n *= 1000;
  return n >= 100 && n <= 500000 ? Math.round(n) : undefined;
}

export function parseQuery(text: string): ParsedQuery {
  const t = text.toLowerCase();
  const understood: ParsedQuery["understood"] = [{ label: "Gender", value: "Male" }];
  const q: ParsedQuery = { gender: "male", colors: [], keywords: [], understood };

  q.budget = parseBudget(t);
  const h = t.match(/(\d)\s*(?:'|ft|feet|foot)\s*(\d{1,2})?/);
  if (h) q.heightCm = Math.round((Number(h[1]) * 12 + Number(h[2] ?? 0)) * 2.54);
  for (const [re, b] of BUILD_WORDS) if (re.test(t)) { q.build = b; break; }
  for (const [re, s] of STYLE_WORDS) if (re.test(t)) { q.style = s; break; }
  for (const [re, o] of OCCASION_WORDS) if (re.test(t)) { q.occasion = o; break; }
  for (const [re, c] of CATEGORY_WORDS) if (re.test(t)) { q.category = c; break; }
  const rel = t.match(/\b(?:my\s+)?(brother|sister|friend|cousin|best friend|colleague|boss)(?:'s)?\s+(wedding|reception|party|haldi|engagement)/);
  const rel2 = t.match(/(wedding|reception|party|haldi|engagement)\b.*?\bfor\s+my\s+(brother|sister|friend|cousin|best friend|colleague|boss)/);
  if (rel) q.relationship = `${rel[1].replace(/^\w/, (c) => c.toUpperCase())}'s ${rel[2]}`;
  else if (rel2) q.relationship = `${rel2[2].replace(/^\w/, (c) => c.toUpperCase())}'s ${rel2[1]}`;
  const colorAliases: [RegExp, ColorFamily][] = [[/khaki|sand|camel/, "beige"], [/charcoal/, "grey"], [/off.?white|ivory/, "cream"], [/wine|burgundy/, "maroon"], [/denim blue/, "indigo"]];
  for (const c of ALL_COLORS) if (new RegExp(`\\b${c.replace("-", "[ -]")}\\b`).test(t)) q.colors.push(c);
  for (const [re, c] of colorAliases) if (re.test(t) && !q.colors.includes(c)) q.colors.push(c);
  if (/rain|monsoon/.test(t)) q.weather = "rain";
  else if (/hot|summer|humid/.test(t)) q.weather = "hot";
  else if (/winter|cold/.test(t)) q.weather = "cold";

  if (q.build) understood.push({ label: "Body", value: BUILD_LABEL[q.build] });
  if (q.heightCm) understood.push({ label: "Height", value: `${h![1]}'${h![2] ?? 0}"` });
  if (q.style) understood.push({ label: "Style", value: STYLE_LABEL[q.style] });
  if (q.occasion) understood.push({ label: "Occasion", value: OCCASION_LABEL[q.occasion] });
  if (q.relationship) understood.push({ label: "Context", value: q.relationship });
  if (q.category) understood.push({ label: "Item", value: CATEGORY_LABEL[q.category] });
  if (q.colors.length) understood.push({ label: "Colour", value: q.colors.map((c) => COLOR_LABEL[c]).join(", ") });
  if (q.budget) understood.push({ label: "Budget", value: formatINR(q.budget) });
  if (q.weather) understood.push({ label: "Weather", value: q.weather });

  q.keywords = t
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !["for", "under", "the", "and", "with", "give", "outfit", "guy", "man", "men", "mens", "need", "want", "below", "some", "that", "looking"].includes(w));
  return q;
}

/** Heuristic: is the query asking for a complete outfit rather than a product? */
export function wantsOutfit(text: string) {
  return /outfit|look|wear|dress|what should i|complete|combo/i.test(text);
}
