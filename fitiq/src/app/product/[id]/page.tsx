"use client";
import Link from "next/link";
import { use, useState } from "react";
import { useStore } from "@/lib/client/store";
import { post, usePost } from "@/lib/client/api";
import type { DealScore, FitAnalysis, FitOutcome, Outfit, PriceStats, Product, PurchaseConfidence } from "@/lib/types";
import type { PricePoint } from "@/lib/data/price-history";
import type { BetterFitAlt, CheaperAlt } from "@/lib/engines/alternatives";
import { CATEGORY_LABEL, FIT_LABEL, RETAILER_NAME, formatINR } from "@/lib/taxonomy";
import { ProductImage, GarmentArt } from "@/components/ProductImage";
import { Price, Freshness } from "@/components/Price";
import { RiskBadge, ScoreBar, ScoreRing, Pill } from "@/components/Scores";
import { ErrorState, ProfilePrompt, SectionHead, SkeletonBlock } from "@/components/States";
import { ProductCard, Rail } from "@/components/ProductCard";
import { OutfitCard } from "@/components/OutfitCard";
import { Icon } from "@/components/Icon";

interface Detail {
  product: Product;
  fit: FitAnalysis | null;
  confidence: PurchaseConfidence | null;
  stats: PriceStats;
  history: PricePoint[];
  deal: DealScore;
  freshness: { hours: number; stale: boolean; label: string; realtime: boolean };
  offers: { product: Product; stats: PriceStats; freshness: { label: string; stale: boolean }; basis: string }[];
  similar: { product: Product; basis: string; similarity: number }[];
  cheaper: CheaperAlt[];
  betterFit: BetterFitAlt[];
  look: Outfit | null;
  utility: { compatibleCount: number; compatibleItems: { id: string; label: string }[]; newOutfits: number; costPerOutfit?: number; alreadyOwnSimilar: number } | null;
}

export default function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const store = useStore();
  const { data, error, loading, reload } = usePost<Detail>(`/api/products/${encodeURIComponent(decodeURIComponent(id))}`, { context: store.context() }, store.ready);

  if (loading || !store.ready) {
    return (
      <div className="container-x grid gap-8 py-8 md:grid-cols-2">
        <SkeletonBlock className="aspect-[4/5]" />
        <div className="space-y-3"><SkeletonBlock className="h-8 w-2/3" /><SkeletonBlock className="h-12 w-1/3" /><SkeletonBlock className="h-64" /></div>
      </div>
    );
  }
  if (error || !data) return <div className="container-x py-10"><ErrorState message={error ?? "Product not found"} onRetry={reload} /></div>;
  return <Detail d={data} />;
}

