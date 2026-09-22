import { garmentSvg } from "@/lib/art";
import { COLOR_HEX } from "@/lib/taxonomy";
import type { Category, ColorFamily, Pattern, Product } from "@/lib/types";

export function GarmentArt({ category, color, pattern = "solid", className = "" }: { category: Category; color: ColorFamily; pattern?: Pattern; className?: string }) {
  // Generated, trusted SVG markup (no user input).
  return <div className={`[&>svg]:h-full [&>svg]:w-full ${className}`} dangerouslySetInnerHTML={{ __html: garmentSvg(category, COLOR_HEX[color], pattern) }} />;
}

export function ProductImage({ product, className = "" }: { product: Product; className?: string }) {
  if (product.source.kind === "demo") return <GarmentArt category={product.category} color={product.attrs.colorFamily} pattern={product.attrs.pattern} className={className} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={product.imageUrl} alt={product.title} loading="lazy" className={`object-cover ${className}`} />;
}
