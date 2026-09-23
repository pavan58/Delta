import Link from "next/link";
import { getProduct } from "@/lib/server/catalog";
import { RETAILER_NAME, formatINR } from "@/lib/taxonomy";

export default async function DemoOutbound({ params }: { params: Promise<{ id: string }> }) {
  const p = await getProduct(decodeURIComponent((await params).id));
  return (
    <div className="container-x max-w-xl py-16 text-center">
      <p className="eyebrow">Demo listing</p>
      <h1 className="h-display mt-3 text-4xl">This is where you&apos;d go to {p ? RETAILER_NAME[p.retailer] : "the store"}.</h1>
      <p className="mt-4 text-ink-soft">
        {p ? <>The {formatINR(p.price)} price for “{p.title}” is <b>simulated demo data</b>, not a live offer.</> : "This product is simulated demo data."} Once a permitted retailer feed or affiliate API is connected, this button opens the real product page (with affiliate tracking where allowed).
      </p>
      <div className="mt-8 flex justify-center gap-3">
        {p && <a href={p.productUrl} className="btn-ghost" rel="nofollow noopener" target="_blank">Visit {RETAILER_NAME[p.retailer]} homepage</a>}
        <Link href={p ? `/product/${encodeURIComponent(p.id)}` : "/discover"} className="btn-primary">Back to FITIQ</Link>
      </div>
    </div>
  );
}
