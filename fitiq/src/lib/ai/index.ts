import { anthropicProvider } from "./anthropic";
import { rulesProvider } from "./rules";
import type { AIProvider } from "./types";

let cached: AIProvider | null = null;

/** Select the AI provider from AI_PROVIDER. Add new providers here. */
export function getAI(): AIProvider {
  if (cached) return cached;
  const kind = process.env.AI_PROVIDER ?? "rules";
  if (kind === "anthropic" && process.env.AI_API_KEY) cached = anthropicProvider();
  else cached = rulesProvider;
  return cached;
}

export function aiStatus() {
  const p = getAI();
  return { provider: p.id, vision: p.id !== "rules" };
}
