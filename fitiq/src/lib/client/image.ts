"use client";
import { COLOR_HEX } from "../taxonomy";
import type { ColorFamily } from "../types";

/** Downscale an image file in the browser. Only the small JPEG ever leaves the device. */
export async function downscale(file: File, max = 320): Promise<{ dataUrl: string; base64: string; dominant: ColorFamily }> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Please choose a JPEG, PNG or WebP image.");
  if (file.size > 15 * 1024 * 1024) throw new Error("That image is over 15 MB.");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Couldn't read that image."));
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dominant = dominantColor(ctx, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.78);
    return { dataUrl, base64: dataUrl.split(",")[1], dominant };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Dominant colour of the central region, mapped to the nearest FITIQ colour family. */
function dominantColor(ctx: CanvasRenderingContext2D, w: number, h: number): ColorFamily {
  const x0 = Math.floor(w * 0.25), y0 = Math.floor(h * 0.25);
  const data = ctx.getImageData(x0, y0, Math.max(1, Math.floor(w * 0.5)), Math.max(1, Math.floor(h * 0.5))).data;
  const buckets = new Map<string, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += 16) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
    const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n++; e.r += r; e.g += g; e.b += b;
    buckets.set(key, e);
  }
  const top = [...buckets.values()].sort((a, b) => b.n - a.n)[0];
  if (!top) return "grey";
  return nearestColor(top.r / top.n, top.g / top.n, top.b / top.n);
}

export function nearestColor(r: number, g: number, b: number): ColorFamily {
  let best: ColorFamily = "grey";
  let bestD = Infinity;
  for (const [name, hex] of Object.entries(COLOR_HEX) as [ColorFamily, string][]) {
    if (name === "gold" || name === "silver") continue;
    const n = parseInt(hex.slice(1), 16);
    const dr = r - ((n >> 16) & 255), dg = g - ((n >> 8) & 255), db = b - (n & 255);
    const d = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
    if (d < bestD) (bestD = d), (best = name);
  }
  return best;
}
