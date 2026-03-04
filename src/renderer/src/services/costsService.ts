import type { LLMCostAggregateContent } from 'thefactory-tools'

export type CostsService = {
  getCost: (chatKey: string) => Promise<LLMCostAggregateContent | undefined>
}

// IPC-backed service exposed from preload.
export const costsService: CostsService = { ...window.costsService }
