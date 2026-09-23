import type { Category, ColorFamily, FitType, Occasion, ParsedQuery, Pattern, Season, StyleTag } from "../types";

export interface GarmentDetection {
  category?: Category;
  colorFamily?: ColorFamily;
  pattern?: Pattern;
  styles: StyleTag[];
  fit?: FitType;
  seasons: Season[];
  occasions: Occasion[];
  material?: string;
  confidence: number; // 0..1
  /** Honest note about how the detection was made. */
  method: string;
}

/**
 * Provider-agnostic AI interface. Every method has a rule-based fallback, so
 * FITIQ remains functional without any model provider.
 */
export interface AIProvider {
  id: string;
  parseQuery(text: string): Promise<ParsedQuery>;
  /** Identify garment attributes from an image (base64, no data: prefix). */
  describeGarment(imageBase64: string, mediaType: string, hint?: { dominantColor?: ColorFamily }): Promise<GarmentDetection>;
}
