import { parseQuery } from "../engines/nlp";
import type { AIProvider } from "./types";

/** Offline provider: regex query parsing + client-extracted colour only. */
export const rulesProvider: AIProvider = {
  id: "rules",
  async parseQuery(text) {
    return parseQuery(text);
  },
  async describeGarment(_img, _mt, hint) {
    return {
      colorFamily: hint?.dominantColor,
      styles: [],
      seasons: ["all"],
      occasions: [],
      confidence: hint?.dominantColor ? 0.4 : 0,
      method: "Colour estimated from image pixels. Category and other attributes need your confirmation (no AI vision provider configured).",
    };
  },
};
