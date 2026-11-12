/**
 * Provider-independent AI adapter (SERVER ONLY). Keys never reach the browser.
 * Providers:
 *  - anthropic          : official @anthropic-ai/sdk
 *  - openai-compatible  : any /v1/chat/completions endpoint (OpenAI, Groq, OpenRouter, Ollama, ...)
 *  - gemini             : Google Generative Language REST API
 */
import "server-only";
import Anthropic from "@anthropic-ai/sdk";

export type ProviderId = "anthropic" | "openai" | "groq" | "openrouter" | "ollama" | "openai-compatible" | "gemini";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AiRequest {
  system: string;
  messages: ChatMessage[];
  maxTokens: number;
}

export interface AiResult {
  text: string;
  provider: ProviderId;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface ProviderConfig {
  provider: ProviderId;
  apiKey: string;
  model: string;
  baseUrl?: string;
}

/** Fixed base URLs for user-supplied keys (prevents SSRF via arbitrary URLs). */
const KNOWN_BASES: Partial<Record<ProviderId, string>> = {
  openai: "https://api.openai.com/v1",
  groq: "https://api.groq.com/openai/v1",
  openrouter: "https://openrouter.ai/api/v1",
};

const DEFAULT_MODELS: Record<ProviderId, string> = {
  // Small, low-cost models by default (cost-control requirement). Override with env vars.
  anthropic: "claude-haiku-5-5",
  openai: "gpt-4o-mini",
  groq: "llama-3.1-8b-instant",
  openrouter: "meta-llama/llama-3.1-8b-instruct",
  ollama: "llama3.1",
  "openai-compatible": "gpt-4o-mini",
  gemini: "gemini-1.5-flash",
};

export function serverProvider(): ProviderConfig | null {
  const p = (process.env.AI_PROVIDER ?? "").toLowerCase() as ProviderId | "" | "none";
  if (!p || p === "none") return null;
  if (p === "anthropic" && process.env.ANTHROPIC_API_KEY)
    return { provider: p, apiKey: process.env.ANTHROPIC_API_KEY, model: process.env.ANTHROPIC_MODEL || DEFAULT_MODELS.anthropic };
  if (p === "gemini" && process.env.GEMINI_API_KEY)
    return { provider: p, apiKey: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL || DEFAULT_MODELS.gemini };
  if (p === "ollama")
    return { provider: p, apiKey: "ollama", model: process.env.OLLAMA_MODEL || DEFAULT_MODELS.ollama, baseUrl: (process.env.OLLAMA_BASE_URL || "http://localhost:11434") + "/v1" };
  if ((p === "openai" || p === "groq" || p === "openrouter" || p === "openai-compatible") && process.env.OPENAI_API_KEY)
    return {
      provider: p,
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || DEFAULT_MODELS[p],
      baseUrl: process.env.OPENAI_BASE_URL || KNOWN_BASES[p] || KNOWN_BASES.openai,
    };
  return null;
}

/** Builds a config from a key the learner supplied for this request only (never stored server-side). */
export function userProvider(provider: string, apiKey: string, model?: string): ProviderConfig | null {
  const allowed: ProviderId[] = ["anthropic", "openai", "groq", "openrouter", "gemini"];
  if (!allowed.includes(provider as ProviderId) || !apiKey || apiKey.length > 300) return null;
  const p = provider as ProviderId;
  const safeModel = model && /^[\w.\-/:]{2,80}$/.test(model) ? model : DEFAULT_MODELS[p];
  return { provider: p, apiKey, model: safeModel, baseUrl: KNOWN_BASES[p] };
}

export class AiError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}

async function callAnthropic(cfg: ProviderConfig, req: AiRequest): Promise<AiResult> {
  const client = new Anthropic({ apiKey: cfg.apiKey, maxRetries: 1, timeout: 30_000 });
  try {
    const res = await client.messages.create({
      model: cfg.model,
      max_tokens: req.maxTokens,
      system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }],
      messages: req.messages,
      output_config: { effort: "low" },
    });
    if (res.stop_reason === "refusal") throw new AiError("The AI declined this request. Showing free-mode feedback instead.", 422);
    const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
    return { text, provider: "anthropic", model: cfg.model, inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens };
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (e instanceof Anthropic.AuthenticationError) throw new AiError("The Anthropic API key was rejected.", 401);
    if (e instanceof Anthropic.RateLimitError) throw new AiError("The AI provider is rate-limiting requests. Try again shortly.", 429);
    if (e instanceof Anthropic.APIError) throw new AiError(`Anthropic API error (${e.status}).`, 502);
    throw new AiError("Could not reach the AI provider.", 502);
  }
}

async function callOpenAICompatible(cfg: ProviderConfig, req: AiRequest): Promise<AiResult> {
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({ model: cfg.model, max_tokens: req.maxTokens, messages: [{ role: "system", content: req.system }, ...req.messages] }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new AiError(res.status === 401 ? "The AI API key was rejected." : `AI provider error (${res.status}).`, res.status === 401 ? 401 : 502);
  const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } };
  return { text: j.choices?.[0]?.message?.content?.trim() ?? "", provider: cfg.provider, model: cfg.model, inputTokens: j.usage?.prompt_tokens ?? 0, outputTokens: j.usage?.completion_tokens ?? 0 };
}

async function callGemini(cfg: ProviderConfig, req: AiRequest): Promise<AiResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": cfg.apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: req.system }] },
      contents: req.messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
      generationConfig: { maxOutputTokens: req.maxTokens },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new AiError(res.status === 400 || res.status === 403 ? "The Gemini API key was rejected." : `Gemini error (${res.status}).`, 502);
  const j = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } };
  return {
    text: j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim() ?? "",
    provider: "gemini", model: cfg.model, inputTokens: j.usageMetadata?.promptTokenCount ?? 0, outputTokens: j.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

export async function complete(cfg: ProviderConfig, req: AiRequest): Promise<AiResult> {
  if (cfg.provider === "anthropic") return callAnthropic(cfg, req);
  if (cfg.provider === "gemini") return callGemini(cfg, req);
  return callOpenAICompatible(cfg, req);
}

/** Rough cost estimate (USD per 1M tokens) for the admin usage view. Unknown models count as 0. */
export const PRICE_PER_MTOK: Record<string, [number, number]> = {
  "claude-haiku-5-5": [0.1, 0.5],
  "claude-sonnet-5-5": [2, 10],
  "claude-opus-5-5": [4, 20],
  "gpt-4o-mini": [0.15, 0.6],
  "gemini-1.5-flash": [0.075, 0.3],
};

export function estimateCost(model: string, inTok: number, outTok: number) {
  const p = PRICE_PER_MTOK[model];
  return p ? (inTok * p[0] + outTok * p[1]) / 1_000_000 : 0;
}
