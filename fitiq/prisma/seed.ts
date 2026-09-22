// Seeds retailers and the DEMO catalogue into PostgreSQL (npm run db:seed).
// Demo rows keep sourceKind = "demo" so the UI continues to label them.
import { PrismaClient } from "@prisma/client";
import { DEMO_PRODUCTS } from "../src/lib/data/demo-catalog";
import { demoPriceHistory } from "../src/lib/data/price-history";
import { RETAILERS } from "../src/lib/taxonomy";

const db = new PrismaClient();

async function main() {
  for (const r of RETAILERS) await db.retailer.upsert({ where: { id: r.id }, update: r, create: r });
  for (const p of DEMO_PRODUCTS) {
    const data = {
      retailerId: p.retailer, providerId: p.source.providerId, sourceKind: p.source.kind, realtime: p.source.realtime, sponsored: !!p.source.sponsored,
      brand: p.brand, title: p.title, category: p.category, subcategory: p.subcategory, price: p.price, mrp: p.mrp, discountPercent: p.discountPercent,
      sizes: p.sizes, colors: p.colors, fit: p.fit, material: p.material, rating: p.rating, reviewCount: p.reviewCount, imageUrl: p.imageUrl,
      productUrl: p.productUrl, availability: p.availability, lastCheckedAt: new Date(p.lastCheckedAt), modelCode: p.attrs.modelCode, sku: p.attrs.sku, attrs: p.attrs as object,
    };
    await db.product.upsert({ where: { id: p.id }, update: data, create: { id: p.id, ...data } });
    await db.pricePoint.deleteMany({ where: { productId: p.id } });
    const pts = demoPriceHistory(p);
    if (pts.length) await db.pricePoint.createMany({ data: pts.map((h) => ({ productId: p.id, price: h.price, available: true, checkedAt: new Date(h.date) })) });
  }
  console.log(`Seeded ${RETAILERS.length} retailers and ${DEMO_PRODUCTS.length} demo products`);
}

main().finally(() => db.$disconnect());
