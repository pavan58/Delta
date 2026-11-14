/**
 * Builds a clean transcript from Web Speech API results.
 *
 * Browsers differ:
 *  - Desktop Chrome sends each phrase once as a separate final result.
 *  - Android Chrome often sends CUMULATIVE results ("I go", "I go to", "I go to office")
 *    and may deliver the same final result twice, or repeat the last phrase after a restart.
 * Appending naively makes the sentence appear several times, so we merge with overlap detection.
 */

export interface RawResult {
  final: boolean;
  text: string;
  confidence: number;
}

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);
const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9'ऀ-ॿ]/g, "");

/** Appends `next` to `base`, skipping any part of `next` that already ends `base`. */
export function joinWithOverlap(base: string, next: string): string {
  const a = words(base);
  const b = words(next);
  if (!b.length) return a.join(" ");
  if (!a.length) return b.join(" ");
  const an = a.map(norm);
  const bn = b.map(norm);
  // `next` is a cumulative version that already contains `base` at its start.
  if (bn.length >= an.length && an.every((w, i) => w === bn[i])) return b.join(" ");
  // `next` (or its start) is already at the end of `base`: find the longest overlap.
  for (let k = Math.min(an.length, bn.length); k >= 1; k--) {
    let ok = true;
    for (let i = 0; i < k; i++) if (an[an.length - k + i] !== bn[i]) { ok = false; break; }
    if (ok && (k >= 2 || k === bn.length)) return [...a, ...b.slice(k)].join(" ");
  }
  // `next` already appears inside `base` (duplicate delivery).
  const joinedA = an.join(" ");
  if (bn.length >= 2 && joinedA.includes(bn.join(" "))) return a.join(" ");
  return [...a, ...b].join(" ");
}

/** Removes a run of 3+ words that is immediately repeated ("I am Rahul I am Rahul" → "I am Rahul"). */
export function collapseRepeats(text: string): string {
  let w = words(text);
  let changed = true;
  while (changed) {
    changed = false;
    outer: for (let len = Math.floor(w.length / 2); len >= 3; len--) {
      for (let i = 0; i + 2 * len <= w.length; i++) {
        let same = true;
        for (let j = 0; j < len; j++) if (norm(w[i + j]) !== norm(w[i + len + j])) { same = false; break; }
        if (same) {
          w = [...w.slice(0, i + len), ...w.slice(i + 2 * len)];
          changed = true;
          break outer;
        }
      }
    }
  }
  return w.join(" ");
}

/** Merges all results of ONE recognition session into final text, interim text and confidences. */
export function mergeSession(results: RawResult[]): { final: string; interim: string; confidences: number[] } {
  let final = "";
  const confidences: number[] = [];
  let interim = "";
  for (const r of results) {
    const t = r.text.trim();
    if (!t) continue;
    if (r.final) {
      const before = final;
      final = joinWithOverlap(final, t);
      if (final !== before && r.confidence > 0) confidences.push(r.confidence);
    } else {
      interim = joinWithOverlap(interim, t);
    }
  }
  // Interim text often repeats the final text on Android — show only the new part.
  if (interim && final) {
    const merged = joinWithOverlap(final, interim);
    interim = merged.length > final.length ? merged.slice(final.length).trim() : "";
  }
  return { final: collapseRepeats(final), interim, confidences };
}
