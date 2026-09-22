import type { UserProfile } from "@/lib/types";

export const slimProfile: UserProfile = {
  version: 1,
  name: "Test",
  body: { heightCm: 170, weightKg: 58, waistIn: 30, chestIn: 36, shoeUK: 8, build: "slim" },
  fit: { tops: "regular", bottoms: "straight" },
  style: { styles: ["smart-casual", "minimal"], colors: ["navy", "beige", "white"], avoidColors: [], brands: [], materials: [], patterns: [], shoes: [], accessories: [] },
  budget: { perOutfit: 3000 },
  photoConsent: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};
