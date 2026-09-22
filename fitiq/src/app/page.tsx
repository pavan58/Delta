"use client";
import Link from "next/link";
import { useStore } from "@/lib/client/store";
import { usePost } from "@/lib/client/api";
import type { FitAnalysis, Outfit, Product } from "@/lib/types";
import type { PersonalTrend } from "@/lib/engines/trends";
import type { BetterFitAlt } from "@/lib/engines/alternatives";
import type { GapSuggestion } from "@/lib/engines/wardrobe";
import type { Experiment } from "@/lib/engines/experiments";
import type { Trend } from "@/lib/data/trends";
import { BUILD_LABEL, FIT_LABEL, STYLE_LABEL, cmToFeetIn, formatINR } from "@/lib/taxonomy";
import { GarmentArt, ProductImage } from "@/components/ProductImage";
import { ProductCard, Rail } from "@/components/ProductCard";
import { OutfitCard } from "@/components/OutfitCard";
import { EmptyState, ErrorState, SectionHead, SkeletonBlock, SkeletonGrid } from "@/components/States";
import { RiskBadge, Pill } from "@/components/Scores";
import { Icon } from "@/components/Icon";

type Row = { product: Product; deal: number; fit?: FitAnalysis };
interface Home {
  personalized: boolean;
  bestDeals: Row[];
  under999: Row[];
  trends: (PersonalTrend | Trend)[];
  outfits?: Outfit[];
  betterFit?: { from: Product; fromFit: FitAnalysis; alt: BetterFitAlt }[];
  cheapest?: Outfit[];
  owned?: { score: number; ids: string[] }[];
  gaps?: GapSuggestion[];
  experiments?: Experiment[];
  occasion?: string;
}

