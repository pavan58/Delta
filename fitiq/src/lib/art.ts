// Generated garment illustrations for DEMO products. FITIQ never hotlinks or
// copies retailer photography without rights; live feeds supply their own
// licensed imageUrl.
import type { Category, Pattern } from "./types";

const SHAPES: Record<string, string> = {
  shirt: "M70 40 L100 30 L112 44 L124 30 L154 40 L186 78 L166 96 L152 84 L152 196 L72 196 L72 84 L58 96 L38 78 Z",
  shirtDetail: "M100 30 L112 58 L124 30 M112 58 L112 196 M104 75 h2 M104 100 h2 M104 125 h2 M104 150 h2",
  tshirt: "M72 42 L98 32 Q112 46 126 32 L152 42 L184 74 L162 94 L150 84 L150 196 L74 196 L74 84 L62 94 L40 74 Z",
  polo: "M72 42 L100 32 L112 50 L124 32 L152 42 L184 74 L162 94 L150 84 L150 196 L74 196 L74 84 L62 94 L40 74 Z",
  poloDetail: "M100 32 L112 50 L124 32 M112 50 L112 80 M109 60 h1 M109 72 h1",
  jacket: "M66 42 L98 30 L112 50 L126 30 L158 42 L188 120 L184 190 L164 190 L160 110 L160 198 L64 198 L64 110 L60 190 L40 190 L36 120 Z",
  jacketDetail: "M98 30 L104 110 L112 198 M126 30 L120 110 L112 198 M98 30 L90 70 L104 80 M126 30 L134 70 L120 80",
  kurta: "M76 36 L100 28 Q112 40 124 28 L148 36 L180 70 L162 88 L152 80 L160 214 L64 214 L72 80 L62 88 L44 70 Z",
  kurtaDetail: "M112 36 L112 96 M108 48 h1 M108 60 h1 M108 72 h1 M108 84 h1",
  vest: "M78 36 L100 30 L112 52 L124 30 L146 36 L154 70 L152 198 L72 198 L70 70 Z",
  vestDetail: "M100 30 L112 52 L124 30 M112 52 L112 198 M108 80 h1 M108 110 h1 M108 140 h1 M108 170 h1",
  sweater: "M72 42 L98 32 Q112 44 126 32 L152 42 L186 120 L180 196 L162 196 L154 104 L152 190 L72 190 L70 104 L62 196 L44 196 L38 120 Z",
  pants: "M76 30 L148 30 L156 208 L124 208 L112 76 L100 208 L68 208 Z",
  pantsDetail: "M76 42 L148 42 M112 42 L112 76 M88 42 Q90 56 80 60 M136 42 Q134 56 144 60",
  shorts: "M72 60 L152 60 L160 150 L122 150 L112 100 L102 150 L64 150 Z",
  sneaker: "M36 150 L40 116 Q60 110 80 100 L112 96 Q128 116 150 122 Q182 128 188 146 L188 162 L36 162 Z",
  sneakerDetail: "M36 150 L188 150 M84 102 L96 124 M96 100 L108 122",
  loafer: "M34 150 Q40 120 80 116 L128 112 Q176 116 190 142 L190 156 L34 156 Z",
  loaferDetail: "M34 146 L190 146 M92 118 Q112 130 132 116",
  boot: "M60 60 L110 60 L112 118 Q160 122 186 142 L186 162 L56 162 Z",
  sandal: "M40 156 Q40 124 90 120 L150 120 Q188 124 188 150 L188 162 L40 162 Z",
  watch: "M96 40 L128 40 L132 88 L92 88 Z M92 152 L132 152 L128 200 L96 200 Z",
  belt: "M20 104 L204 104 L204 136 L20 136 Z",
  sunglasses: "M40 100 L100 100 Q104 140 70 142 Q40 140 40 100 Z M124 100 L184 100 Q184 140 154 142 Q120 140 124 100 Z M100 106 Q112 98 124 106",
  bag: "M60 88 L164 88 L172 200 L52 200 Z",
  bagDetail: "M84 88 Q84 44 112 44 Q140 44 140 88",
};

