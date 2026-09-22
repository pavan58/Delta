"use client";
// Local-first personal data store for DEMO MODE. Body measurements, wardrobe
// photos and feedback stay in this browser (localStorage) and are sent to the
// server only per-request for scoring — never persisted server-side.
// Production: swap for authenticated API persistence (see prisma/schema.prisma).
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { FitFeedback, SizeMapEntry, UserProfile, WardrobeItem } from "../types";

interface State {
  profile: UserProfile | null;
  wardrobe: WardrobeItem[];
  feedback: FitFeedback[];
  sizeMap: SizeMapEntry[];
  saved: string[];
}

interface Store extends State {
  ready: boolean;
  setProfile(p: UserProfile | null): void;
  addWardrobe(items: WardrobeItem[]): void;
  removeWardrobe(id: string): void;
  addFeedback(f: FitFeedback): void;
  upsertSize(e: SizeMapEntry): void;
  removeSize(brand: string, category: string): void;
  toggleSaved(id: string): void;
  loadDemoPersona(): void;
  deleteAll(): void;
  /** Personal context sent to API routes. Images are stripped. */
  context(): { profile: UserProfile | null; feedback: FitFeedback[]; sizeMap: SizeMapEntry[]; wardrobe: WardrobeItem[] };
}

const KEY = "fitiq:v1";
const empty: State = { profile: null, wardrobe: [], feedback: [], sizeMap: [], saved: [] };
const Ctx = createContext<Store | null>(null);

function read(): State {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...empty, ...(JSON.parse(raw) as Partial<State>) } : empty;
  } catch {
    return empty;
  }
}

export const DEMO_PERSONA: UserProfile = {
  version: 1,
  name: "Arjun (demo)",
  city: "Pune",
  body: { heightCm: 170, weightKg: 58, waistIn: 30, chestIn: 36, shoulderIn: 16.5, shoeUK: 8, build: "slim", legProportion: "balanced" },
  fit: { tops: "regular", bottoms: "straight" },
  style: { styles: ["smart-casual", "minimal"], colors: ["navy", "white", "beige", "olive"], avoidColors: [], brands: [], materials: ["Cotton"], patterns: ["solid", "texture"], shoes: ["sneakers", "loafers"], accessories: ["watch"] },
  budget: { perOutfit: 3000, monthly: 5000 },
  photoConsent: false,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};

const now = () => new Date().toISOString();
const w = (id: string, label: string, category: WardrobeItem["category"], colorFamily: WardrobeItem["colorFamily"], styles: WardrobeItem["styles"], occasions: WardrobeItem["occasions"] = []): WardrobeItem => ({
  id, label, category, colorFamily, pattern: "solid", styles, seasons: ["all"], occasions, addedAt: now(), detectedBy: "user",
});

export const DEMO_WARDROBE: WardrobeItem[] = [
  w("demo-1", "White shirt", "shirt", "white", ["smart-casual", "formal", "minimal"], ["office", "date", "interview"]),
  w("demo-2", "Black jeans", "jeans", "black", ["casual", "minimal"], ["college", "casual", "party"]),
  w("demo-3", "Blue jeans", "jeans", "blue", ["casual"], ["college", "casual", "travel"]),
  w("demo-4", "White sneakers", "sneakers", "white", ["minimal", "casual", "smart-casual"], ["college", "casual", "office"]),
  w("demo-5", "Brown belt", "belt", "brown", ["smart-casual", "formal"], ["office"]),
];

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>(empty);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setState(read());
    setReady(true);
    const onStorage = (e: StorageEvent) => e.key === KEY && setState(read());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const update = useCallback((fn: (s: State) => State) => {
    setState((prev) => {
      const next = fn(prev);
      try {
        window.localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* storage full or blocked — keep in memory */
      }
      return next;
    });
  }, []);

  const store = useMemo<Store>(
    () => ({
      ...state,
      ready,
      setProfile: (p) => update((s) => ({ ...s, profile: p })),
      addWardrobe: (items) => update((s) => ({ ...s, wardrobe: [...items, ...s.wardrobe] })),
      removeWardrobe: (id) => update((s) => ({ ...s, wardrobe: s.wardrobe.filter((x) => x.id !== id) })),
      addFeedback: (f) =>
        update((s) => {
          // Learn the personal size map from feedback: a "perfect" fit becomes a size-map entry.
          const sizeMap = f.outcome === "perfect"
            ? [...s.sizeMap.filter((e) => !(e.brand === f.brand && e.category === f.category)), { brand: f.brand, retailer: f.retailer, category: f.category, size: f.size, source: "feedback" as const, confidence: 0.9, updatedAt: now() }]
            : s.sizeMap;
          return { ...s, feedback: [f, ...s.feedback], sizeMap };
        }),
      upsertSize: (e) => update((s) => ({ ...s, sizeMap: [...s.sizeMap.filter((x) => !(x.brand === e.brand && x.category === e.category)), e] })),
      removeSize: (brand, category) => update((s) => ({ ...s, sizeMap: s.sizeMap.filter((x) => !(x.brand === brand && x.category === category)) })),
      toggleSaved: (id) => update((s) => ({ ...s, saved: s.saved.includes(id) ? s.saved.filter((x) => x !== id) : [id, ...s.saved] })),
      loadDemoPersona: () =>
        update((s) => ({
          ...s,
          profile: { ...DEMO_PERSONA, createdAt: now(), updatedAt: now() },
          wardrobe: s.wardrobe.length ? s.wardrobe : DEMO_WARDROBE,
        })),
      deleteAll: () => {
        try {
          window.localStorage.removeItem(KEY);
        } catch {
          /* ignore */
        }
        setState(empty);
      },
      context: () => ({
        profile: state.profile,
        feedback: state.feedback,
        sizeMap: state.sizeMap,
        wardrobe: state.wardrobe.map(({ image: _i, ...rest }) => rest),
      }),
    }),
    [state, ready, update],
  );

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside StoreProvider");
  return s;
}
