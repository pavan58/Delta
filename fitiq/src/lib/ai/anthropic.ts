import Anthropic from "@anthropic-ai/sdk";
import { parseQuery } from "../engines/nlp";
import { ALL_CATEGORIES, ALL_COLORS, ALL_FITS, ALL_OCCASIONS, ALL_STYLES } from "../taxonomy";
import type { AIProvider, GarmentDetection } from "./types";

const MODEL = process.env.AI_MODEL || "claude-opus-5";

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["category", "colorFamily", "pattern", "styles", "fit", "seasons", "occasions", "material", "confidence"],
  properties: {
    category: { type: ["string", "null"], enum: [...ALL_CATEGORIES, null] },
    colorFamily: { type: ["string", "null"], enum: [...ALL_COLORS, null] },
    pattern: { type: "string", enum: ["solid", "stripe", "check", "print", "texture", "embroidered"] },
    styles: { type: "array", items: { type: "string", enum: ALL_STYLES } },
    fit: { type: ["string", "null"], enum: [...ALL_FITS, null] },
    seasons: { type: "array", items: { type: "string", enum: ["summer", "monsoon", "winter", "all"] } },
    occasions: { type: "array", items: { type: "string", enum: ALL_OCCASIONS } },
    material: { type: ["string", "null"] },
    confidence: { type: "number" },
  },
};

const PROMPT = `You label a single menswear garment photo for a wardrobe app.
Return only attributes that are visually inferable. Use null for anything you cannot see (for example material when the fabric is unclear).
Do not describe or infer anything about the person wearing it (no body, age, ethnicity, religion or other personal attributes).
confidence is your overall confidence from 0 to 1.`;

export function anthropicProvider(): AIProvider {
  const client = new Anthropic({ apiKey: process.env.AI_API_KEY });
  return {
    id: "anthropic",
    // Query parsing stays rule-based: it is deterministic, instant and free.
    async parseQuery(text) {
      return parseQuery(text);
    },
    async describeGarment(imageBase64, mediaType, hint): Promise<GarmentDetection> {
      const response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 1024,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType as "image/jpeg", data: imageBase64 } },
              { type: "text", text: PROMPT },
            ],
          },
        ],
      });
      if (response.stop_reason === "refusal") throw new Error("The AI provider declined to label this image");
      const text = response.content.find((b) => b.type === "text");
      if (!text || text.type !== "text") throw new Error("No label returned");
      const j = JSON.parse(text.text) as Record<string, unknown>;
      return {
        category: (j.category as GarmentDetection["category"]) ?? undefined,
        colorFamily: (j.colorFamily as GarmentDetection["colorFamily"]) ?? hint?.dominantColor,
        pattern: (j.pattern as GarmentDetection["pattern"]) ?? "solid",
        styles: (j.styles as GarmentDetection["styles"]) ?? [],
        fit: (j.fit as GarmentDetection["fit"]) ?? undefined,
        seasons: (j.seasons as GarmentDetection["seasons"])?.length ? (j.seasons as GarmentDetection["seasons"]) : ["all"],
        occasions: (j.occasions as GarmentDetection["occasions"]) ?? [],
        material: (j.material as string) ?? undefined,
        confidence: Math.max(0, Math.min(1, Number(j.confidence) || 0.5)),
        method: "Labelled by AI vision. Please confirm before saving.",
      };
    },
  };
}
