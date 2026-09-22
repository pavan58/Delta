import { z } from "zod";
import { getAI } from "@/lib/ai";
import { handle, readBody } from "@/lib/server/route-utils";
import { ALL_COLORS } from "@/lib/taxonomy";
import type { ColorFamily } from "@/lib/types";

// Images are processed transiently for labelling and never stored server-side
// in demo mode. Requires explicit consent flag from the client.
const Body = z.object({
  image: z.string().max(1_500_000),
  mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  dominantColor: z.enum(ALL_COLORS as [ColorFamily, ...ColorFamily[]]).optional(),
  consent: z.literal(true),
});

export const POST = handle(async (req) => {
  const b = await readBody(req, Body);
  const ai = getAI();
  try {
    return await ai.describeGarment(b.image.replace(/^data:[^,]+,/, ""), b.mediaType, { dominantColor: b.dominantColor });
  } catch (e) {
    return {
      colorFamily: b.dominantColor,
      styles: [],
      seasons: ["all"],
      occasions: [],
      confidence: 0,
      method: `AI labelling unavailable (${e instanceof Error ? e.message : "error"}). Colour estimated from pixels — please confirm the rest.`,
    };
  }
});
