import { formatINR } from "@/lib/taxonomy";
import { freshness } from "@/lib/engines/price";
import type { Product } from "@/lib/types";
import { Icon } from "./Icon";

export function Price({ product, size = "md" }: { product: Product; size?: "sm" | "md" | "lg" }) {
  const cls = size === "lg" ? "text-3xl" : size === "sm" ? "text-base" : "text-lg";
  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <span className={`font-display font-semibold ${cls}`}>{formatINR(product.price)}</span>
      {product.mrp && product.mrp > product.price && <span className="text-xs text-ink-mute line-through">{formatINR(product.mrp)}</span>}
      {product.discountPercent ? <span className="text-xs font-semibold text-saffron-deep">{product.discountPercent}% off MRP</span> : null}
    </div>
  );
}

export function Freshness({ product, className = "" }: { product: Product; className?: string }) {
  const f = freshness(product);
  return (
    <p className={`flex items-center gap-1 text-[11px] ${f.stale ? "text-risk-med" : "text-ink-mute"} ${className}`}>
      {f.stale ? <Icon name="alert" className="h-3.5 w-3.5" /> : null}
      {f.label}
      {f.stale ? " · Price may have changed." : ""}
      {product.source.kind === "demo" ? " · Demo" : f.realtime ? " · Real-time feed" : ""}
    </p>
  );
}
