import type { LLMConfig } from 'thefactory-tools'

export type LLMConfigsState = {
  configs: LLMConfig[]
  activeAgentRunConfigId: string
  recentAgentRunConfigIds: string[]
  activeChatConfigId: string
  recentChatConfigIds: string[]
}

export type LLMConfigContext = 'chat' | 'agentRun'

export type LLMConfigsService = {
  subscribe: (callback: () => void) => () => void

  list: () => Promise<LLMConfigsState>
  add: (input: Omit<LLMConfig, 'id'>) => Promise<LLMConfig>
  update: (id: string, patch: Partial<LLMConfig>) => Promise<LLMConfig | undefined>
  remove: (id: string) => Promise<void>

  getActiveAgentRunId: () => Promise<string>
  setActiveAgentRunId: (id: string) => Promise<void>
  getRecentAgentRunIds: () => Promise<string[]>

  getActiveChatId: () => Promise<string>
  setActiveChatId: (id: string) => Promise<void>
  getRecentChatIds: () => Promise<string[]>

  bumpRecent: (context: LLMConfigContext, id: string, limit?: number) => Promise<void>
}

export const llmConfigsService: LLMConfigsService = { ...window.llmConfigsService }
