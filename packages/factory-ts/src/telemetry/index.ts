export type UsageStats = {
  requests: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUSD?: number;
};

export type Pricing = {
  inputPer1K: number; // USD per 1K input tokens
  outputPer1K: number; // USD per 1K output tokens
};

// Very small built-in pricing table; callers may override or extend externally.
const PRICING_TABLE: Record<string, Pricing> = {
  // keys are provider:model (lowercased)
  'openai:gpt-4o-mini': { inputPer1K: 0.0005, outputPer1K: 0.0015 },
  'openai:gpt-4o': { inputPer1K: 0.005, outputPer1K: 0.015 },
  'anthropic:claude-3-5-sonnet': { inputPer1K: 0.003, outputPer1K: 0.015 },
};

export function estimateCostUSD(provider: string | undefined, model: string | undefined, promptTokens: number, completionTokens: number, override?: Pricing): number | undefined {
  const key = `${(provider ?? '').toLowerCase()}:${(model ?? '').toLowerCase()}`;
  const p = override ?? PRICING_TABLE[key];
  if (!p) return undefined;
  const cost = (promptTokens / 1000) * p.inputPer1K + (completionTokens / 1000) * p.outputPer1K;
  return Number(cost.toFixed(6));
}

export function addUsage(a: UsageStats, b: Partial<UsageStats>, provider?: string, model?: string): UsageStats {
  const promptTokens = (a.promptTokens ?? 0) + (b.promptTokens ?? 0);
  const completionTokens = (a.completionTokens ?? 0) + (b.completionTokens ?? 0);
  const totalTokens = promptTokens + completionTokens;
  const requests = (a.requests ?? 0) + (b.requests ?? 0);
  const costUSD = estimateCostUSD(provider, model, promptTokens, completionTokens) ?? a.costUSD;
  return { requests, promptTokens, completionTokens, totalTokens, costUSD };
}
