import { z } from "zod";
import { getCatalog } from "@/lib/server/catalog";
import { handle, HttpError, personal, readBody } from "@/lib/server/route-utils";
import { swapOptions } from "@/lib/engines/outfit";
import type { Outfit, OutfitRequest } from "@/lib/types";

const Body = z.object({ outfit: z.any(), key: z.string(), request: z.any(), context: z.unknown().optional() });

export const POST = handle(async (req) => {
  const body = await readBody(req, Body);
  const ctx = personal(body.context);
  if (!ctx.profile) throw new HttpError(422, "Profile required");
  const outfit = body.outfit as Outfit;
  if (!outfit?.items?.length) throw new HttpError(400, "Outfit missing");
  const options = swapOptions(outfit, body.key, await getCatalog(), ctx.profile, body.request as OutfitRequest, ctx, ctx.wardrobe);
  return { options };
});
