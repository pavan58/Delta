import { NextResponse } from "next/server";
import { getProduct, outboundUrl } from "@/lib/server/catalog";
import { track } from "@/lib/server/analytics";

// Outbound click tracking + affiliate link wrapping (only where permitted).
// Demo listings never redirect as if they were real offers.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = decodeURIComponent((await params).id);
  const p = await getProduct(id);
  if (!p) return NextResponse.redirect(new URL("/discover", req.url));
  const demo = p.source.kind === "demo";
  track({ type: "click", productId: p.id, retailer: p.retailer, at: new Date().toISOString(), demo });
  if (demo) return NextResponse.redirect(new URL(`/go/${encodeURIComponent(id)}`, req.url));
  return NextResponse.redirect(outboundUrl(p), 302);
}
