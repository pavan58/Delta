import "server-only";

// In-memory analytics for demo mode. In production these events are written to
// the SearchLog / AffiliateClick / OutfitLog tables (see prisma/schema.prisma).
type Ev =
  | { type: "search"; q: string; results: number; at: string }
  | { type: "click"; productId: string; retailer: string; at: string; demo: boolean }
  | { type: "outfit"; occasion: string; budget: number; count: number; at: string }
  | { type: "integration-error"; provider: string; error: string; at: string }
  | { type: "feedback"; brand: string; outcome: string; at: string };

const g = globalThis as unknown as { __fitiqEvents?: Ev[] };
g.__fitiqEvents ??= [];
const events = g.__fitiqEvents;

export function track(e: Ev) {
  events.push(e);
  if (events.length > 5000) events.splice(0, events.length - 5000);
}

export function eventsOf<T extends Ev["type"]>(type: T) {
  return events.filter((e): e is Extract<Ev, { type: T }> => e.type === type);
}
