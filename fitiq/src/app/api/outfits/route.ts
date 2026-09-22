import { z } from "zod";
import { getCatalog } from "@/lib/server/catalog";
import { track } from "@/lib/server/analytics";
import { handle, HttpError, personal, publicRecipe, readBody } from "@/lib/server/route-utils";
import { WeatherSchema } from "@/lib/server/validation";
import { generateOutfits } from "@/lib/engines/outfit";
import { parseQuery } from "@/lib/engines/nlp";
import { ALL_OCCASIONS, ALL_STYLES } from "@/lib/taxonomy";
import type { Occasion, OutfitRequest, StyleTag } from "@/lib/types";

const Body = z.object({
  text: z.string().max(300).optional(),
  request: z
    .object({
      budget: z.number().min(300).max(500000).optional(),
      occasion: z.enum(ALL_OCCASIONS as [Occasion, ...Occasion[]]).optional(),
      style: z.enum(ALL_STYLES as [StyleTag, ...StyleTag[]]).optional(),
      allowOverBudget: z.boolean().optional(),
      useWardrobe: z.boolean().optional(),
      recipeId: z.string().optional(),
      weather: WeatherSchema.optional(),
    })
    .default({}),
  context: z.unknown().optional(),
});

export const POST = handle(async (req) => {
  const body = await readBody(req, Body);
  const ctx = personal(body.context);
  if (!ctx.profile) throw new HttpError(422, "Build your style profile first — outfits are fitted to your body and preferences.");
  const parsed = body.text ? parseQuery(body.text) : undefined;
  const r = body.request;
  const request: OutfitRequest = {
    budget: r.budget ?? parsed?.budget ?? ctx.profile.budget.perOutfit,
    occasion: r.occasion ?? parsed?.occasion ?? "casual",
    style: r.style ?? parsed?.style,
    allowOverBudget: r.allowOverBudget ?? false,
    useWardrobe: r.useWardrobe ?? false,
    recipeId: r.recipeId,
    weather: r.weather ?? (parsed?.weather ? { condition: parsed.weather, source: "user" } : undefined),
    context: parsed?.relationship,
  };
  // A build mentioned in the query overrides the stored build for this request only.
  const profile = parsed?.build ? { ...ctx.profile, body: { ...ctx.profile.body, build: parsed.build } } : ctx.profile;
  const res = generateOutfits(await getCatalog(), profile, request, ctx, ctx.wardrobe);
  track({ type: "outfit", occasion: request.occasion, budget: request.budget, count: res.outfits.length, at: new Date().toISOString() });
  return { ...res, recipe: publicRecipe(res.recipe), request, parsed };
});