function shapeFor(c: Category): { body: string; detail?: string; extra?: string } {
  switch (c) {
    case "shirt": return { body: SHAPES.shirt, detail: SHAPES.shirtDetail };
    case "overshirt": return { body: SHAPES.shirt, detail: SHAPES.shirtDetail + " M80 90 h20 v18 h-20 z M124 90 h20 v18 h-20 z" };
    case "tshirt": return { body: SHAPES.tshirt };
    case "polo": return { body: SHAPES.polo, detail: SHAPES.poloDetail };
    case "jacket":
    case "blazer": return { body: SHAPES.jacket, detail: SHAPES.jacketDetail };
    case "sweater": return { body: SHAPES.sweater, detail: "M70 184 L154 184 M98 32 Q112 50 126 32" };
    case "kurta": return { body: SHAPES.kurta, detail: SHAPES.kurtaDetail };
    case "nehru-jacket": return { body: SHAPES.vest, detail: SHAPES.vestDetail };
    case "jeans":
    case "chinos":
    case "trousers":
    case "joggers": return { body: SHAPES.pants, detail: SHAPES.pantsDetail };
    case "shorts": return { body: SHAPES.shorts, detail: "M72 72 L152 72 M112 72 L112 100" };
    case "sneakers": return { body: SHAPES.sneaker, detail: SHAPES.sneakerDetail };
    case "loafers":
    case "formal-shoes":
    case "mojaris": return { body: SHAPES.loafer, detail: SHAPES.loaferDetail };
    case "boots": return { body: SHAPES.boot, detail: "M56 150 L186 150" };
    case "sandals": return { body: SHAPES.sandal, detail: "M80 122 Q110 100 140 122" };
    case "watch": return { body: SHAPES.watch, extra: `<circle cx="112" cy="120" r="34" fill="#F4F1EA" stroke="#15130F" stroke-width="3"/><path d="M112 120 L112 98 M112 120 L128 128" stroke="#15130F" stroke-width="3" stroke-linecap="round"/>` };
    case "belt": return { body: SHAPES.belt, extra: `<rect x="136" y="96" width="36" height="48" rx="4" fill="none" stroke="#B8A58A" stroke-width="5"/>` };
    case "sunglasses": return { body: SHAPES.sunglasses };
    case "bag": return { body: SHAPES.bag, detail: SHAPES.bagDetail };
  }
}

function patternDef(p: Pattern, hex: string, id: string) {
  const ink = lightness(hex) > 0.6 ? "rgba(21,19,15,0.18)" : "rgba(255,255,255,0.22)";
  switch (p) {
    case "stripe": return `<pattern id="${id}" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="${hex}"/><rect width="3" height="10" fill="${ink}"/></pattern>`;
    case "check": return `<pattern id="${id}" width="18" height="18" patternUnits="userSpaceOnUse"><rect width="18" height="18" fill="${hex}"/><rect width="18" height="5" fill="${ink}"/><rect width="5" height="18" fill="${ink}"/></pattern>`;
    case "print": return `<pattern id="${id}" width="22" height="22" patternUnits="userSpaceOnUse"><rect width="22" height="22" fill="${hex}"/><circle cx="6" cy="6" r="3" fill="${ink}"/><path d="M14 16 q4 -6 6 0" stroke="${ink}" fill="none" stroke-width="2"/></pattern>`;
    case "texture": return `<pattern id="${id}" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="${hex}"/><path d="M0 6 L6 0" stroke="${ink}" stroke-width="1"/></pattern>`;
    case "embroidered": return `<pattern id="${id}" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="${hex}"/><path d="M8 3 L11 8 L8 13 L5 8 Z" fill="${ink}"/></pattern>`;
    default: return "";
  }
}

function lightness(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function garmentSvg(category: Category, hex: string, pattern: Pattern = "solid", bg = "#EFE9DF"): string {
  const s = shapeFor(category);
  const id = `p${Math.abs(hashCode(category + hex + pattern))}`;
  const fill = pattern === "solid" ? hex : `url(#${id})`;
  const stroke = lightness(hex) > 0.75 ? "#8C8375" : "rgba(21,19,15,0.55)";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 224 240" role="img" aria-label="${category} illustration"><defs>${patternDef(pattern, hex, id)}</defs><rect width="224" height="240" fill="${bg}"/><ellipse cx="112" cy="222" rx="72" ry="6" fill="rgba(21,19,15,0.08)"/><path d="${s.body}" fill="${fill}" stroke="${stroke}" stroke-width="2" stroke-linejoin="round"/>${s.detail ? `<path d="${s.detail}" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>` : ""}${s.extra ?? ""}</svg>`;
}

function hashCode(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}
