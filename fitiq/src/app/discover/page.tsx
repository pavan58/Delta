"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useStore } from "@/lib/client/store";
import { usePost } from "@/lib/client/api";
import type { SearchParams, SearchResult } from "@/lib/search";
import type { Category, ColorFamily, FitRisk, FitType, Occasion, StyleTag } from "@/lib/types";
import { ALL_FITS, ALL_OCCASIONS, ALL_STYLES, CATEGORY_LABEL, COLOR_HEX, COLOR_LABEL, FIT_LABEL, OCCASION_LABEL, RETAILER_NAME, STYLE_LABEL } from "@/lib/taxonomy";
import { ProductCard, ProductGrid } from "@/components/ProductCard";
import { EmptyState, ErrorState, ProfilePrompt, SkeletonGrid } from "@/components/States";
import { Icon } from "@/components/Icon";

export default function DiscoverPage() {
  return (
    <Suspense fallback={<div className="container-x py-10"><SkeletonGrid /></div>}>
      <Discover />
    </Suspense>
  );
}

const SORTS: [NonNullable<SearchParams["sort"]>, string][] = [["fit", "Best fit for me"], ["relevance", "Relevance"], ["deal", "Deal score"], ["price-asc", "Price: low to high"], ["price-desc", "Price: high to low"], ["discount", "Discount"], ["rating", "Rating"]];

function fromQuery(sp: URLSearchParams): SearchParams {
  const list = (k: string) => sp.get(k)?.split(",").filter(Boolean);
  const num = (k: string) => (sp.get(k) ? Number(sp.get(k)) : undefined);
  return {
    q: sp.get("q") ?? undefined,
    categories: list("cat") as Category[] | undefined,
    colors: list("color") as ColorFamily[] | undefined,
    fits: list("fit") as FitType[] | undefined,
    brands: list("brand"),
    retailers: list("retailer"),
    fitRisk: list("risk") as FitRisk[] | undefined,
    occasion: (sp.get("occasion") as Occasion) ?? undefined,
    style: (sp.get("style") as StyleTag) ?? undefined,
    minPrice: num("min"),
    maxPrice: num("max"),
    minDiscount: num("disc"),
    minRating: num("rating"),
    minFit: num("minfit"),
    minDeal: num("deal"),
    size: sp.get("size") ?? undefined,
    material: sp.get("material") ?? undefined,
    availableOnly: sp.get("avail") === "1",
    sort: (sp.get("sort") as SearchParams["sort"]) ?? undefined,
    page: num("page"),
  };
}

function toQuery(p: SearchParams) {
  const sp = new URLSearchParams();
  const set = (k: string, v: unknown) => {
    if (v === undefined || v === "" || v === false || (Array.isArray(v) && v.length === 0)) return;
    sp.set(k, Array.isArray(v) ? v.join(",") : v === true ? "1" : String(v));
  };
  set("q", p.q); set("cat", p.categories); set("color", p.colors); set("fit", p.fits); set("brand", p.brands); set("retailer", p.retailers);
  set("risk", p.fitRisk); set("occasion", p.occasion); set("style", p.style); set("min", p.minPrice); set("max", p.maxPrice); set("disc", p.minDiscount);
  set("rating", p.minRating); set("minfit", p.minFit); set("deal", p.minDeal); set("size", p.size); set("material", p.material); set("avail", p.availableOnly); set("sort", p.sort); set("page", p.page && p.page > 1 ? p.page : undefined);
  return sp.toString();
}

