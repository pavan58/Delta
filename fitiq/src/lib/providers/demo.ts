import { DEMO_PRODUCTS } from "../data/demo-catalog";
import { demoPriceHistory } from "../data/price-history";
import type { ProductProvider } from "./types";

/** Serves the clearly-labelled demo catalogue. Always available. */
export const demoProvider: ProductProvider = {
  id: "demo",
  name: "FITIQ demo catalogue",
  kind: "demo",
  retailers: Array.from(new Set(DEMO_PRODUCTS.map((p) => p.retailer))),
  isConfigured: () => true,
  async fetchProducts() {
    return { ok: true, data: DEMO_PRODUCTS, fetchedAt: new Date().toISOString() };
  },
  async fetchPriceHistory(id) {
    const p = DEMO_PRODUCTS.find((x) => x.id === id);
    return { ok: true, data: p ? demoPriceHistory(p) : [], fetchedAt: new Date().toISOString() };
  },
};
