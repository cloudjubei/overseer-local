import { useCallback, useMemo } from 'react'
import type {
  AgentRunType,
  ChatContextAgentRun,
  ChatContextAgentRunFeature,
  Chat,
  ChatContextAgentRunStory,
} from 'thefactory-tools'
import { getChatContextKey } from 'thefactory-tools/utils'
import { useChats } from '../contexts/chats/ChatsContext'
import { useAppSettings } from '../contexts/AppSettingsContext'
import { useLLMConfig } from '../contexts/LLMConfigContext'
import { useProjectContext } from '../contexts/ProjectContext'
import { useGitHubCredentials } from '../contexts/GitHubCredentialsContext'
import { storiesService } from '../services/storiesService'
import { chatsService } from '../services/chatsService'
import { completionService } from '../services/completionService'
import { notificationsService } from '../services/notificationsService'
import { useChatUnread } from './useChatUnread'

export type AgentRunsValue = {
  runsHistory: Chat[]
  runsActive: Chat[]
  isRunUnread: (run: Chat) => boolean
  getProjectRunningCount: (projectId?: string) => number
  startAgent: (
    agentType: AgentRunType,
    projectId: string,
    storyId: string,
    featureId?: string,
  ) => Promise<void>
  cancelRun: (runId: string) => Promise<void>
  deleteRunHistory: (runId: string) => Promise<void>
  rateRun: (runId: string, rating?: { score: number; comment?: string }) => Promise<void>
}

export function useAgentRuns(): AgentRunsValue {
  const { chatsByProjectId, getSettings } = useChats()
  const { appSettings } = useAppSettings()
  const { activeAgentRunConfig: activeConfig } = useLLMConfig()
  const { activeProject } = useProjectContext()
  const { getCredentials } = useGitHubCredentials()
  const { unreadKeys } = useChatUnread()

  // Track runs by analyzing current chat list in `ChatsContext`
  const runsHistory = useMemo(() => {
    if (!activeProject?.id) return []
    const projectChats = chatsByProjectId[activeProject.id] || []
    return projectChats
      .map((c) => c.chat)
      .filter((c) => c.context.type === 'AGENT_RUN_STORY' || c.context.type === 'AGENT_RUN_FEATURE')
  }, [chatsByProjectId, activeProject?.id])

  const runsActive = useMemo(
    () => runsHistory.filter((h) => h.state === 'running' || h.state === 'created'),
    [runsHistory],
  )

  const isFinished = (r: Chat) => r.state !== 'running' && r.state !== 'created'
  const isRunUnread = useCallback(
    (run: Chat) => {
      if (!isFinished(run)) return false
      const key = getChatContextKey(run.context)
      return unreadKeys.has(key)
    },
    [unreadKeys],
  )

  const getProjectRunningCount = useCallback(
    (projectId?: string) => {
      const pId = projectId || activeProject?.id
      if (!pId) return 0
      const projectChats = chatsByProjectId[pId] || []
      let count = 0
      for (const c of projectChats) {
        const type = c.chat.context.type
        const state = c.chat.state
        if (
          (type === 'AGENT_RUN_STORY' || type === 'AGENT_RUN_FEATURE') &&
          (state === 'running' || state === 'created')
        ) {
          count++
        }
      }
      return count
    },
    [chatsByProjectId, activeProject?.id],
  )

  const coerceAgentTypeForStory = async (
    agentType: AgentRunType,
    projectId: string,
    storyId: string,
  ): Promise<AgentRunType> => {
    try {
      const story = await storiesService.getStory(projectId, storyId)
      if (story && story.features.length === 0) return 'speccer'
    } catch (err) {
      console.warn(
        '[useAgentRuns] coerceAgentTypeForStory failed; keeping provided agentType',
        (err as any)?.message || err,
      )
    }
    return agentType
  }

  const startAgent = useCallback(
    async (agentType: AgentRunType, projectId: string, storyId: string, featureId?: string) => {
      if (!activeConfig) throw new Error('NO ACTIVE LLM CONFIG')
      const githubCredentialsId = activeProject?.metadata?.githubCredentialsId
      if (!githubCredentialsId) throw new Error('NO ACTIVE GITHUB CREDENTIALS ID')

      const activeCredentials = await getCredentials(githubCredentialsId)
      if (!activeCredentials) throw new Error('NO ACTIVE GITHUB CREDENTIALS')

      const effectiveAgentType = await coerceAgentTypeForStory(agentType, projectId, storyId)
      const agentRunId = Date.now().toString()

      const commonContext = { projectId, storyId, agentRunId }
      const context: ChatContextAgentRunStory | ChatContextAgentRunFeature = featureId
        ? {
            ...commonContext,
            type: 'AGENT_RUN_FEATURE',
            featureId,
          }
        : {
            ...commonContext,
            type: 'AGENT_RUN_STORY',
          }

      await chatsService.createChat({
        context,
        messages: [],
        state: 'created',
        metadata: {
          agentType: effectiveAgentType,
          llmConfig: activeConfig,
          githubCredentials: activeCredentials,
          webSearchApiKeys: appSettings.webSearchApiKeys,
        },
      })

      const chatSettings = getSettings(context)!
      const isolated = true

      completionService
        .startAgentRun(
          {
            agentType: effectiveAgentType,
            chatContext: context,
            llmConfig: activeConfig,
            githubCredentials: activeCredentials,
            webSearchApiKeys: appSettings.webSearchApiKeys,
          },
          chatSettings.completionSettings,
          isolated,
        )
        .catch((err) => {
          console.error('[useAgentRuns] Agent run failed to start:', err)
          chatsService.updateChat(context, { state: 'error' }).catch(() => {})
        })
    },
    [activeConfig, appSettings, activeProject, getCredentials, getSettings],
  )

  const cancelRun = useCallback(
    async (runId: string) => {
      const run = runsHistory.find((r) => r.context.agentRunId === runId)
      if (!run) return
      await chatsService.updateChat(run.context, { state: 'cancelled' })
    },
    [runsHistory],
  )

  const deleteRunHistory = useCallback(
    async (runId: string) => {
      const run = runsHistory.find((r) => r.context.agentRunId === runId)
      if (!run) return

      const pid = run.context.projectId
      if (pid) {
        try {
          const recent = await notificationsService.getRecentNotifications(pid)
          const targets = (recent || []).filter((n: any) => {
            if (n.read) return false
            if (n.category !== 'agent_runs') return false
            const md = (n.metadata || {}) as any
            return md.runId === runId
          })
          for (const n of targets) {
            try {
              await notificationsService.markNotificationAsRead(pid, n.id)
            } catch (_) {}
          }
        } catch (_) {}
      }

      await chatsService.deleteChat(run.context)
    },
    [runsHistory],
  )

  const rateRun = useCallback(
    async (runId: string, ratingPatch?: { score: number; comment?: string }) => {
      const run = runsHistory.find((r) => r.context.agentRunId === runId)
      if (!run) return
      await chatsService.updateChat(run.context, {
        rating: ratingPatch ? { ...ratingPatch, createdAt: new Date().toISOString() } : undefined,
      })
    },
    [runsHistory],
  )

  return {
    runsHistory,
    runsActive,
    isRunUnread,
    getProjectRunningCount,
    startAgent,
    cancelRun,
    deleteRunHistory,
    rateRun,
  }
}
