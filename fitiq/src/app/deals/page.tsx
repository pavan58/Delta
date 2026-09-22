"use client";
import Link from "next/link";
import { useStore } from "@/lib/client/store";
import { usePost } from "@/lib/client/api";
import type { DealScore, FitAnalysis, Outfit, PriceStats, Product } from "@/lib/types";
import { formatINR } from "@/lib/taxonomy";
import { ProductCard, ProductGrid, Rail } from "@/components/ProductCard";
import { OutfitCard } from "@/components/OutfitCard";
import { EmptyState, ErrorState, SectionHead, SkeletonGrid, SkeletonBlock } from "@/components/States";

type Row = { product: Product; deal: DealScore; fit?: FitAnalysis; stats: PriceStats };
interface Deals { top: Row[]; drops: Row[]; under999: Row[]; cheapestOutfits: Outfit[] }

export default function DealsPage() {
  const store = useStore();
  const { data, error, loading, reload } = usePost<Deals>("/api/deals", { context: store.context() }, store.ready);
  return (
    <div className="container-x py-8 sm:py-12">
      <p className="eyebrow">Deal intelligence</p>
      <h1 className="h-display mt-2 text-4xl sm:text-6xl">Deals worth your money.</h1>
      <p className="mt-3 max-w-2xl text-ink-soft">
        <b>Deal Score</b> is a FITIQ-generated shopping metric combining the current discount, detected price history, rating quality, popularity, availability and your preferences — only from data we actually hold. <Link href="/how-scores-work" className="underline">How it works</Link>.
      </p>
      {error && <div className="mt-8"><ErrorState message={error} onRetry={reload} /></div>}

      <section className="mt-12">
        <SectionHead eyebrow="Top deal scores" title="Best overall deals" />
        {loading || !data ? <SkeletonGrid /> : <ProductGrid>{data.top.map((r) => <ProductCard key={r.product.id} product={r.product} fit={r.fit} deal={r.deal.score} />)}</ProductGrid>}
      </section>

      <section className="mt-16">
        <SectionHead eyebrow="Detected price drops" title="Cheaper than 30 days ago" />
        {loading || !data ? <SkeletonGrid n={4} /> : data.drops.length === 0 ? <EmptyState title="No tracked drops right now" body="Drops only appear when FITIQ has recorded an earlier, higher price for the same listing." /> : (
          <Rail>{data.drops.map((r) => <ProductCard key={r.product.id} product={r.product} fit={r.fit} deal={r.deal.score} note={`Detected drop: ${formatINR(r.stats.thirtyDaysAgo! - r.product.price)} vs 30 days ago`} />)}</Rail>
        )}
      </section>

      <section className="mt-16">
        <SectionHead eyebrow="Under ₹999" title="Small spend, sorted by deal score" action={{ href: "/discover?max=999&sort=deal", label: "See all" }} />
        {loading || !data ? <SkeletonGrid n={4} /> : <Rail>{data.under999.map((r) => <ProductCard key={r.product.id} product={r.product} fit={r.fit} deal={r.deal.score} />)}</Rail>}
      </section>

      <section className="mt-16">
        <SectionHead eyebrow="Cheapest complete outfits" title="Full looks for the least money" />
        {!store.profile ? <EmptyState title="Personal to your fit" body="Cheapest outfits only include pieces with acceptable fit risk for your body — build your profile to see them." cta={{ href: "/onboarding", label: "Build my style profile" }} /> : loading || !data ? <SkeletonBlock className="h-80" /> : (
          <div className="grid items-start gap-5 lg:grid-cols-3">{data.cheapestOutfits.map((o) => <OutfitCard key={o.id} outfit={o} compact />)}</div>
        )}
      </section>
      <p className="mt-10 text-[11px] text-ink-mute">FITIQ never displays a discount the provider did not supply, and never claims a historical low without recorded history.</p>
    </div>
  );
}
