import { AgentRunRatingPatch } from 'thefactory-tools/dist/agentRunStore'
import { PricingState } from './pricingService'
import {
  AgentRunHistory,
  AgentType,
  GithubCredentials,
  LLMConfig,
  WebSearchApiKeys,
} from 'thefactory-tools'

export type StartTaskRunParams = {
  agentType: AgentType
  projectId: string
  taskId: string
  llmConfig: LLMConfig
  githubCredentials: GithubCredentials
  webSearchApiKeys?: WebSearchApiKeys
}
export type StartFeatureRunParams = StartTaskRunParams & { featureId: string }

export type FactoryService = {
  subscribeRuns: (callback: (updated: AgentRunHistory) => void) => () => void
  startTaskRun: (params: StartTaskRunParams) => AgentRunHistory
  startFeatureRun: (params: StartFeatureRunParams) => AgentRunHistory
  cancelRun: (runId: string) => void
  listRunsActive: () => AgentRunHistory[]
  listRunHistory: () => AgentRunHistory[]
  deleteRunHistory: (runId: string) => AgentRunHistory | undefined
  rateRun: (runId: string, rating?: AgentRunRatingPatch) => AgentRunHistory | undefined

  listPrices: () => PricingState
  refreshPricing: (provider: string, url: string) => Promise<PricingState>
}

export const factoryService: FactoryService = { ...window.factoryService }
