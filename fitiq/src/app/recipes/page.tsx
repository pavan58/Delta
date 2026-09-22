import Link from "next/link";
import { RECIPES } from "@/lib/engines/recipes";
import { CATEGORY_LABEL, OCCASION_LABEL, STYLE_LABEL } from "@/lib/taxonomy";
import { GarmentArt } from "@/components/ProductImage";
import type { ColorFamily } from "@/lib/types";

export const metadata = { title: "Outfit recipes" };

const TONES: ColorFamily[] = ["light-blue", "navy", "white", "olive", "brown"];

export default function RecipesPage() {
  return (
    <div className="container-x py-8 sm:py-12">
      <p className="eyebrow">Outfit recipe system</p>
      <h1 className="h-display mt-2 text-4xl sm:text-6xl">Reusable formulas.<br className="hidden sm:block" /> Swap any ingredient.</h1>
      <p className="mt-3 max-w-2xl text-ink-soft">Each recipe is a proven outfit structure. Change one ingredient and FITIQ finds the best compatible products across connected Indian retailers — keeping your fit, budget and colour harmony.</p>
      <div className="mt-10 space-y-6">
        {RECIPES.map((r) => (
          <article key={r.id} id={r.id} className="card scroll-mt-24 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-3xl">{r.name} recipe</h2>
                <p className="mt-1 max-w-xl text-sm text-ink-soft">{r.description}</p>
                <p className="mt-2 text-xs text-ink-mute">Styles: {r.styles.map((s) => STYLE_LABEL[s]).join(", ")} · Occasions: {r.occasions.map((o) => OCCASION_LABEL[o]).join(", ")}</p>
              </div>
              <Link href={`/stylist?recipe=${r.id}&occasion=${r.occasions[0]}&style=${r.styles[0]}`} className="btn-primary btn-sm">Build this recipe</Link>
            </div>
            <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {r.slots.map((s, i) => (
                <li key={s.key} className="rounded-2xl bg-bone p-3">
                  <div className="aspect-square overflow-hidden rounded-xl"><GarmentArt category={s.categories[0]} color={TONES[i % TONES.length]} className="h-full w-full" /></div>
                  <p className="eyebrow mt-2">{s.label}{s.optional ? " · optional" : ""}</p>
                  <p className="text-sm font-medium">{s.hint}</p>
                  <Link href={`/discover?cat=${s.categories.join(",")}&style=${r.styles[0]}&sort=fit`} className="mt-2 inline-block text-xs font-semibold text-saffron-deep hover:underline">Change {CATEGORY_LABEL[s.categories[0]].toLowerCase()} →</Link>
                </li>
              ))}
            </ol>
          </article>
        ))}
      </div>
    </div>
  );
}
