import type { Product } from "../types";
import { demoProvider } from "./demo";
import { merchantFeedProvider } from "./merchant-feed";
import type { ProductProvider, ProviderStatus } from "./types";

/**
 * Register additional retailer adapters here. Each adapter is independent;
 * adding one never requires changes to the engines or UI.
 */
export const PROVIDERS: ProductProvider[] = [merchantFeedProvider, demoProvider];

export function isDemoMode() {
  return !PROVIDERS.some((p) => p.kind !== "demo" && p.isConfigured());
}

const status = new Map<string, { lastSyncAt?: string; lastError?: string; productCount: number }>();
let catalog: Product[] | null = null;
let loading: Promise<Product[]> | null = null;

/** Loads products from configured non-demo providers, falling back to demo data. */
export async function loadCatalog(force = false): Promise<Product[]> {
  if (catalog && !force) return catalog;
  if (loading && !force) return loading;
  loading = (async () => {
    const live: Product[] = [];
    for (const p of PROVIDERS.filter((x) => x.kind !== "demo" && x.isConfigured())) {
      const res = await p.fetchProducts();
      if (res.ok) {
        live.push(...res.data);
        status.set(p.id, { lastSyncAt: res.fetchedAt, productCount: res.data.length });
      } else {
        status.set(p.id, { lastSyncAt: res.fetchedAt, lastError: res.error, productCount: 0 });
      }
    }
    let result = live;
    if (live.length === 0) {
      const res = await demoProvider.fetchProducts();
      result = res.ok ? res.data : [];
      status.set("demo", { lastSyncAt: res.fetchedAt, productCount: result.length });
    }
    catalog = result;
    loading = null;
    return result;
  })();
  return loading;
}

export function providerStatuses(): ProviderStatus[] {
  return PROVIDERS.map((p) => ({
    id: p.id,
    name: p.name,
    kind: p.kind,
    configured: p.isConfigured(),
    retailers: p.retailers,
    ...(status.get(p.id) ?? { productCount: 0 }),
  }));
}

export function providerFor(product: Product): ProductProvider | undefined {
  return PROVIDERS.find((p) => p.id === product.source.providerId);
}
