export interface TokenPricing {
  inputPer1K: number // USD per 1k input tokens
  outputPer1K: number // USD per 1k output tokens
}

export interface PricingTable {
  [model: string]: TokenPricing
}

// Pricing snapshot (approx, 2024-2025). Adjust as providers update.
// Values in USD per 1k tokens.
export const OPENAI_PRICING: PricingTable = {
  // GPT-4o family
  'gpt-4o': { inputPer1K: 0.005, outputPer1K: 0.015 },
  'gpt-4o-mini': { inputPer1K: 0.00015, outputPer1K: 0.0006 },
  // GPT-4.1 (approx historical, may vary)
  'gpt-4.1': { inputPer1K: 0.01, outputPer1K: 0.03 },
  // GPT-3.5 Turbo (historical)
  'gpt-3.5-turbo': { inputPer1K: 0.0005, outputPer1K: 0.0015 }
}

export function resolveOpenAIPricing(model: string): TokenPricing | undefined {
  if (OPENAI_PRICING[model]) return OPENAI_PRICING[model]
  // attempt loose matching by prefix
  const key = Object.keys(OPENAI_PRICING).find(k => model.startsWith(k))
  if (key) return OPENAI_PRICING[key]
  return undefined
}

export function tokensToUsd(tokens: number, per1k: number): number {
  return (tokens / 1000) * per1k
}

export function roundUsd(n: number): number {
  return Math.round(n * 1e6) / 1e6 // 6 decimals
}
