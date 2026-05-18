import { createContext, useCallback, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'
import {
  abortChatCompletion,
  deleteChat,
  rateChat,
  startAgentRun,
  type ChatContext as ChatCtx,
  type GetChatResponse,
  type StartAgentRunData,
} from '../../generated/backend'
import { useChats } from './ChatsContext'
import { useGitCredentials } from './GitCredentialsContext'
import { useLLMConfigs } from './LLMConfigsContext'
import { useWebSearchKeys } from './WebSearchKeysContext'

export type AgentType = StartAgentRunData['body']['params']['agentType']

export const AGENT_TYPES: readonly AgentType[] = [
  'speccer',
  'planner',
  'contexter',
  'tester',
  'developer',
] as const

const DEFAULT_AGENT_SETTINGS: StartAgentRunData['body']['settings'] = {
  maxTurns: 50,
  numberMessagesToSend: 30,
  availableTools: [],
  autoCallTools: [],
  forceFinishTools: [],
  finishTurnOnErrors: true,
  allowNoCallResponses: true,
  allowErrorResponses: true,
}

/**
 * A chat whose context is an agent-run (`AGENT_RUN_STORY` or
 * `AGENT_RUN_FEATURE`). The discriminator is enforced by `isAgentRunChat`
 * at the boundary; the rest of the codebase trusts the type narrowing.
 */
export type RunChat = GetChatResponse

export type AgentsContextValue = {
  /** All AGENT_RUN_* chats for the active project. */
  runs: RunChat[]
  /** Subset that are currently running (state === 'created' | 'running'). */
  runsActive: RunChat[]
  /** Subset that have finished. */
  runsHistory: RunChat[]

  /**
   * Start an agent run for the given target. Resolves to the new agentRunId.
   * Throws if an LLM config or git credentials are missing.
   */
  startAgent: (params: {
    agentType: AgentType
    projectId: string
    storyId: string
    featureId?: string
  }) => Promise<{ agentRunId: string; chatContext: ChatCtx }>

  /** Active runs scoped to a project (defaults to the active one). */
  getProjectRunningCount: (projectId?: string) => number

  /**
   * Cancel an in-flight run by aborting its completion. The backend
   * resolves the in-flight call with `resultType: 'aborted'` and the run
   * chat's state moves to `cancelled`. No-op (silent) when nothing is in
   * flight server-side, since the user's intent is "stop now."
   */
  cancelRun: (run: RunChat) => Promise<void>
  /** Delete a run chat and its messages. */
  deleteRun: (run: RunChat) => Promise<void>
  /**
   * Rate a finished run. `score` is a small integer (e.g. `1` for thumbs up,
   * `-1` for thumbs down — backend doesn't constrain the value). Pass an
   * empty `comment` to clear an existing one.
   */
  rateRun: (run: RunChat, score: number, comment?: string) => Promise<void>
}

const AgentsContext = createContext<AgentsContextValue | null>(null)

const isAgentRunChat = (c: GetChatResponse): c is RunChat =>
  c.context.type === 'AGENT_RUN_STORY' || c.context.type === 'AGENT_RUN_FEATURE'

export function AgentsProvider({ children }: { children: ReactNode }) {
  const { chats, refresh: refreshChats } = useChats()
  const { configs: llmConfigs } = useLLMConfigs()
  const { credentials } = useGitCredentials()
  const { keys } = useWebSearchKeys()
  const webSearchKeys = keys

  const runs = useMemo<RunChat[]>(() => chats.filter(isAgentRunChat), [chats])

  const runsActive = useMemo<RunChat[]>(
    () => runs.filter((r) => r.state === 'created' || r.state === 'running'),
    [runs],
  )

  const runsHistory = useMemo<RunChat[]>(() => runs, [runs])

  const startAgent = useCallback<AgentsContextValue['startAgent']>(
    async ({ agentType, projectId, storyId, featureId }) => {
      const llmConfig = llmConfigs[0]
      if (!llmConfig) throw new Error('Configure an LLM before starting an agent run.')
      const cred = credentials[0]
      if (!cred) throw new Error('Add git credentials before starting an agent run.')

      const agentRunId = `${Date.now()}`
      const chatContext: ChatCtx = featureId
        ? { type: 'AGENT_RUN_FEATURE', projectId, storyId, featureId, agentRunId }
        : { type: 'AGENT_RUN_STORY', projectId, storyId, agentRunId }

      const params: StartAgentRunData['body']['params'] = {
        agentType,
        chatContext: chatContext as StartAgentRunData['body']['params']['chatContext'],
        llmConfig: {
          model: llmConfig.model,
          provider: llmConfig.provider,
          id: llmConfig.id,
          name: llmConfig.name,
          apiKey: llmConfig.apiKey,
          apiUrlOverride: llmConfig.apiUrlOverride,
          costInputPerMTokensUSD: llmConfig.costInputPerMTokensUSD,
          costOutputPerMTokensUSD: llmConfig.costOutputPerMTokensUSD,
          costCacheReadInputPerMTokensUSD: llmConfig.costCacheReadInputPerMTokensUSD,
        },
        githubCredentials: {
          name: cred.name,
          username: cred.username,
          email: cred.email,
          token: cred.token,
        },
        webSearchApiKeys: webSearchKeys.length
          ? Object.fromEntries(webSearchKeys.map((k) => [k.provider, k.apiKey]))
          : undefined,
      }

      await startAgentRun({
        body: { params, settings: DEFAULT_AGENT_SETTINGS, isolated: true },
        throwOnError: true,
      })

      return { agentRunId, chatContext }
    },
    [llmConfigs, credentials, webSearchKeys],
  )

  const getProjectRunningCount = useCallback(
    (projectId?: string) => {
      if (!projectId) return runsActive.length
      return runsActive.filter((r) => r.context.projectId === projectId).length
    },
    [runsActive],
  )

  const cancelRun = useCallback<AgentsContextValue['cancelRun']>(
    async (run) => {
      try {
        await abortChatCompletion({ body: { context: run.context }, throwOnError: true })
      } catch {
        // 404 → nothing in flight; safe to ignore. The chat list refresh
        // below will reflect the latest state regardless.
      }
      await refreshChats()
    },
    [refreshChats],
  )

  const deleteRun = useCallback<AgentsContextValue['deleteRun']>(
    async (run) => {
      await deleteChat({ body: { context: run.context }, throwOnError: true })
      await refreshChats()
    },
    [refreshChats],
  )

  const rateRun = useCallback<AgentsContextValue['rateRun']>(
    async (run, score, comment) => {
      await rateChat({
        body: { context: run.context, score, ...(comment ? { comment } : {}) },
        throwOnError: true,
      })
      await refreshChats()
    },
    [refreshChats],
  )

  const value = useMemo<AgentsContextValue>(
    () => ({
      runs,
      runsActive,
      runsHistory,
      startAgent,
      getProjectRunningCount,
      cancelRun,
      deleteRun,
      rateRun,
    }),
    [
      runs,
      runsActive,
      runsHistory,
      startAgent,
      getProjectRunningCount,
      cancelRun,
      deleteRun,
      rateRun,
    ],
  )

  return <AgentsContext.Provider value={value}>{children}</AgentsContext.Provider>
}

export function useAgents(): AgentsContextValue {
  const ctx = useContext(AgentsContext)
  if (!ctx) throw new Error('useAgents must be used within AgentsProvider')
  return ctx
}
