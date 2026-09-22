"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { useStore, DEMO_WARDROBE } from "@/lib/client/store";
import { post, usePost } from "@/lib/client/api";
import { downscale } from "@/lib/client/image";
import type { Category, ColorFamily, FitType, Occasion, Pattern, StyleTag, WardrobeItem } from "@/lib/types";
import type { GapSuggestion } from "@/lib/engines/wardrobe";
import type { Experiment } from "@/lib/engines/experiments";
import type { GarmentDetection } from "@/lib/ai/types";
import { ALL_CATEGORIES, ALL_COLORS, ALL_FITS, ALL_OCCASIONS, ALL_STYLES, CATEGORY_LABEL, COLOR_HEX, COLOR_LABEL, FIT_LABEL, OCCASION_LABEL, PATTERN_LABEL, STYLE_LABEL, formatINR } from "@/lib/taxonomy";
import { GarmentArt } from "@/components/ProductImage";
import { EmptyState, ErrorState, SectionHead, SkeletonBlock } from "@/components/States";
import { Pill } from "@/components/Scores";
import { Icon } from "@/components/Icon";

interface Analysis {
  counts: { label: string; count: number }[];
  gaps: { currentOutfits: number; suggestions: GapSuggestion[]; redundancies: string[]; missingSlots: string[] };
  owned: { score: number; ids: string[] }[];
  experiments: Experiment[];
}

const PATTERNS: Pattern[] = ["solid", "stripe", "check", "print", "texture", "embroidered"];

