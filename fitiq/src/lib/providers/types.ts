import type { Product } from "../types";
import type { PricePoint } from "../data/price-history";

/**
 * A ProductProvider adapts ONE permitted data source (official API, affiliate
 * feed, licensed merchant feed) into normalized FITIQ Products.
 *
 * Rules every adapter must follow:
 *  - Only use sources whose terms permit this use (no ToS-violating scraping,
 *    no CAPTCHA/anti-bot/auth/paywall circumvention).
 *  - Never fabricate fields. Leave optional fields undefined when the source
 *    does not supply them.
 *  - Set `source.realtime` only if the provider contractually delivers
 *    real-time prices.
 */
export interface ProductProvider {
  id: string;
  name: string;
  kind: Product["source"]["kind"];
  retailers: string[];
  /** Whether this provider can run with the current environment. */
  isConfigured(): boolean;
  /** Full or incremental catalogue sync. */
  fetchProducts(opts?: { since?: Date; limit?: number }): Promise<ProviderResult<Product[]>>;
  /** Lightweight price/availability refresh for known product ids. */
  fetchPrices?(ids: string[]): Promise<ProviderResult<{ id: string; price: number; mrp?: number; availability: boolean; checkedAt: string }[]>>;
  /** Historical prices, only if the provider actually stores them. */
  fetchPriceHistory?(id: string): Promise<ProviderResult<PricePoint[]>>;
  /** Wrap an outbound product URL with affiliate parameters when permitted. */
  affiliateUrl?(product: Product, affiliateId: string): string;
}

export type ProviderResult<T> =
  | { ok: true; data: T; fetchedAt: string }
  | { ok: false; error: string; retryable: boolean; fetchedAt: string };

export interface ProviderStatus {
  id: string;
  name: string;
  kind: string;
  configured: boolean;
  retailers: string[];
  lastSyncAt?: string;
  lastError?: string;
  productCount: number;
}
