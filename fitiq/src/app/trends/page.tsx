"use client";
import { useStore } from "@/lib/client/store";
import { usePost } from "@/lib/client/api";
import type { Trend } from "@/lib/data/trends";
import type { PersonalTrend } from "@/lib/engines/trends";
import type { FitAnalysis, Product } from "@/lib/types";
import { CATEGORY_LABEL, FIT_LABEL } from "@/lib/taxonomy";
import { GarmentArt } from "@/components/ProductImage";
import { ProductCard } from "@/components/ProductCard";
import { ErrorState, ProfilePrompt, SkeletonBlock } from "@/components/States";
import { Pill } from "@/components/Scores";

interface Data { trends: { trend: Trend; personal: PersonalTrend | null; picks: { product: Product; fit?: FitAnalysis }[] }[] }

export default function TrendsPage() {
  const store = useStore();
  const { data, error, loading, reload } = usePost<Data>("/api/trends", { context: store.context() }, store.ready);
  return (
    <div className="container-x py-8 sm:py-12">
      <p className="eyebrow">What&apos;s trending for men in India</p>
      <h1 className="h-display mt-2 text-4xl sm:text-6xl">Trending ≠ automatically<br className="hidden sm:block" /> recommended.</h1>
      <p className="mt-3 max-w-2xl text-ink-soft">FITIQ checks every trend against your proportions and preferred fit. Each trend shows its source. With no licensed trend data connected, trends are labelled <b>FITIQ editorial recommendation</b> and carry no statistics.</p>
      {!store.profile && store.ready && <div className="mt-6"><ProfilePrompt what="whether each trend suits your proportions" /></div>}
      {error && <div className="mt-6"><ErrorState message={error} onRetry={reload} /></div>}
      <div className="mt-10 space-y-6">
        {loading || !data ? [0, 1, 2].map((i) => <SkeletonBlock key={i} className="h-56" />) : data.trends.map(({ trend, personal, picks }) => (
          <article key={trend.id} className="card grid gap-5 p-5 md:grid-cols-[160px_1fr_1.2fr]">
            <div className="aspect-[4/5] overflow-hidden rounded-2xl"><GarmentArt category={trend.category} color="beige" pattern="texture" className="h-full w-full" /></div>
            <div>
              <p className="eyebrow">Trending · {CATEGORY_LABEL[trend.category]}</p>
              <h2 className="mt-1 font-display text-3xl">{trend.name}</h2>
              <p className="mt-1 text-sm text-ink-soft">{trend.description}</p>
              <p className="mt-2 text-[11px] text-ink-mute">Source: {trend.source.label}{trend.metric ? ` · ${trend.metric.label}: ${trend.metric.value}` : ""}</p>
              {personal && (
                <div className={`mt-4 rounded-xl p-3.5 text-sm ${personal.verdict === "RECOMMENDED" ? "bg-moss-soft" : personal.verdict === "MODERATE" ? "bg-saffron-soft" : "bg-bone-deep"}`}>
                  <p className="text-[11px] text-ink-mute">Your profile: {personal.profileSummary}</p>
                  <p className="mt-1"><Pill tone={personal.verdict === "RECOMMENDED" ? "moss" : personal.verdict === "MODERATE" ? "accent" : "neutral"}>{personal.verdict === "MODERATE" ? "Moderate version" : personal.verdict === "SKIP" ? "Not for now" : "Recommended"}</Pill></p>
                  <p className="mt-2 font-semibold">{personal.recommendation}</p>
                  {personal.avoid && <p className="mt-1"><span className="font-semibold">Avoid:</span> {personal.avoid}</p>}
                  <p className="mt-1 text-ink-soft"><span className="font-semibold text-ink">Reason:</span> {personal.reason}</p>
                  {personal.suggestedFit && <p className="mt-1 text-xs text-ink-mute">Suggested cut: {FIT_LABEL[personal.suggestedFit]}</p>}
                </div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {picks.map((p) => <ProductCard key={p.product.id} product={p.product} fit={p.fit} />)}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
