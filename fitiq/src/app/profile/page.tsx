"use client";
import Link from "next/link";
import { useState } from "react";
import { useStore } from "@/lib/client/store";
import { usePost } from "@/lib/client/api";
import type { Category, Product } from "@/lib/types";
import type { Scorecard } from "@/lib/engines/scorecard";
import { BUILD_LABEL, CATEGORY_LABEL, COLOR_HEX, COLOR_LABEL, FIT_LABEL, RETAILER_NAME, STYLE_LABEL, cmToFeetIn, formatINR } from "@/lib/taxonomy";
import { EmptyState, ErrorState, SectionHead, SkeletonBlock } from "@/components/States";
import { ScoreBar, Pill } from "@/components/Scores";
import { ProductCard, Rail } from "@/components/ProductCard";
import { Icon } from "@/components/Icon";

const SIZE_CATS: Category[] = ["shirt", "tshirt", "jeans", "trousers", "sneakers", "kurta"];

export default function ProfilePage() {
  const store = useStore();
  const p = store.profile;
  const sc = usePost<Scorecard & { saved: Product[] }>("/api/scorecard", { context: store.context(), saved: store.saved }, store.ready && !!p);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [entry, setEntry] = useState({ brand: "", category: "shirt" as Category, size: "", retailer: "" });

  if (!store.ready) return <div className="container-x py-10"><SkeletonBlock className="h-64" /></div>;
  if (!p) return <div className="container-x py-16"><EmptyState title="No profile yet" body="Your Style DNA powers fit scores, fit risk and outfits." cta={{ href: "/onboarding", label: "Build my style profile" }} /></div>;

  return (
    <div className="container-x py-8 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Profile</p>
          <h1 className="h-display mt-2 text-4xl sm:text-6xl">My Style DNA</h1>
        </div>
        <Link href="/onboarding" className="btn-ghost">Edit profile</Link>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <div className="card p-5">
          <p className="eyebrow">Body</p>
          <dl className="mt-3 space-y-1.5 text-sm">
            <Row k="Height" v={`${cmToFeetIn(p.body.heightCm)} (${p.body.heightCm} cm)`} />
            <Row k="Weight" v={`${p.body.weightKg} kg`} />
            <Row k="Chest" v={`${p.body.chestIn}"`} />
            <Row k="Waist" v={`${p.body.waistIn}"`} />
            {p.body.shoulderIn && <Row k="Shoulder" v={`${p.body.shoulderIn}"`} />}
            {p.body.inseamIn && <Row k="Inseam" v={`${p.body.inseamIn}"`} />}
            {p.body.shoeUK && <Row k="Shoe" v={`UK ${p.body.shoeUK}`} />}
            <Row k="Build" v={BUILD_LABEL[p.body.build]} />
          </dl>
        </div>
        <div className="card p-5">
          <p className="eyebrow">Style &amp; fit</p>
          <div className="mt-3 flex flex-wrap gap-1.5">{p.style.styles.map((s) => <Pill key={s} tone="dark">{STYLE_LABEL[s]}</Pill>)}</div>
          <dl className="mt-3 space-y-1.5 text-sm">
            <Row k="Tops" v={FIT_LABEL[p.fit.tops]} />
            <Row k="Bottoms" v={FIT_LABEL[p.fit.bottoms]} />
          </dl>
          <div className="mt-3 flex flex-wrap gap-1">{p.style.colors.map((c) => <span key={c} className="flex items-center gap-1 text-xs"><span className="h-3.5 w-3.5 rounded-full border border-black/10" style={{ background: COLOR_HEX[c] }} />{COLOR_LABEL[c]}</span>)}</div>
          {p.style.brands.length > 0 && <p className="mt-2 text-xs text-ink-soft">Brands: {p.style.brands.join(", ")}</p>}
        </div>
        <div className="card p-5">
          <p className="eyebrow">Budget</p>
          <p className="mt-3 font-display text-3xl">{formatINR(p.budget.perOutfit)}<span className="text-sm text-ink-mute"> / outfit</span></p>
          {p.budget.monthly && <p className="text-sm text-ink-soft">{formatINR(p.budget.monthly)} / month</p>}
          {p.city && <p className="mt-3 text-sm text-ink-soft">City: {p.city}</p>}
          <p className="mt-3 text-xs text-ink-mute">Photo processing consent: {p.photoConsent ? "given" : "not given"}</p>
        </div>
      </section>

      <section className="mt-14">
        <SectionHead eyebrow="Private metrics" title="Men's Style Scorecard">
          <p className="mt-1 text-sm text-ink-soft">Product metrics about your wardrobe and shopping — not judgements about your appearance.</p>
        </SectionHead>
        {sc.loading ? <SkeletonBlock className="h-40" /> : sc.error ? <ErrorState message={sc.error} onRetry={sc.reload} /> : sc.data && (
          <div className="card grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-5">
            {sc.data.metrics.map((m) => <ScoreBar key={m.key} label={m.label} value={m.value} hint={m.value === null ? "Not enough data yet" : m.hint} />)}
          </div>
        )}
      </section>

      <section className="mt-14">
        <SectionHead eyebrow="Personal size graph" title="My Size Map">
          <p className="mt-1 text-sm text-ink-soft">Sizes don&apos;t transfer perfectly across brands. FITIQ learns these from your fit feedback, and brand size charts still take priority.</p>
        </SectionHead>
        <div className="card overflow-hidden">
          {store.sizeMap.length === 0 ? <p className="p-5 text-sm text-ink-soft">No sizes yet. Mark a purchase as &ldquo;Perfect&rdquo; in fit feedback, or add one below.</p> : (
            <ul className="divide-y divide-bone-line">
              {store.sizeMap.map((s) => (
                <li key={s.brand + s.category} className="flex items-center justify-between p-3.5 text-sm">
                  <span><b>{s.brand}</b>{s.retailer ? <span className="text-ink-mute"> · {RETAILER_NAME[s.retailer] ?? s.retailer}</span> : null}</span>
                  <span className="flex items-center gap-3">{CATEGORY_LABEL[s.category]}: <b className="font-display text-lg">{s.size}</b> <Pill>{s.source === "feedback" ? "From feedback" : "Manual"}</Pill>
                    <button onClick={() => store.removeSize(s.brand, s.category)} aria-label={`Remove ${s.brand} ${s.category}`}><Icon name="trash" className="h-4 w-4 text-ink-mute" /></button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <form className="grid gap-2 border-t border-bone-line bg-bone/50 p-3.5 sm:grid-cols-[1fr_1fr_100px_auto]" onSubmit={(e) => { e.preventDefault(); if (!entry.brand || !entry.size) return; store.upsertSize({ brand: entry.brand.trim(), category: entry.category, size: entry.size.trim(), retailer: entry.retailer || undefined, source: "manual", confidence: 0.7, updatedAt: new Date().toISOString() }); setEntry({ ...entry, brand: "", size: "" }); }}>
            <input className="input" placeholder="Brand, e.g. Levi's" value={entry.brand} onChange={(e) => setEntry({ ...entry, brand: e.target.value })} aria-label="Brand" maxLength={40} />
            <select className="input" value={entry.category} onChange={(e) => setEntry({ ...entry, category: e.target.value as Category })} aria-label="Category">{SIZE_CATS.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}</select>
            <input className="input" placeholder="Size" value={entry.size} onChange={(e) => setEntry({ ...entry, size: e.target.value })} aria-label="Size" maxLength={6} />
            <button className="btn-primary btn-sm">Add</button>
          </form>
        </div>
      </section>

      <section className="mt-14">
        <SectionHead eyebrow="Fit feedback loop" title="How past purchases fit" />
        {store.feedback.length === 0 ? <p className="text-sm text-ink-soft">After you buy something, tap &ldquo;I bought this&rdquo; on its product page. Every answer improves future size picks.</p> : (
          <ul className="card divide-y divide-bone-line">
            {store.feedback.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 p-3.5 text-sm">
                <Link href={`/product/${encodeURIComponent(f.productId)}`} className="hover:underline"><b>{f.brand}</b> {CATEGORY_LABEL[f.category]} · size {f.size}</Link>
                <span className="flex items-center gap-2"><Pill tone={f.outcome === "perfect" ? "moss" : "accent"}>{f.outcome.replace("-", " ")}</Pill><span className="text-xs text-ink-mute">Buy again: {f.buyAgain ? "yes" : "no"}</span></span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {sc.data && sc.data.saved.length > 0 && (
        <section className="mt-14">
          <SectionHead eyebrow="Saved" title="Saved products" />
          <Rail>{sc.data.saved.map((s) => <ProductCard key={s.id} product={s} />)}</Rail>
        </section>
      )}

      <section className="mt-14">
        <SectionHead eyebrow="Privacy" title="Your data, your call" />
        <div className="card p-5 text-sm text-ink-soft">
          <p>In demo mode, everything on this page — measurements, wardrobe photos, feedback and your size map — lives only in this browser. It is sent to FITIQ&apos;s servers per request to calculate scores and is not stored there. <Link href="/privacy" className="underline">Read the privacy policy</Link>.</p>
          {!confirmDelete ? (
            <button className="btn-ghost mt-4 border-risk-high/40 text-risk-high" onClick={() => setConfirmDelete(true)}><Icon name="trash" className="h-4 w-4" /> Delete all my data</button>
          ) : (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="font-semibold text-ink">This permanently removes your profile, wardrobe, feedback and size map from this device.</span>
              <button className="btn btn-sm bg-risk-high text-white" onClick={() => { store.deleteAll(); setConfirmDelete(false); }}>Yes, delete everything</button>
              <button className="btn-ghost btn-sm" onClick={() => setConfirmDelete(false)}>Cancel</button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-2"><dt className="text-ink-mute">{k}</dt><dd className="font-medium">{v}</dd></div>;
}
