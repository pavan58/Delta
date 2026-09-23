"use client";
import Link from "next/link";
import { useState } from "react";
import type { Outfit, OutfitItem, OutfitRequest } from "@/lib/types";
import { CATEGORY_LABEL, RETAILER_NAME, formatINR } from "@/lib/taxonomy";
import { post } from "@/lib/client/api";
import { useStore } from "@/lib/client/store";
import { GarmentArt, ProductImage } from "./ProductImage";
import { RiskBadge, Pill } from "./Scores";
import { Icon } from "./Icon";

const STRATEGY_TONE: Record<string, "neutral" | "accent" | "dark" | "moss"> = { saver: "moss", balanced: "neutral", premium: "dark", wardrobe: "accent", experiment: "accent" };

function ItemThumb({ item }: { item: OutfitItem }) {
  if (item.product) return <ProductImage product={item.product} className="h-full w-full" />;
  if (item.wardrobeItem) {
    const w = item.wardrobeItem;
    // eslint-disable-next-line @next/next/no-img-element
    return w.image ? <img src={w.image} alt={w.label} className="h-full w-full object-cover" /> : <GarmentArt category={w.category} color={w.colorFamily} pattern={w.pattern} className="h-full w-full" />;
  }
  return null;
}

export function OutfitCard({ outfit: initial, request, compact = false }: { outfit: Outfit; request?: OutfitRequest; compact?: boolean }) {
  const store = useStore();
  const [outfit, setOutfit] = useState(initial);
  const [swapKey, setSwapKey] = useState<string | null>(null);
  const [options, setOptions] = useState<Outfit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function openSwap(key: string) {
    if (!request) return;
    setSwapKey(key);
    setOptions(null);
    setErr(null);
    setBusy(true);
    try {
      const r = await post<{ options: Outfit[] }>("/api/outfits/swap", { outfit, key, request, context: store.context() });
      setOptions(r.options);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Swap failed");
    } finally {
      setBusy(false);
    }
  }

  const s = outfit.scores;
  return (
    <article className="card overflow-hidden">
      <header className="flex items-start justify-between gap-3 border-b border-bone-line p-4">
        <div>
          <div className="flex items-center gap-2">
            {outfit.strategy && <Pill tone={STRATEGY_TONE[outfit.strategy]}>{outfit.name}</Pill>}
          </div>
          <p className="mt-2 font-display text-3xl font-semibold">{formatINR(outfit.total)}</p>
          <p className="text-xs text-ink-mute">of {formatINR(outfit.budget)} budget{outfit.total <= outfit.budget ? ` · ${formatINR(outfit.budget - outfit.total)} left` : " · over budget (allowed)"}</p>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-right text-xs">
          <dt className="text-ink-mute">Fit</dt><dd className="font-semibold tabular-nums">{s.fit}/100</dd>
          <dt className="text-ink-mute">Style</dt><dd className="font-semibold tabular-nums">{s.style}/100</dd>
          <dt className="text-ink-mute">Budget</dt><dd className="font-semibold tabular-nums">{s.budget}/100</dd>
          <dt className="text-ink-mute">Colour</dt><dd className="font-semibold tabular-nums">{s.harmony}/100</dd>
        </dl>
      </header>

      <ul className="divide-y divide-bone-line">
        {outfit.items.map((item) => (
          <li key={item.key} className="flex gap-3 p-3 sm:p-4">
            <div className="h-20 w-16 shrink-0 overflow-hidden rounded-xl bg-bone-deep">
              <ItemThumb item={item} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="eyebrow">{item.label}</span>
                {item.fit?.applicable && <RiskBadge risk={item.fit.risk} compact />}
                {item.wardrobeItem && <Pill tone="accent">You own this</Pill>}
              </div>
              {item.product ? (
                <Link href={`/product/${encodeURIComponent(item.product.id)}`} className="mt-0.5 block truncate text-sm font-medium hover:underline">{item.product.title}</Link>
              ) : (
                <p className="mt-0.5 truncate text-sm font-medium">{item.wardrobeItem?.label}</p>
              )}
              <p className="text-xs text-ink-mute">
                {item.product ? <>{RETAILER_NAME[item.product.retailer]} · {item.fit?.recommendedSize ? `Size ${item.fit.recommendedSize}` : CATEGORY_LABEL[item.product.category]}</> : "From your wardrobe"}
              </p>
              {!compact && <p className="mt-1 text-xs leading-relaxed text-ink-soft"><span className="font-semibold text-ink">Why this? </span>{item.why}</p>}
            </div>
            <div className="flex shrink-0 flex-col items-end justify-between">
              <span className="text-sm font-semibold tabular-nums">{item.price ? formatINR(item.price) : "₹0"}</span>
              {request && (
                <button onClick={() => openSwap(item.key)} className="flex items-center gap-1 text-[11px] font-semibold text-saffron-deep hover:underline" aria-label={`Change ${item.label}`}>
                  <Icon name="swap" className="h-3.5 w-3.5" /> Change
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {swapKey && (
        <div className="border-t border-bone-line bg-bone/60 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold">Change {outfit.items.find((i) => i.key === swapKey)?.label.toLowerCase()} — keeping budget, fit, style &amp; colour harmony</p>
            <button onClick={() => setSwapKey(null)} aria-label="Close"><Icon name="x" className="h-4 w-4" /></button>
          </div>
          {busy && <div className="grid grid-cols-3 gap-2">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-28" />)}</div>}
          {err && <p className="text-sm text-risk-high">{err}</p>}
          {options && options.length === 0 && <p className="text-sm text-ink-soft">No alternatives fit the remaining budget of {formatINR(outfit.budget - (outfit.total - (outfit.items.find((i) => i.key === swapKey)?.price ?? 0)))}. Try raising the budget.</p>}
          {options && options.length > 0 && (
            <div className="no-scrollbar flex gap-2 overflow-x-auto">
              {options.map((o) => {
                const it = o.items.find((i) => i.key === swapKey)!;
                return (
                  <button key={o.id} onClick={() => { setOutfit(o); setSwapKey(null); }} className="card w-32 shrink-0 p-2 text-left hover:border-ink">
                    <div className="h-24 overflow-hidden rounded-lg bg-bone-deep"><ItemThumb item={it} /></div>
                    <p className="mt-1.5 line-clamp-2 text-[11px] leading-tight">{it.product?.title ?? it.wardrobeItem?.label}</p>
                    <p className="mt-1 text-xs font-semibold">{it.price ? formatINR(it.price) : "Owned"}</p>
                    <p className="text-[10px] text-ink-mute">Outfit {formatINR(o.total)} · {o.scores.overall}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!compact && (
        <footer className="border-t border-bone-line p-4 text-xs leading-relaxed text-ink-soft">
          <span className="font-semibold text-ink">Why this outfit? </span>{outfit.explanation}
        </footer>
      )}
    </article>
  );
}
