export interface LLMUsage {
  promptTokens: number
  completionTokens: number
  totalTokens?: number
}

export interface ModelPricingProvider {
  // Returns cost per 1k tokens for input/output for a model, or undefined if unknown
  getPricing(model: string): { inputPer1K: number; outputPer1K: number } | undefined
}