export default function WardrobePage() {
  const store = useStore();
  const [adding, setAdding] = useState(false);
  const { data, error, loading, reload } = usePost<Analysis>("/api/wardrobe/analyze", { context: store.context() }, store.ready && store.wardrobe.length > 0);
  const byId = (id: string) => store.wardrobe.find((w) => w.id === id);

  return (
    <div className="container-x py-8 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">My digital wardrobe</p>
          <h1 className="h-display mt-2 text-4xl sm:text-6xl">Buy less. Style more.</h1>
          <p className="mt-2 max-w-xl text-ink-soft">FITIQ looks at what you already own before suggesting anything new — and tells you when you don&apos;t need to buy.</p>
        </div>
        <button className="btn-primary" onClick={() => setAdding(true)}><Icon name="camera" className="h-4 w-4" /> Add clothing</button>
      </div>

      {adding && <AddItem onClose={() => setAdding(false)} />}

      {store.ready && store.wardrobe.length === 0 && !adding && (
        <div className="mt-10">
          <EmptyState title="Nothing here yet" body="Add photos of your clothes (optional) or log them manually. Even 5 items unlock outfit counts and gap analysis." cta={{ onClick: () => store.addWardrobe(DEMO_WARDROBE.map((w) => ({ ...w, id: `${w.id}-${Date.now()}` }))), label: "Load a sample wardrobe" }} />
        </div>
      )}

      {store.wardrobe.length > 0 && (
        <>
          <section className="mt-10">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {(data?.counts ?? []).map((c) => (
                <div key={c.label} className="card p-3 text-center"><p className="font-display text-3xl">{c.count}</p><p className="text-xs text-ink-mute">{c.label}{c.count > 1 ? "s" : ""}</p></div>
              ))}
              {data && <div className="card bg-ink p-3 text-center text-bone"><p className="font-display text-3xl">{data.gaps.currentOutfits}</p><p className="text-xs opacity-70">Working outfits</p></div>}
            </div>
            <ul className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-7">
              {store.wardrobe.map((w) => (
                <li key={w.id} className="group relative">
                  <div className="aspect-[4/5] overflow-hidden rounded-xl bg-bone-deep">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {w.image ? <img src={w.image} alt={w.label} className="h-full w-full object-cover" /> : <GarmentArt category={w.category} color={w.colorFamily} pattern={w.pattern} className="h-full w-full" />}
                  </div>
                  <p className="mt-1 truncate text-xs">{w.label}</p>
                  <button onClick={() => store.removeWardrobe(w.id)} className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-ink-mute opacity-100 hover:text-risk-high sm:opacity-0 sm:group-hover:opacity-100" aria-label={`Remove ${w.label}`}><Icon name="trash" className="h-3.5 w-3.5" /></button>
                </li>
              ))}
            </ul>
          </section>

          {error && <div className="mt-8"><ErrorState message={error} onRetry={reload} /></div>}

          <section className="mt-16 grid gap-8 lg:grid-cols-[1fr_1.3fr]">
            <div>
              <SectionHead eyebrow="Wardrobe gap analysis" title="What you already have" />
              <p className="text-sm text-ink-soft">You currently own:</p>
              <ul className="mt-2 space-y-1 text-sm">{store.wardrobe.slice(0, 12).map((w) => <li key={w.id} className="flex items-center gap-2"><span className="h-3 w-3 rounded-full border border-black/10" style={{ background: COLOR_HEX[w.colorFamily] }} />{w.label}</li>)}</ul>
              {loading ? <SkeletonBlock className="mt-4 h-20" /> : data && (
                <div className="mt-5 space-y-2">
                  {data.gaps.redundancies.map((r) => <p key={r} className="rounded-xl bg-bone-deep p-3 text-sm">{r}</p>)}
                  {data.gaps.missingSlots.length > 0 && <p className="rounded-xl bg-saffron-soft p-3 text-sm">You&apos;re missing {data.gaps.missingSlots.join(" and ")} — add them to unlock complete outfits.</p>}
                </div>
              )}
            </div>
            <div>
              <SectionHead eyebrow="Highest-impact purchases" title="Your biggest wardrobe gaps" />
              {loading || !data ? <SkeletonBlock className="h-64" /> : data.gaps.suggestions.length === 0 ? <p className="text-sm text-ink-soft">No single purchase adds many new outfits right now. Your wardrobe is well covered — or add more items for better analysis.</p> : (
                <ol className="space-y-3">
                  {data.gaps.suggestions.map((g, i) => (
                    <li key={g.id} className={`card flex gap-4 p-4 ${i === 0 ? "border-ink" : ""}`}>
                      <div className="h-24 w-20 shrink-0 overflow-hidden rounded-xl"><GarmentArt category={g.category} color={g.color} className="h-full w-full" /></div>
                      <div className="min-w-0 flex-1">
                        {i === 0 && <Pill tone="accent">Biggest gap</Pill>}
                        <p className="mt-1 font-display text-xl">{g.label}{g.priceRange && <span className="ml-2 font-sans text-sm text-ink-mute">{formatINR(g.priceRange[0])}–{formatINR(g.priceRange[1])}</span>}</p>
                        <p className="text-sm">Adding this could create approximately <b>{g.newOutfits}</b> new outfit combination{g.newOutfits > 1 ? "s" : ""}.{g.priceRange && <> From ~{formatINR(Math.round(g.priceRange[0] / g.newOutfits))} per new outfit.</>}</p>
                        <p className="text-xs text-ink-mute">{g.reason}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {g.products.slice(0, 3).map((p) => <Link key={p.id} href={`/product/${encodeURIComponent(p.id)}`} className="chip hover:border-ink">{p.brand} · {formatINR(p.price)}</Link>)}
                          <Link href={`/discover?q=${encodeURIComponent(g.query)}`} className="chip hover:border-ink">Compare all →</Link>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>

          <section className="mt-16">
            <SectionHead eyebrow="Use what you own" title="Outfits you can wear today — ₹0" />
            {loading || !data ? <SkeletonBlock className="h-32" /> : data.owned.length === 0 ? <p className="text-sm text-ink-soft">Add at least one top, one bottom and one pair of shoes that work together.</p> : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.owned.map((o) => (
                  <div key={o.ids.join()} className="card p-3">
                    <div className="flex gap-2">{o.ids.map((id) => { const w = byId(id); return w ? <div key={id} className="h-20 flex-1 overflow-hidden rounded-lg bg-bone-deep">{/* eslint-disable-next-line @next/next/no-img-element */}{w.image ? <img src={w.image} alt={w.label} className="h-full w-full object-cover" /> : <GarmentArt category={w.category} color={w.colorFamily} pattern={w.pattern} className="h-full w-full" />}</div> : null; })}</div>
                    <p className="mt-2 text-xs text-ink-soft">{o.ids.map((id) => byId(id)?.label).join(" + ")}</p>
                    <p className="text-[11px] text-ink-mute">Colour harmony {o.score}/100</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="mt-16" id="experiments">
            <SectionHead eyebrow="Style experiment mode" title="Try a new style, change one or two pieces" />
            {!store.profile ? <p className="text-sm text-ink-soft"><Link className="underline" href="/onboarding">Build your profile</Link> to get experiments matched to your fit.</p> : loading || !data ? <SkeletonBlock className="h-40" /> : (
              <div className="grid gap-4 md:grid-cols-3">
                {data.experiments.map((e) => (
                  <div key={e.style} className="card flex flex-col p-5">
                    <Pill tone={e.risk === "LOW-RISK" ? "moss" : "neutral"}>{e.risk === "LOW-RISK" ? "Low-risk experiment" : "Starter experiment"}</Pill>
                    <p className="mt-2 font-display text-2xl">{e.title}</p>
                    <p className="mt-1 text-sm text-ink-soft">{e.note}</p>
                    <ul className="mt-3 flex-1 space-y-1 text-sm">
                      {e.owned.map((w) => <li key={w.id} className="flex items-center gap-2"><Icon name="check" className="h-4 w-4 text-risk-low" /> {w.label} <span className="text-xs text-ink-mute">(owned)</span></li>)}
                      {e.toBuy.map((p) => <li key={p.id} className="flex items-center gap-2"><Icon name="tag" className="h-4 w-4 text-saffron" /><Link href={`/product/${encodeURIComponent(p.id)}`} className="truncate underline">{p.title}</Link> {formatINR(p.price)}</li>)}
                    </ul>
                    <p className="mt-3 text-sm font-semibold">Cost to try: {formatINR(e.cost)}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function AddItem({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [consentAsked, setConsentAsked] = useState(false);
  const [image, setImage] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [method, setMethod] = useState<string | null>(null);
  const [f, setF] = useState<{ category: Category; colorFamily: ColorFamily; pattern: Pattern; fit?: FitType; styles: StyleTag[]; occasions: Occasion[]; label: string; detectedBy: WardrobeItem["detectedBy"] }>({ category: "shirt", colorFamily: "white", pattern: "solid", styles: [], occasions: [], label: "", detectedBy: "user" });

  function pickPhoto() {
    if (!store.profile?.photoConsent && !consentAsked) {
      setConsentAsked(true);
      return;
    }
    fileRef.current?.click();
  }

  function grantConsent() {
    if (store.profile) store.setProfile({ ...store.profile, photoConsent: true, updatedAt: new Date().toISOString() });
    setConsentAsked(false);
    setTimeout(() => fileRef.current?.click(), 50);
  }

  async function onFile(file?: File) {
    if (!file) return;
    setErr(null);
    setBusy(true);
    try {
      const img = await downscale(file, 320);
      setImage(img.dataUrl);
      setF((x) => ({ ...x, colorFamily: img.dominant, detectedBy: "rules" }));
      const det = await post<GarmentDetection>("/api/wardrobe/detect", { image: img.base64, mediaType: "image/jpeg", dominantColor: img.dominant, consent: true });
      setMethod(det.method);
      setF((x) => ({
        ...x,
        category: det.category ?? x.category,
        colorFamily: det.colorFamily ?? x.colorFamily,
        pattern: det.pattern ?? x.pattern,
        fit: det.fit ?? x.fit,
        styles: det.styles.length ? det.styles : x.styles,
        occasions: det.occasions.length ? det.occasions : x.occasions,
        detectedBy: det.category ? "ai" : "rules",
      }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't process that photo");
    } finally {
      setBusy(false);
    }
  }

  function save() {
    const label = f.label.trim() || `${COLOR_LABEL[f.colorFamily]} ${CATEGORY_LABEL[f.category].toLowerCase()}`;
    store.addWardrobe([{ id: crypto.randomUUID(), ...f, label, image, seasons: ["all"], addedAt: new Date().toISOString() }]);
    onClose();
  }

  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  return (
    <div className="card mt-8 p-5">
      <div className="flex items-center justify-between"><p className="font-display text-2xl">Add a piece</p><button onClick={onClose} aria-label="Close"><Icon name="x" /></button></div>
      {consentAsked && (
        <div className="mt-4 rounded-2xl border border-ink bg-white p-4 text-sm" role="dialog" aria-label="Photo consent">
          <p className="font-semibold">Before you upload a photo</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-soft">
            <li>The photo is shrunk on your device and a small thumbnail is stored in this browser only.</li>
            <li>It&apos;s sent once to identify the garment (category, colour, pattern). It is not stored on our servers and never sold.</li>
            <li>We don&apos;t analyse people in photos — photograph the garment on its own where possible.</li>
          </ul>
          <div className="mt-3 flex gap-2"><button className="btn-primary btn-sm" onClick={grantConsent}>I agree, choose photo</button><button className="btn-ghost btn-sm" onClick={() => setConsentAsked(false)}>No thanks</button></div>
          {!store.profile && <p className="mt-2 text-[11px] text-ink-mute">Your consent applies to this session; build a profile to remember it.</p>}
        </div>
      )}
      <div className="mt-4 grid gap-6 md:grid-cols-[180px_1fr]">
        <div>
          <button className="flex aspect-[4/5] w-full items-center justify-center overflow-hidden rounded-2xl border border-dashed border-ink/30 bg-bone-deep text-sm text-ink-mute" onClick={pickPhoto} disabled={busy}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {image ? <img src={image} alt="Uploaded garment" className="h-full w-full object-cover" /> : busy ? "Reading…" : <span className="flex flex-col items-center gap-1"><Icon name="camera" /> Photo (optional)</span>}
          </button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          {method && <p className="mt-2 text-[11px] text-ink-mute">{method}</p>}
          {err && <p className="mt-2 text-xs text-risk-high">{err}</p>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="w-cat">Category</label><select id="w-cat" className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as Category })}>{ALL_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}</select></div>
          <div><label className="label" htmlFor="w-label">Name (optional)</label><input id="w-label" className="input" value={f.label} placeholder={`${COLOR_LABEL[f.colorFamily]} ${CATEGORY_LABEL[f.category].toLowerCase()}`} onChange={(e) => setF({ ...f, label: e.target.value })} maxLength={80} /></div>
          <div className="sm:col-span-2"><p className="label">Colour</p><div className="flex flex-wrap gap-1.5">{ALL_COLORS.map((c) => <button key={c} title={COLOR_LABEL[c]} aria-label={COLOR_LABEL[c]} onClick={() => setF({ ...f, colorFamily: c })} className={`h-7 w-7 rounded-full border-2 ${f.colorFamily === c ? "border-ink" : "border-white shadow-[0_0_0_1px_#DDD4C4]"}`} style={{ background: COLOR_HEX[c] }} />)}</div></div>
          <div><label className="label" htmlFor="w-pat">Pattern</label><select id="w-pat" className="input" value={f.pattern} onChange={(e) => setF({ ...f, pattern: e.target.value as Pattern })}>{PATTERNS.map((p) => <option key={p} value={p}>{PATTERN_LABEL[p]}</option>)}</select></div>
          <div><label className="label" htmlFor="w-fit">Approximate fit</label><select id="w-fit" className="input" value={f.fit ?? ""} onChange={(e) => setF({ ...f, fit: (e.target.value || undefined) as FitType })}><option value="">Not sure</option>{ALL_FITS.map((x) => <option key={x} value={x}>{FIT_LABEL[x]}</option>)}</select></div>
          <div className="sm:col-span-2"><p className="label">Style</p><div className="flex flex-wrap gap-1.5">{ALL_STYLES.map((s) => <button key={s} className={`chip ${f.styles.includes(s) ? "chip-on" : ""}`} onClick={() => setF({ ...f, styles: toggle(f.styles, s) })}>{STYLE_LABEL[s]}</button>)}</div></div>
          <div className="sm:col-span-2"><p className="label">Occasions</p><div className="flex flex-wrap gap-1.5">{ALL_OCCASIONS.slice(0, 10).map((o) => <button key={o} className={`chip ${f.occasions.includes(o) ? "chip-on" : ""}`} onClick={() => setF({ ...f, occasions: toggle(f.occasions, o) })}>{OCCASION_LABEL[o]}</button>)}</div></div>
          <div className="sm:col-span-2 flex justify-end gap-2"><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save} disabled={busy}>Add to wardrobe</button></div>
        </div>
      </div>
    </div>
  );
}
