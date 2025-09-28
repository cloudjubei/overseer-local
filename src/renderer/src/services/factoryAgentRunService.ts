import { PricingState } from './pricingService'
import { AgentRun, AgentRunHistory, AgentRunRatingPatch, AgentRunUpdate } from 'thefactory-tools'

export type FactoryAgentRunService = {
  subscribeRuns: (callback: (update: AgentRunUpdate) => Promise<void>) => () => void
  startRun: (params: AgentRun) => Promise<AgentRunHistory>
  cancelRun: (runId: string) => Promise<void>
  listRunsActive: () => Promise<string[]>
  listRunHistory: () => Promise<AgentRunHistory[]>
  getRunHistory: (runId: string) => Promise<AgentRunHistory | undefined>
  deleteRunHistory: (runId: string) => Promise<AgentRunHistory | undefined>
  rateRun: (runId: string, rating?: AgentRunRatingPatch) => Promise<AgentRunHistory | undefined>

  listPrices: () => Promise<PricingState>
  refreshPricing: (provider: string, url: string) => Promise<PricingState>
}

export const factoryAgentRunService: FactoryAgentRunService = { ...window.factoryAgentRunService }