export default function HomePage() {
  const store = useStore();
  const { data, error, loading, reload } = usePost<Home>("/api/home", { context: store.context() }, store.ready);
  const p = store.profile;

  return (
    <>
      <Hero />
      <div className="container-x space-y-20 py-14">
        {/* 1. Your fit profile */}
        <section>
          <SectionHead eyebrow="01 · Your fit profile" title={p ? `${p.name ? p.name.split(" ")[0] + "'s" : "Your"} Style DNA` : "Start with your body, not a trend"} action={p ? { href: "/profile", label: "Edit" } : undefined} />
          {!store.ready ? <SkeletonBlock className="h-28" /> : p ? (
            <div className="card grid gap-4 p-5 sm:grid-cols-4">
              <Stat k="Build" v={BUILD_LABEL[p.body.build]} />
              <Stat k="Height · weight" v={`${cmToFeetIn(p.body.heightCm)} · ${p.body.weightKg} kg`} />
              <Stat k="Preferred fit" v={`${FIT_LABEL[p.fit.tops]} / ${FIT_LABEL[p.fit.bottoms]}`} />
              <Stat k="Per outfit" v={formatINR(p.budget.perOutfit)} />
              <div className="flex flex-wrap gap-1.5 sm:col-span-4">{p.style.styles.map((s) => <Pill key={s}>{STYLE_LABEL[s]}</Pill>)}</div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {[["Body + fit", "Height, weight, chest, waist and how you like clothes to sit."], ["Style DNA", "Minimal, smart casual, streetwear, modern Indian — your mix."], ["Budget", "Per outfit or per month. We never go over unless you say so."]].map(([t, b], i) => (
                <div key={t} className="card p-5"><p className="font-display text-4xl text-saffron">0{i + 1}</p><p className="mt-2 font-semibold">{t}</p><p className="mt-1 text-sm text-ink-soft">{b}</p></div>
              ))}
              <div className="md:col-span-3"><Link href="/onboarding" className="btn-primary">Build my style profile — 2 minutes</Link></div>
            </div>
          )}
        </section>

        {error && <ErrorState message={error} onRetry={reload} />}

        {/* 2. Trending for you */}
        <section>
          <SectionHead eyebrow="02 · Trending for you" title="Trending ≠ automatically recommended" action={{ href: "/trends", label: "All trends" }} />
          {loading || !data ? <SkeletonBlock className="h-40" /> : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {data.trends.map((t) => {
                const pt = "verdict" in t ? t : null;
                const trend = pt ? pt.trend : (t as Trend);
                return (
                  <Link key={trend.id} href="/trends" className="card flex flex-col p-4 hover:border-ink/40">
                    <div className="flex items-center justify-between gap-2">
                      <p className="eyebrow">Trending</p>
                      {pt && <Pill tone={pt.verdict === "RECOMMENDED" ? "moss" : pt.verdict === "MODERATE" ? "accent" : "neutral"}>{pt.verdict === "MODERATE" ? "Moderate version" : pt.verdict === "SKIP" ? "Try instead" : "For you"}</Pill>}
                    </div>
                    <p className="mt-1 font-display text-xl">{trend.name}</p>
                    <p className="mt-1 flex-1 text-xs text-ink-soft">{pt ? pt.recommendation : trend.description}</p>
                    <p className="mt-3 text-[10px] text-ink-mute">{trend.source.label}</p>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* 3. Best deals */}
        <section>
          <SectionHead eyebrow="03 · Best deals" title="Deal score, not just discount" action={{ href: "/deals", label: "All deals" }} />
          {loading || !data ? <SkeletonGrid n={4} /> : <Rail>{data.bestDeals.map((r) => <ProductCard key={r.product.id} product={r.product} fit={r.fit} deal={r.deal} />)}</Rail>}
        </section>

        {/* 4. Complete outfits */}
        <section>
          <SectionHead eyebrow="04 · Complete outfits" title={p ? `Built for your ${formatINR(p.budget.perOutfit)} budget` : "Complete outfits, fitted to you"} action={{ href: "/stylist", label: "AI Stylist" }} />
          {!p ? <EmptyState title="Outfits start with your profile" body="We check every piece against your body and budget before suggesting it." cta={{ href: "/onboarding", label: "Build my style profile" }} /> : loading || !data ? <div className="grid gap-5 lg:grid-cols-3">{[0, 1, 2].map((i) => <SkeletonBlock key={i} className="h-96" />)}</div> : data.outfits?.length ? (
            <div className="grid items-start gap-5 lg:grid-cols-3">{data.outfits.map((o) => <OutfitCard key={o.id} outfit={o} compact />)}</div>
          ) : <EmptyState title="No complete outfit fits your budget yet" body="Try the AI Stylist with a different occasion or budget." cta={{ href: "/stylist", label: "Open AI Stylist" }} />}
        </section>

        {/* 5. Under ₹999 */}
        <section>
          <SectionHead eyebrow="05 · Under ₹999" title="Low price, low fit risk" action={{ href: "/discover?max=999", label: "See all" }} />
          {loading || !data ? <SkeletonGrid n={4} /> : <Rail>{data.under999.map((r) => <ProductCard key={r.product.id} product={r.product} fit={r.fit} deal={r.deal} />)}</Rail>}
        </section>

        {/* 6. Better-fit alternatives */}
        <section>
          <SectionHead eyebrow="06 · Better-fit alternatives" title="Popular, but not for your proportions" />
          {!p ? <p className="text-sm text-ink-soft">Build your profile to see popular items that carry fit risk for you — and what to buy instead.</p> : loading || !data ? <SkeletonBlock className="h-40" /> : data.betterFit?.length ? (
            <div className="grid gap-4 lg:grid-cols-3">
              {data.betterFit.map((b) => (
                <div key={b.from.id} className="card p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-16 w-14 shrink-0 overflow-hidden rounded-lg bg-bone-deep opacity-70"><ProductImage product={b.from} className="h-full w-full" /></div>
                    <div className="min-w-0 text-sm"><p className="truncate">{b.from.title}</p><p className="flex items-center gap-1.5 text-xs text-ink-mute">Fit {b.fromFit.overall} <RiskBadge risk={b.fromFit.risk} compact /></p></div>
                  </div>
                  <p className="my-2 text-xs text-ink-soft">{b.fromFit.riskReasons[0]}</p>
                  <Link href={`/product/${encodeURIComponent(b.alt.product.id)}`} className="flex items-center gap-3 rounded-xl bg-moss-soft/60 p-2 hover:bg-moss-soft">
                    <div className="h-16 w-14 shrink-0 overflow-hidden rounded-lg bg-bone-deep"><ProductImage product={b.alt.product} className="h-full w-full" /></div>
                    <div className="min-w-0 text-sm"><p className="truncate font-medium">{b.alt.product.title}</p><p className="flex items-center gap-1.5 text-xs">Fit <b>{b.alt.fit.overall}</b> <RiskBadge risk={b.alt.fit.risk} compact /> · {formatINR(b.alt.product.price)}</p></div>
                  </Link>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-ink-soft">Nothing popular is flagged as risky for your profile right now.</p>}
        </section>

        {/* 7. Cheapest complete outfits */}
        <section>
          <SectionHead eyebrow="07 · Cheapest complete outfits" title="The least you can spend on a full look" action={{ href: "/deals", label: "More" }} />
          {!p ? <p className="text-sm text-ink-soft">Build your profile — cheapest looks are only shown when every piece has acceptable fit for you.</p> : loading || !data ? <SkeletonBlock className="h-40" /> : (
            <div className="grid items-start gap-5 lg:grid-cols-3">{data.cheapest?.map((o) => <OutfitCard key={o.id} outfit={o} compact />)}</div>
          )}
        </section>

        {/* 8 + 9. Use what you own / Wardrobe gaps */}
        <section className="grid gap-10 lg:grid-cols-2">
          <div>
            <SectionHead eyebrow="08 · Use what you own" title="Outfits already in your closet" action={{ href: "/wardrobe", label: "Wardrobe" }} />
            {!store.wardrobe.length ? <EmptyState title="Your digital wardrobe is empty" body="Add what you own (photos optional). FITIQ will find outfits you can wear today — for ₹0." cta={{ href: "/wardrobe", label: "Add wardrobe items" }} /> : loading || !data ? <SkeletonBlock className="h-40" /> : data.owned?.length ? (
              <div className="space-y-3">
                {data.owned.map((o) => (
                  <div key={o.ids.join()} className="card flex items-center gap-2 p-3">
                    {o.ids.map((id) => { const w = store.wardrobe.find((x) => x.id === id); return w ? <div key={id} className="h-16 w-14 overflow-hidden rounded-lg bg-bone-deep" title={w.label}>{/* eslint-disable-next-line @next/next/no-img-element */}{w.image ? <img src={w.image} alt={w.label} className="h-full w-full object-cover" /> : <GarmentArt category={w.category} color={w.colorFamily} pattern={w.pattern} className="h-full w-full" />}</div> : null; })}
                    <p className="ml-2 text-xs text-ink-soft">{o.ids.map((id) => store.wardrobe.find((x) => x.id === id)?.label).join(" + ")}</p>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-ink-soft">Add a top, a bottom and shoes to see combinations.</p>}
          </div>
          <div>
            <SectionHead eyebrow="09 · Wardrobe gaps" title="One purchase, many outfits" />
            {!store.wardrobe.length ? <p className="text-sm text-ink-soft">Once FITIQ knows what you own, it finds the single purchase that unlocks the most new outfits — and tells you what you don&apos;t need.</p> : loading || !data ? <SkeletonBlock className="h-40" /> : (
              <div className="space-y-3">
                {data.gaps?.map((g) => (
                  <Link key={g.id} href={`/discover?q=${encodeURIComponent(g.query)}`} className="card flex items-center gap-4 p-4 hover:border-ink/40">
                    <div className="h-20 w-16 shrink-0 overflow-hidden rounded-lg"><GarmentArt category={g.category} color={g.color} className="h-full w-full" /></div>
                    <div>
                      <p className="font-semibold">{g.label}</p>
                      <p className="text-sm text-ink-soft">+{g.newOutfits} new outfit combinations{g.priceRange ? ` · ${formatINR(g.priceRange[0])}–${formatINR(g.priceRange[1])}` : ""}</p>
                      <p className="text-xs text-ink-mute">{g.reason}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* 10. Style experiments */}
        <section>
          <SectionHead eyebrow="10 · Style experiments" title="Try a new style, low risk" action={{ href: "/wardrobe#experiments", label: "More" }} />
          {!p ? <p className="text-sm text-ink-soft">Build your profile to get low-risk experiments that reuse what you own.</p> : loading || !data ? <SkeletonBlock className="h-40" /> : (
            <div className="grid gap-4 md:grid-cols-2">
              {data.experiments?.map((e) => (
                <div key={e.style} className="card p-5">
                  <div className="flex items-center justify-between"><p className="font-display text-2xl">{e.title}</p><Pill tone={e.risk === "LOW-RISK" ? "moss" : "neutral"}>{e.risk === "LOW-RISK" ? "Low-risk experiment" : "Starter"}</Pill></div>
                  <p className="mt-1 text-sm text-ink-soft">{e.note}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {e.owned.map((w) => <span key={w.id} className="chip">Own: {w.label}</span>)}
                    {e.toBuy.map((b) => <Link key={b.id} href={`/product/${encodeURIComponent(b.id)}`} className="chip border-saffron/40 bg-saffron-soft/50">Add: {b.title} · {formatINR(b.price)}</Link>)}
                  </div>
                  <p className="mt-3 text-sm font-semibold">Cost to try: {formatINR(e.cost)}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return <div><p className="eyebrow">{k}</p><p className="mt-1 font-display text-xl">{v}</p></div>;
}

function Hero() {
  const store = useStore();
  return (
    <section className="relative overflow-hidden border-b border-bone-line">
      <div className="container-x grid items-center gap-10 py-12 md:grid-cols-[1.15fr_1fr] md:py-20">
        <div>
          <p className="eyebrow">AI men&apos;s fit &amp; shopping intelligence · India</p>
          <h1 className="h-display mt-4 text-[3.4rem] sm:text-7xl lg:text-[5.6rem]">Find clothes that fit <em className="text-saffron">you.</em></h1>
          <p className="mt-5 max-w-lg text-lg text-ink-soft">AI-powered men&apos;s fashion intelligence for Indian shoppers. Tell us your body, style, occasion and budget — FITIQ checks fit, builds the complete look and compares Indian stores.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={store.profile ? "/stylist" : "/onboarding"} className="btn-primary px-6 py-3.5 text-base">{store.profile ? "Build an outfit" : "Build my style profile"}</Link>
            <Link href="/deals" className="btn-ghost px-6 py-3.5 text-base">Explore deals</Link>
          </div>
          <ul className="mt-8 grid max-w-lg grid-cols-2 gap-x-6 gap-y-2 text-sm text-ink-soft">
            {["Will it fit my body?", "Will the outfit look balanced?", "Can I build it within budget?", "Where is it cheapest right now?"].map((q) => (
              <li key={q} className="flex items-start gap-2"><Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-saffron" />{q}</li>
            ))}
          </ul>
        </div>
        <div className="relative">
          <div className="grid h-[380px] grid-cols-3 grid-rows-3 gap-2 sm:h-[460px] [&>div]:overflow-hidden [&>div]:rounded-2xl [&>div]:bg-[#EFE9DF]">
            <div className="col-span-2 row-span-2 !rounded-3xl"><GarmentArt category="overshirt" color="beige" pattern="texture" className="h-full" /></div>
            <div><GarmentArt category="shirt" color="light-blue" className="h-full" /></div>
            <div><GarmentArt category="chinos" color="navy" className="h-full" /></div>
            <div><GarmentArt category="sneakers" color="white" className="h-full" /></div>
            <div><GarmentArt category="kurta" color="cream" pattern="texture" className="h-full" /></div>
            <div><GarmentArt category="watch" color="brown" className="h-full" /></div>
          </div>
          <div className="card absolute -bottom-6 left-4 w-60 bg-white p-4 shadow-xl shadow-ink/10 sm:-left-8">
            <p className="eyebrow">Fit compatibility</p>
            <p className="font-display text-4xl font-semibold">92<span className="text-lg text-ink-mute">/100</span></p>
            <dl className="mt-2 space-y-1 text-xs">
              {[["Body", 94], ["Silhouette", 91], ["Size confidence", 90], ["Style", 95]].map(([k, v]) => (
                <div key={k} className="flex justify-between"><dt className="text-ink-mute">{k}</dt><dd className="font-semibold">{v}</dd></div>
              ))}
            </dl>
            <p className="mt-2 text-[10px] text-ink-mute">Example · a shopping score, not a measurement</p>
          </div>
        </div>
      </div>
    </section>
  );
}