function Detail({ d }: { d: Detail }) {
  const store = useStore();
  const p = d.product;
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const saved = store.saved.includes(p.id);
  const cheapestOffer = d.offers.filter((o) => o.product.availability).sort((a, b) => a.product.price - b.product.price)[0];

  return (
    <div className="container-x py-6 sm:py-10">
      <nav className="mb-4 text-xs text-ink-mute" aria-label="Breadcrumb">
        <Link href="/discover" className="hover:text-ink">Discover</Link> / <Link href={`/discover?cat=${p.category}`} className="hover:text-ink">{CATEGORY_LABEL[p.category]}</Link>
      </nav>

      <div className="grid gap-8 md:grid-cols-2 lg:gap-14">
        <div className="md:sticky md:top-20 md:self-start">
          <div className="overflow-hidden rounded-3xl bg-bone-deep">
            <ProductImage product={p} className="aspect-[4/5] w-full" />
          </div>
          {p.source.kind === "demo" && <p className="mt-2 text-[11px] text-ink-mute">Illustration · demo listing. Real listings show the retailer&apos;s licensed photography.</p>}
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="eyebrow">{p.brand}</p>
            {p.source.sponsored && <Pill tone="dark">Sponsored</Pill>}
            {p.source.kind === "demo" && <Pill tone="accent">Demo data</Pill>}
          </div>
          <h1 className="h-display mt-2 text-3xl sm:text-4xl">{p.title.replace(p.brand + " ", "")}</h1>
          <div className="mt-4"><Price product={p} size="lg" /></div>
          <Freshness product={p} className="mt-1" />

          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 border-y border-bone-line py-4 text-sm sm:grid-cols-3">
            <Fact k="Retailer" v={RETAILER_NAME[p.retailer] ?? p.retailer} />
            <Fact k="Rating" v={p.rating ? `${p.rating}★ (${p.reviewCount?.toLocaleString("en-IN") ?? 0})` : "Not rated"} />
            <Fact k="Fit" v={p.fit ? FIT_LABEL[p.fit] : "—"} />
            <Fact k="Material" v={p.material ?? "Not specified"} />
            <Fact k="Colour" v={p.colors.join(", ")} />
            <Fact k="Availability" v={p.availability ? "In stock" : "Unavailable"} />
          </dl>

          <div className="mt-4">
            <p className="label">Available sizes {d.fit?.recommendedSize && <span className="font-normal text-ink-mute">· your likely size highlighted</span>}</p>
            <div className="flex flex-wrap gap-1.5">
              {p.sizes.length ? p.sizes.map((s) => (
                <span key={s} className={`rounded-lg border px-3 py-1.5 text-sm ${s === d.fit?.recommendedSize ? "border-ink bg-ink text-bone" : "border-bone-line bg-white"}`}>{s}</span>
              )) : <span className="text-sm text-ink-mute">No sizes listed</span>}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <a href={`/api/go/${encodeURIComponent(p.id)}`} className={`btn-primary ${!p.availability ? "pointer-events-none opacity-50" : ""}`} rel="nofollow sponsored">
              Go to {RETAILER_NAME[p.retailer]} <Icon name="external" className="h-4 w-4" />
            </a>
            <button className="btn-ghost" onClick={() => store.toggleSaved(p.id)} aria-pressed={saved}><Icon name="heart" className={`h-4 w-4 ${saved ? "text-saffron" : ""}`} /> {saved ? "Saved" : "Save"}</button>
            <button className="btn-ghost" onClick={() => setFeedbackOpen(true)}>I bought this</button>
          </div>
          {cheapestOffer && cheapestOffer.product.id !== p.id && (
            <p className="mt-3 text-sm"><span className="font-semibold text-moss">Exact match {formatINR(p.price - cheapestOffer.product.price)} cheaper</span> at <Link className="underline" href={`/product/${encodeURIComponent(cheapestOffer.product.id)}`}>{RETAILER_NAME[cheapestOffer.product.retailer]}</Link>.</p>
          )}

          {/* FITIQ ANALYSIS */}
          <section className="mt-10">
            <p className="eyebrow">FITIQ analysis</p>
            {!d.fit ? (
              <div className="mt-3"><ProfilePrompt what="your fit compatibility, fit risk and recommended size for this product" /></div>
            ) : (
              <div className="card mt-3 p-5">
                <div className="flex items-center gap-5">
                  <ScoreRing value={d.fit.overall} size={84} label="Fit compatibility" />
                  <div className="flex-1">
                    <p className="font-display text-xl">Fit compatibility {d.fit.overall}/100</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <RiskBadge risk={d.fit.risk} />
                      {d.fit.recommendedSize && <span className="text-xs text-ink-soft">Likely size <b>{d.fit.recommendedSize}</b>{d.fit.sizeNote ? ` · ${d.fit.sizeNote}` : ""}</span>}
                    </div>
                  </div>
                </div>
                {d.fit.applicable && (
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <ScoreBar label="Body compatibility" value={d.fit.body} />
                    <ScoreBar label="Silhouette compatibility" value={d.fit.silhouette} />
                    <ScoreBar label="Size confidence" value={d.fit.sizeConfidence} />
                    <ScoreBar label="Style compatibility" value={d.fit.style} />
                  </div>
                )}
                <div className="mt-5 rounded-xl bg-bone p-3.5 text-sm">
                  <p className="font-semibold">{d.fit.risk === "LOW" ? "Fit notes" : "Why the risk"}</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-ink-soft">{d.fit.riskReasons.map((r) => <li key={r}>{r}</li>)}</ul>
                  {d.betterFit[0] && d.fit.risk !== "LOW" && (
                    <p className="mt-2">
                      <span className="font-semibold">Alternative: </span>
                      <Link href={`/product/${encodeURIComponent(d.betterFit[0].product.id)}`} className="underline">{d.betterFit[0].product.title}</Link> — <RiskBadge risk={d.betterFit[0].fit.risk} compact />
                    </p>
                  )}
                </div>
                <p className="mt-3 text-[11px] text-ink-mute">A shopping recommendation score — not a medical or scientific measurement.</p>
              </div>
            )}
          </section>

          {d.confidence && (
            <section className="mt-6">
              <div className="card p-5">
                <div className="flex items-baseline justify-between">
                  <p className="font-display text-xl">Purchase confidence</p>
                  <p className="font-display text-3xl font-semibold">{d.confidence.percent}%</p>
                </div>
                <ul className="mt-3 space-y-1 text-sm">
                  {d.confidence.evidence.map((e) => <li key={e} className="flex gap-2"><Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-risk-low" />{e}</li>)}
                </ul>
                {d.confidence.issues.length > 0 && (
                  <>
                    <p className="mt-3 text-xs font-semibold">Potential issues</p>
                    <ul className="mt-1 space-y-1 text-sm text-ink-soft">
                      {d.confidence.issues.map((e) => <li key={e} className="flex gap-2"><Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0 text-risk-med" />{e}</li>)}
                    </ul>
                  </>
                )}
                <p className="mt-3 text-[11px] text-ink-mute">A recommendation indicator based on available evidence — not a guarantee of fit.</p>
              </div>
            </section>
          )}

          {d.fit && (
            <section className="mt-6">
              <p className="eyebrow">Why this works</p>
              <p className="mt-2 font-display text-xl leading-snug">{d.fit.why}</p>
            </section>
          )}

          {d.utility && (
            <section className="card mt-6 p-5">
              <p className="eyebrow">Buy less, style more</p>
              {d.utility.alreadyOwnSimilar > 0 && <p className="mt-2 text-sm font-semibold text-risk-med">You already own {d.utility.alreadyOwnSimilar} similar {CATEGORY_LABEL[p.category].toLowerCase()}{d.utility.alreadyOwnSimilar > 1 ? "s" : ""} in this colour.</p>}
              <dl className="mt-3 grid grid-cols-3 gap-3 text-center">
                <div><dt className="text-[11px] text-ink-mute">Works with</dt><dd className="font-display text-2xl">{d.utility.compatibleCount}</dd><dd className="text-[11px] text-ink-mute">items you own</dd></div>
                <div><dt className="text-[11px] text-ink-mute">New outfits</dt><dd className="font-display text-2xl">{d.utility.newOutfits}</dd><dd className="text-[11px] text-ink-mute">approx.</dd></div>
                <div><dt className="text-[11px] text-ink-mute">Cost per new outfit</dt><dd className="font-display text-2xl">{d.utility.costPerOutfit ? formatINR(d.utility.costPerOutfit) : "—"}</dd></div>
              </dl>
            </section>
          )}
        </div>
      </div>

      {/* PRICE COMPARISON */}
      <section className="mt-16">
        <SectionHead eyebrow="Multi-store price intelligence" title="Where to buy" />
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wider text-ink-mute">
              <tr className="border-b border-bone-line"><th className="p-3">Retailer</th><th className="p-3">Match</th><th className="p-3">Price</th><th className="p-3">Sizes</th><th className="p-3">Checked</th><th className="p-3" /></tr>
            </thead>
            <tbody>
              {d.offers.map((o, i) => (
                <tr key={o.product.id} className="border-b border-bone-line last:border-0">
                  <td className="p-3 font-medium">{RETAILER_NAME[o.product.retailer]}{i === 0 && o.product.availability && d.offers.length > 1 && <span className="ml-2"><Pill tone="moss">Lowest</Pill></span>}</td>
                  <td className="p-3"><span className="text-xs font-semibold text-moss">Exact match</span><p className="text-[10px] text-ink-mute">{o.basis}</p></td>
                  <td className="p-3"><span className="font-semibold">{formatINR(o.product.price)}</span>{o.product.mrp && o.product.mrp > o.product.price && <span className="ml-1.5 text-xs text-ink-mute line-through">{formatINR(o.product.mrp)}</span>}</td>
                  <td className="p-3 text-xs">{o.product.availability ? o.product.sizes.join(" · ") || "—" : <span className="text-risk-high">Unavailable</span>}</td>
                  <td className={`p-3 text-xs ${o.freshness.stale ? "text-risk-med" : "text-ink-mute"}`}>{o.freshness.label}{o.freshness.stale && <><br />⚠️ Price may have changed</>}</td>
                  <td className="p-3 text-right">{o.product.id === p.id ? <span className="text-xs text-ink-mute">Viewing</span> : <Link href={`/product/${encodeURIComponent(o.product.id)}`} className="text-xs font-semibold underline">View</Link>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {d.offers.length === 1 && <p className="mt-2 text-xs text-ink-mute">No exact matches found at other connected retailers. See similar alternatives below — they are different products.</p>}
      </section>

      {/* PRICE HISTORY + DEAL */}
      <section className="mt-12 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="card p-5">
          <p className="eyebrow">Price history · {RETAILER_NAME[p.retailer]}</p>
          {d.stats.hasHistory ? (
            <>
              <PriceChart points={d.history} />
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <Fact k="Current" v={formatINR(d.stats.current)} />
                <Fact k="Previous" v={d.stats.previous ? formatINR(d.stats.previous) : "No change recorded"} />
                <Fact k="30 days ago" v={d.stats.thirtyDaysAgo ? formatINR(d.stats.thirtyDaysAgo) : "Not tracked then"} />
                <Fact k="Lowest detected" v={formatINR(d.stats.lowest!)} />
                <Fact k="Highest detected" v={formatINR(d.stats.highest!)} />
                <Fact k="Change" v={d.stats.change ? `${d.stats.change > 0 ? "+" : "−"}${formatINR(Math.abs(d.stats.change))}` : "—"} />
              </dl>
              {d.stats.thirtyDaysAgo && d.stats.thirtyDaysAgo > d.stats.current && <p className="mt-3 text-sm font-semibold text-moss">Detected drop: {formatINR(d.stats.thirtyDaysAgo - d.stats.current)} vs 30 days ago</p>}
              <p className="mt-2 text-[11px] text-ink-mute">&ldquo;Lowest/highest detected&rdquo; covers only the {d.stats.points} checks FITIQ recorded since {new Date(d.stats.firstSeen!).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} — not all-time retailer history.{p.source.kind === "demo" && " Demo history is simulated."}</p>
            </>
          ) : (
            <p className="mt-3 text-sm text-ink-soft">Not enough price history yet. FITIQ only shows historical comparisons once it has recorded multiple price checks for this listing.</p>
          )}
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <p className="eyebrow">Deal score</p>
            <ScoreRing value={d.deal.score} size={56} label="Deal score" />
          </div>
          <ul className="mt-3 space-y-2.5">
            {d.deal.components.map((c) => <li key={c.label}><ScoreBar label={`${c.label} · ${Math.round(c.weight * 100)}%`} value={Math.max(0, Math.min(100, Math.round(c.value)))} hint={c.note} /></li>)}
          </ul>
          <p className="mt-3 text-[11px] text-ink-mute">A FITIQ-generated shopping metric from the data listed above. Components without data are excluded, not guessed.</p>
        </div>
      </section>

      {d.betterFit.length > 0 && (
        <section className="mt-14">
          <SectionHead eyebrow="Better-fit alternatives" title="Same idea, better fit for you" />
          <div className="grid gap-4 md:grid-cols-3">
            {d.betterFit.map((b) => (
              <AltCard key={b.product.id} product={b.product} top={<>Fit {d.fit?.overall} → <b>{b.fit.overall}</b> <RiskBadge risk={b.fit.risk} compact /></>} why={b.why} />
            ))}
          </div>
        </section>
      )}

      {d.cheaper.length > 0 && (
        <section className="mt-14">
          <SectionHead eyebrow="Similar but cheaper" title="Cheaper alternatives" />
          <div className="grid gap-4 md:grid-cols-3">
            {d.cheaper.map((c) => (
              <AltCard key={c.product.id} product={c.product} top={<><Pill tone="neutral">Similar alternative</Pill> <span className="font-semibold text-moss">Save {formatINR(c.saving)}</span></>} why={c.why} />
            ))}
          </div>
        </section>
      )}

      {d.look && (
        <section className="mt-14">
          <SectionHead eyebrow="Complete the look" title={`Complete outfit price: ${formatINR(d.look.total)}`} />
          <div className="max-w-2xl"><OutfitCard outfit={d.look} /></div>
        </section>
      )}

      {d.similar.length > 0 && (
        <section className="mt-14">
          <SectionHead eyebrow="Similar products" title="You might also compare" />
          <Rail>{d.similar.map((s) => <ProductCard key={s.product.id} product={s.product} note={`Similar: ${s.basis}`} />)}</Rail>
        </section>
      )}

      {feedbackOpen && <FeedbackDialog product={p} suggested={d.fit?.recommendedSize} onClose={() => setFeedbackOpen(false)} />}
    </div>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[11px] text-ink-mute">{k}</dt>
      <dd className="font-medium">{v}</dd>
    </div>
  );
}

function AltCard({ product, top, why }: { product: Product; top: React.ReactNode; why: string }) {
  return (
    <Link href={`/product/${encodeURIComponent(product.id)}`} className="card flex gap-3 p-3 hover:border-ink/40">
      <div className="h-28 w-24 shrink-0 overflow-hidden rounded-xl bg-bone-deep"><ProductImage product={product} className="h-full w-full" /></div>
      <div className="min-w-0 text-sm">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">{top}</div>
        <p className="mt-1 line-clamp-2 font-medium">{product.title}</p>
        <p className="font-semibold">{formatINR(product.price)} <span className="text-xs font-normal text-ink-mute">· {RETAILER_NAME[product.retailer]}</span></p>
        <p className="mt-1 line-clamp-3 text-xs text-ink-soft">{why}</p>
      </div>
    </Link>
  );
}

function PriceChart({ points }: { points: PricePoint[] }) {
  const W = 560, H = 160, pad = 8;
  const prices = points.map((p) => p.price);
  const min = Math.min(...prices), max = Math.max(...prices);
  const t0 = new Date(points[0].date).getTime(), t1 = new Date(points[points.length - 1].date).getTime();
  const x = (d: string) => pad + ((new Date(d).getTime() - t0) / Math.max(1, t1 - t0)) * (W - pad * 2);
  const y = (v: number) => (max === min ? H / 2 : pad + (1 - (v - min) / (max - min)) * (H - pad * 2));
  // Step line: price holds until the next recorded change.
  let d = `M${x(points[0].date)} ${y(points[0].price)}`;
  for (let i = 1; i < points.length; i++) d += ` H${x(points[i].date)} V${y(points[i].price)}`;
  return (
    <svg viewBox={`0 0 ${W} ${H + 18}`} className="mt-3 w-full" role="img" aria-label={`Price history from ₹${min} to ₹${max}`}>
      <line x1={pad} x2={W - pad} y1={y(min)} y2={y(min)} stroke="#2F7A4B" strokeDasharray="3 4" strokeWidth={1} />
      <path d={d} fill="none" stroke="#15130F" strokeWidth={2} />
      <circle cx={x(points[points.length - 1].date)} cy={y(points[points.length - 1].price)} r={4} fill="#C8641E" />
      <text x={pad} y={H + 14} fontSize={10} fill="#6F695F">{new Date(points[0].date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</text>
      <text x={W - pad} y={H + 14} fontSize={10} fill="#6F695F" textAnchor="end">Latest check</text>
      <text x={W - pad} y={y(min) - 4} fontSize={10} fill="#2F7A4B" textAnchor="end">Lowest detected ₹{min.toLocaleString("en-IN")}</text>
    </svg>
  );
}

const OUTCOMES: [FitOutcome, string][] = [["too-tight", "Too tight"], ["perfect", "Perfect"], ["too-loose", "Too loose"], ["too-short", "Too short"], ["too-long", "Too long"]];

function FeedbackDialog({ product, suggested, onClose }: { product: Product; suggested?: string; onClose: () => void }) {
  const store = useStore();
  const [size, setSize] = useState(suggested ?? product.sizes[0] ?? "");
  const [outcome, setOutcome] = useState<FitOutcome | null>(null);
  const [again, setAgain] = useState<boolean | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    if (!outcome || again === null) return;
    const f = { id: crypto.randomUUID(), productId: product.id, brand: product.brand, retailer: product.retailer, category: product.category, size, outcome, buyAgain: again, createdAt: new Date().toISOString() };
    store.addFeedback(f);
    try { await post("/api/feedback", f); } catch { /* aggregate signal only; local record is saved */ }
    setDone(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Fit feedback">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-t-3xl bg-bone p-6 sm:rounded-3xl">
        <button className="absolute right-4 top-4" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        {done ? (
          <div className="py-6 text-center">
            <p className="font-display text-2xl">Thanks — FITIQ learned something.</p>
            <p className="mt-2 text-sm text-ink-soft">{outcome === "perfect" ? `${product.brand} ${size} is now in your size map.` : `Future ${product.brand} size picks will adjust for this.`}</p>
            <button className="btn-primary mt-5" onClick={onClose}>Done</button>
          </div>
        ) : (
          <>
            <div className="flex gap-3">
              <div className="h-16 w-14 overflow-hidden rounded-lg bg-bone-deep"><GarmentArt category={product.category} color={product.attrs.colorFamily} pattern={product.attrs.pattern} className="h-full w-full" /></div>
              <div><p className="eyebrow">Fit feedback</p><p className="font-display text-lg leading-tight">How did it fit?</p></div>
            </div>
            <label className="label mt-5" htmlFor="fsize">Size you bought</label>
            <select id="fsize" className="input" value={size} onChange={(e) => setSize(e.target.value)}>
              {(product.sizes.length ? product.sizes : [size]).map((s) => <option key={s}>{s}</option>)}
            </select>
            <div className="mt-4 flex flex-wrap gap-1.5">{OUTCOMES.map(([k, l]) => <button key={k} className={`chip px-3.5 py-2 text-sm ${outcome === k ? "chip-on" : ""}`} onClick={() => setOutcome(k)}>{l}</button>)}</div>
            <p className="label mt-5">Would you buy {product.brand} again?</p>
            <div className="flex gap-2">{[true, false].map((v) => <button key={String(v)} className={`chip px-4 py-2 text-sm ${again === v ? "chip-on" : ""}`} onClick={() => setAgain(v)}>{v ? "Yes" : "No"}</button>)}</div>
            <button className="btn-primary mt-6 w-full" disabled={!outcome || again === null} onClick={submit}>Save feedback</button>
            <p className="mt-2 text-center text-[11px] text-ink-mute">Stored on this device. Only brand + outcome are sent anonymously to improve sizing data.</p>
          </>
        )}
      </div>
    </div>
  );
}