function Discover() {
  const store = useStore();
  const router = useRouter();
  const sp = useSearchParams();
  const params = useMemo(() => fromQuery(new URLSearchParams(sp.toString())), [sp]);
  const [q, setQ] = useState(params.q ?? "");
  const [showFilters, setShowFilters] = useState(false);
  useEffect(() => setQ(params.q ?? ""), [params.q]);

  const { data, error, loading, reload } = usePost<SearchResult>("/api/search", { params: { ...params, pageSize: 24 }, context: store.context() }, store.ready);
  const update = (patch: Partial<SearchParams>) => router.replace(`/discover?${toQuery({ ...params, page: 1, ...patch })}`, { scroll: false });
  const toggle = <T,>(arr: T[] | undefined, v: T) => ((arr ?? []).includes(v) ? (arr ?? []).filter((x) => x !== v) : [...(arr ?? []), v]);
  const activeCount = Object.entries(params).filter(([k, v]) => k !== "q" && k !== "sort" && k !== "page" && v !== undefined && v !== false && !(Array.isArray(v) && !v.length)).length;

  const filters = (
    <div className="space-y-6 text-sm">
      <FilterGroup title="Category">
        {(data?.facets.categories ?? []).map(([c, n]) => (
          <Check key={c} on={!!params.categories?.includes(c as Category)} onClick={() => update({ categories: toggle(params.categories, c as Category) })} label={`${CATEGORY_LABEL[c as Category]}`} count={n} />
        ))}
      </FilterGroup>
      <FilterGroup title="Price (₹)">
        <div className="flex gap-2">
          <input aria-label="Minimum price" className="input py-2" type="number" placeholder="Min" defaultValue={params.minPrice} onBlur={(e) => update({ minPrice: e.target.value ? Number(e.target.value) : undefined })} />
          <input aria-label="Maximum price" className="input py-2" type="number" placeholder="Max" defaultValue={params.maxPrice} onBlur={(e) => update({ maxPrice: e.target.value ? Number(e.target.value) : undefined })} />
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {[999, 1999, 2999].map((m) => <button key={m} className={`chip ${params.maxPrice === m ? "chip-on" : ""}`} onClick={() => update({ maxPrice: params.maxPrice === m ? undefined : m, minPrice: undefined })}>Under ₹{m.toLocaleString("en-IN")}</button>)}
        </div>
      </FilterGroup>
      {store.profile && (
        <FilterGroup title="Fit risk (for you)">
          {(["LOW", "MEDIUM", "HIGH"] as FitRisk[]).map((r) => <Check key={r} on={!!params.fitRisk?.includes(r)} onClick={() => update({ fitRisk: toggle(params.fitRisk, r) })} label={{ LOW: "🟢 Low", MEDIUM: "🟡 Medium", HIGH: "🔴 High" }[r]} />)}
          <label className="mt-2 block text-xs text-ink-mute">Minimum body compatibility: {params.minFit ?? 0}</label>
          <input type="range" min={0} max={95} step={5} defaultValue={params.minFit ?? 0} onMouseUp={(e) => update({ minFit: Number((e.target as HTMLInputElement).value) || undefined })} onTouchEnd={(e) => update({ minFit: Number((e.target as HTMLInputElement).value) || undefined })} className="w-full accent-ink" />
        </FilterGroup>
      )}
      <FilterGroup title="Fit">
        <div className="flex flex-wrap gap-1">{ALL_FITS.map((f) => <button key={f} className={`chip ${params.fits?.includes(f) ? "chip-on" : ""}`} onClick={() => update({ fits: toggle(params.fits, f) })}>{FIT_LABEL[f]}</button>)}</div>
      </FilterGroup>
      <FilterGroup title="Colour">
        <div className="flex flex-wrap gap-1.5">
          {(data?.facets.colors ?? []).map(([c]) => (
            <button key={c} title={COLOR_LABEL[c as ColorFamily]} aria-label={COLOR_LABEL[c as ColorFamily]} onClick={() => update({ colors: toggle(params.colors, c as ColorFamily) })} className={`h-7 w-7 rounded-full border-2 ${params.colors?.includes(c as ColorFamily) ? "border-ink" : "border-white shadow-[0_0_0_1px_#DDD4C4]"}`} style={{ background: COLOR_HEX[c as ColorFamily] }} />
          ))}
        </div>
      </FilterGroup>
      <FilterGroup title="Occasion">
        <select className="input py-2" value={params.occasion ?? ""} onChange={(e) => update({ occasion: (e.target.value || undefined) as Occasion })}>
          <option value="">Any</option>
          {ALL_OCCASIONS.map((o) => <option key={o} value={o}>{OCCASION_LABEL[o]}</option>)}
        </select>
      </FilterGroup>
      <FilterGroup title="Style">
        <select className="input py-2" value={params.style ?? ""} onChange={(e) => update({ style: (e.target.value || undefined) as StyleTag })}>
          <option value="">Any</option>
          {ALL_STYLES.map((s) => <option key={s} value={s}>{STYLE_LABEL[s]}</option>)}
        </select>
      </FilterGroup>
      <FilterGroup title="Discount & deal">
        <div className="flex flex-wrap gap-1">
          {[20, 40, 60].map((d) => <button key={d} className={`chip ${params.minDiscount === d ? "chip-on" : ""}`} onClick={() => update({ minDiscount: params.minDiscount === d ? undefined : d })}>{d}%+ off</button>)}
          {[70, 80].map((d) => <button key={d} className={`chip ${params.minDeal === d ? "chip-on" : ""}`} onClick={() => update({ minDeal: params.minDeal === d ? undefined : d })}>Deal {d}+</button>)}
        </div>
      </FilterGroup>
      <FilterGroup title="Rating">
        <div className="flex gap-1">{[4, 4.3].map((r) => <button key={r} className={`chip ${params.minRating === r ? "chip-on" : ""}`} onClick={() => update({ minRating: params.minRating === r ? undefined : r })}>{r}★ & up</button>)}</div>
      </FilterGroup>
      <FilterGroup title="Size">
        <div className="flex flex-wrap gap-1">{["S", "M", "L", "XL", "30", "32", "34", "8", "9"].map((s) => <button key={s} className={`chip ${params.size === s ? "chip-on" : ""}`} onClick={() => update({ size: params.size === s ? undefined : s })}>{s}</button>)}</div>
      </FilterGroup>
      <FilterGroup title="Material">
        <div className="flex flex-wrap gap-1">{(data?.facets.materials ?? []).slice(0, 8).map(([m]) => <button key={m} className={`chip ${params.material === m ? "chip-on" : ""}`} onClick={() => update({ material: params.material === m ? undefined : m })}>{m}</button>)}</div>
      </FilterGroup>
      <FilterGroup title="Brand">
        {(data?.facets.brands ?? []).slice(0, 12).map(([b, n]) => <Check key={b} on={!!params.brands?.includes(b)} onClick={() => update({ brands: toggle(params.brands, b) })} label={b} count={n} />)}
      </FilterGroup>
      <FilterGroup title="Retailer">
        {(data?.facets.retailers ?? []).map(([r, n]) => <Check key={r} on={!!params.retailers?.includes(r)} onClick={() => update({ retailers: toggle(params.retailers, r) })} label={RETAILER_NAME[r] ?? r} count={n} />)}
      </FilterGroup>
      <Check on={!!params.availableOnly} onClick={() => update({ availableOnly: !params.availableOnly })} label="In stock only" />
      {activeCount > 0 && <button className="btn-ghost btn-sm w-full" onClick={() => router.replace(`/discover${params.q ? `?q=${encodeURIComponent(params.q)}` : ""}`)}>Clear all filters</button>}
    </div>
  );

  return (
    <div className="container-x py-8">
      <p className="eyebrow">Discover</p>
      <h1 className="h-display mt-2 text-4xl sm:text-5xl">Search that knows your fit.</h1>
      <form className="mt-6 flex items-center gap-2 rounded-full border border-ink/20 bg-white p-1.5 pl-5 focus-within:border-ink" onSubmit={(e) => { e.preventDefault(); update({ q: q.trim() || undefined }); }}>
        <Icon name="search" className="h-5 w-5 text-ink-mute" />
        <label htmlFor="q" className="sr-only">Search</label>
        <input id="q" className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none" placeholder="Try “navy chinos under 1500” or “kurta for haldi”" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn-primary btn-sm">Search</button>
      </form>
      {data?.parsed && data.parsed.understood.length > 1 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="eyebrow">Understood</span>
          {data.parsed.understood.slice(1).map((u) => <span key={u.label} className="chip"><span className="text-ink-mute">{u.label}</span>{u.value}</span>)}
        </div>
      )}
      {!store.profile && store.ready && <div className="mt-5"><ProfilePrompt what="fit scores, fit risk and your recommended size on every product" /></div>}

      <div className="mt-8 grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block" aria-label="Filters">{filters}</aside>
        <div>
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-sm text-ink-soft">{loading ? "Searching…" : data ? `${data.total} products` : ""}</p>
            <div className="flex items-center gap-2">
              <button className="btn-ghost btn-sm lg:hidden" onClick={() => setShowFilters(true)}><Icon name="filter" className="h-4 w-4" /> Filters{activeCount ? ` (${activeCount})` : ""}</button>
              <label htmlFor="sort" className="sr-only">Sort</label>
              <select id="sort" className="input w-auto py-2 text-xs" value={params.sort ?? (store.profile ? "fit" : "relevance")} onChange={(e) => update({ sort: e.target.value as SearchParams["sort"] })}>
                {SORTS.filter(([k]) => store.profile || k !== "fit").map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
          </div>
          {loading && <SkeletonGrid />}
          {!loading && error && <ErrorState message={error} onRetry={reload} />}
          {!loading && !error && data && data.hits.length === 0 && (
            <EmptyState title="Nothing matches — yet" body="Try removing a filter or widening the price range. Similar alternatives may exist in a nearby category." cta={{ onClick: () => router.replace("/discover"), label: "Reset search" }} />
          )}
          {!loading && !error && data && data.hits.length > 0 && (
            <>
              <ProductGrid>
                {data.hits.map((h) => <ProductCard key={h.product.id} product={h.product} fit={h.fit} deal={h.deal} offers={h.offers} lowestPrice={h.lowestPrice} />)}
              </ProductGrid>
              {data.total > data.pageSize && (
                <div className="mt-8 flex items-center justify-center gap-3">
                  <button className="btn-ghost btn-sm" disabled={data.page <= 1} onClick={() => update({ page: data.page - 1 })}>Previous</button>
                  <span className="text-xs text-ink-mute">Page {data.page} of {Math.ceil(data.total / data.pageSize)}</span>
                  <button className="btn-ghost btn-sm" disabled={data.page * data.pageSize >= data.total} onClick={() => update({ page: data.page + 1 })}>Next</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showFilters && (
        <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setShowFilters(false)} />
          <div className="relative ml-auto h-full w-[86%] max-w-sm overflow-y-auto bg-bone p-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-display text-xl">Filters</p>
              <button onClick={() => setShowFilters(false)} aria-label="Close filters"><Icon name="x" /></button>
            </div>
            {filters}
            <button className="btn-primary mt-6 w-full" onClick={() => setShowFilters(false)}>Show {data?.total ?? ""} results</button>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="eyebrow mb-2">{title}</legend>
      <div className="space-y-1">{children}</div>
    </fieldset>
  );
}

function Check({ on, onClick, label, count }: { on: boolean; onClick: () => void; label: string; count?: number }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2 py-0.5">
      <span className="flex items-center gap-2"><input type="checkbox" checked={on} onChange={onClick} className="h-3.5 w-3.5 accent-ink" /> {label}</span>
      {count !== undefined && <span className="text-[11px] text-ink-mute">{count}</span>}
    </label>
  );
}
