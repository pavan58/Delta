import { getProduct } from "@/lib/server/catalog";
import { garmentSvg } from "@/lib/art";
import { COLOR_HEX } from "@/lib/taxonomy";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const p = await getProduct(decodeURIComponent((await params).id));
  if (!p) return new Response("Not found", { status: 404 });
  return new Response(garmentSvg(p.category, COLOR_HEX[p.attrs.colorFamily], p.attrs.pattern), {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'" },
  });
}
