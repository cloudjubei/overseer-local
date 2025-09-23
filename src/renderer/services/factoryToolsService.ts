import { PricingState } from './pricingService'
import { AgentRun, AgentRunHistory, AgentRunRatingPatch, AgentRunUpdate } from 'thefactory-tools'

export type FactoryToolsService = {
  listTools: () => Promise<ToolDefinition[]>
}

export const factoryToolsService: FactoryToolsService = { ...window.factoryToolsService }
