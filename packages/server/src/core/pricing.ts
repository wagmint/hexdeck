import type { TokenUsage } from "../types/index.js";

// ─── Model Pricing ──────────────────────────────────────────────────────────

export interface ModelPricing {
  input: number;
  output: number;
  cacheRead: number;
  cacheCreation: number;
}

/** Prefix-matching table — handles date-suffixed names like "claude-sonnet-4-20250514" */
const PRICING_TABLE: Array<[string, ModelPricing]> = [
  ["claude-opus-4",     { input: 15e-6, output: 75e-6, cacheRead: 1.5e-6,  cacheCreation: 18.75e-6 }],
  ["claude-sonnet-4",   { input: 3e-6,  output: 15e-6, cacheRead: 0.3e-6,  cacheCreation: 3.75e-6 }],
  ["claude-sonnet-3-5", { input: 3e-6,  output: 15e-6, cacheRead: 0.3e-6,  cacheCreation: 3.75e-6 }],
  ["claude-haiku-3-5",  { input: 0.8e-6, output: 4e-6, cacheRead: 0.08e-6, cacheCreation: 1e-6 }],
];

/** Default pricing for unknown models */
const DEFAULT_PRICING: ModelPricing = PRICING_TABLE[1][1]; // Sonnet 4 pricing

/** Shown in UI so users know rates are approximate */
export const PRICING_UPDATED = "2025-05";

export function getModelPricing(model: string | null): ModelPricing {
  if (!model) return DEFAULT_PRICING;
  const lower = model.toLowerCase();
  for (const [prefix, pricing] of PRICING_TABLE) {
    if (lower.startsWith(prefix)) return pricing;
  }
  return DEFAULT_PRICING;
}

export function computeTurnCost(model: string | null, usage: TokenUsage): number {
  const p = getModelPricing(model);
  return (
    usage.inputTokens * p.input +
    usage.outputTokens * p.output +
    usage.cacheReadInputTokens * p.cacheRead +
    usage.cacheCreationInputTokens * p.cacheCreation
  );
}

/** "claude-sonnet-4-20250514" → "Sonnet 4", "claude-opus-4-6" → "Opus 4" */
export function shortModelName(model: string): string {
  const lower = model.toLowerCase();
  if (lower.startsWith("claude-opus-4")) return "Opus 4";
  if (lower.startsWith("claude-sonnet-4")) return "Sonnet 4";
  if (lower.startsWith("claude-sonnet-3-5") || lower.startsWith("claude-sonnet-3.5")) return "Sonnet 3.5";
  if (lower.startsWith("claude-haiku-3-5") || lower.startsWith("claude-haiku-3.5")) return "Haiku 3.5";
  if (lower.startsWith("claude-haiku")) return "Haiku";
  if (lower.startsWith("claude-sonnet")) return "Sonnet";
  if (lower.startsWith("claude-opus")) return "Opus";
  return model;
}
