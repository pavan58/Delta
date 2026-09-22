"use client";
import Link from "next/link";
import type { FitAnalysis, Product } from "@/lib/types";
import { RETAILER_NAME, formatINR } from "@/lib/taxonomy";
import { ProductImage } from "./ProductImage";
import { Price, Freshness } from "./Price";
import { RiskBadge, Pill } from "./Scores";
import { Icon } from "./Icon";
import { useStore } from "@/lib/client/store";

export function ProductCard({ product, fit, deal, offers, lowestPrice, note }: { product: Product; fit?: FitAnalysis; deal?: number; offers?: number; lowestPrice?: number; note?: string }) {
  const { saved, toggleSaved } = useStore();
  const isSaved = saved.includes(product.id);
  return (
    <article className="group relative flex flex-col">
      <Link href={`/product/${encodeURIComponent(product.id)}`} className="relative block overflow-hidden rounded-2xl bg-bone-deep">
        <ProductImage product={product} className="aspect-[4/5] w-full transition-transform duration-500 group-hover:scale-[1.03]" />
        <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
          {fit && fit.applicable && <RiskBadge risk={fit.risk} compact />}
          {product.source.sponsored && <Pill tone="dark">Sponsored</Pill>}
          {!product.availability && <Pill>Unavailable</Pill>}
        </div>
        {fit && (
          <div className="absolute bottom-2 right-2 rounded-full bg-white/95 px-2 py-1 text-[11px] font-bold shadow-sm" title="Fit compatibility (shopping score)">
            Fit {fit.overall}
          </div>
        )}
      </Link>
      <button
        onClick={() => toggleSaved(product.id)}
        className={`absolute right-2 top-2 rounded-full bg-white/90 p-1.5 ${isSaved ? "text-saffron" : "text-ink-mute"}`}
        aria-label={isSaved ? "Remove from saved" : "Save"}
        aria-pressed={isSaved}
      >
        <Icon name="heart" className="h-4 w-4" />
      </button>
      <div className="mt-2.5 flex flex-1 flex-col gap-0.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-mute">{product.brand}</p>
        <Link href={`/product/${encodeURIComponent(product.id)}`} className="line-clamp-2 text-sm leading-snug hover:underline">{product.title.replace(product.brand + " ", "")}</Link>
        <Price product={product} size="sm" />
        <p className="text-[11px] text-ink-mute">
          {offers && offers > 1 ? <>From {formatINR(lowestPrice ?? product.price)} · {offers} stores</> : <>{RETAILER_NAME[product.retailer] ?? product.retailer}</>}
          {deal !== undefined && <> · Deal {deal}</>}
        </p>
        {note && <p className="text-[11px] text-ink-soft">{note}</p>}
        <Freshness product={product} />
      </div>
    </article>
  );
}

export function ProductGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-x-4 md:grid-cols-3 lg:grid-cols-4">{children}</div>;
}

export function Rail({ children }: { children: React.ReactNode }) {
  return <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 [&>*]:w-[44%] [&>*]:shrink-0 [&>*]:snap-start sm:[&>*]:w-[30%] lg:[&>*]:w-[23%]">{children}</div>;
}
