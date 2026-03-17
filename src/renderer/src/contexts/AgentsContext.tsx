import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ChatContext, Chat, AgentType, LLMConfig } from 'thefactory-tools'
import { useAppSettings } from './AppSettingsContext'
import { useLLMConfig } from '../contexts/LLMConfigContext'
import { storiesService } from '../services/storiesService'
import { useGitHubCredentials } from './GitHubCredentialsContext'
import { useProjectContext } from './ProjectContext'
import { chatsService } from '../services/chatsService'
// import { useChats } from './ChatsContext'
import { useChats } from './chats/ChatsContext'
import { notificationsService } from '../services/notificationsService'

export type AgentsContextValue = {
  runsActive: Chat[]
  runsHistory: Chat[]
  isRunUnread: (run: Chat) => boolean
  markRunSeen: (runId: string) => void
  getCompletedUnreadCount: (projectId?: string) => number
  startAgent: (
    agentType: AgentType,
    projectId: string,
    storyId: string,
    featureId?: string,
  ) => Promise<void>
  cancelRun: (runId: string) => Promise<void>
  deleteRunHistory: (runId: string) => Promise<void>
  rateRun: (runId: string, rating?: { score: number; comment?: string }) => Promise<void>
}

const AgentsContext = createContext<AgentsContextValue | null>(null)

export function AgentsProvider({ children }: { children: React.ReactNode }) {
  const { appSettings } = useAppSettings()
  const { activeAgentRunConfig: activeConfig } = useLLMConfig()
  const { activeProject } = useProjectContext()
  const { getCredentials } = useGitHubCredentials()

  const { chatsByProjectId } = useChats()

  // Track runs by analyzing current chat list in `ChatsContext`
  const runsHistory = useMemo(() => {
    if (!activeProject?.id) return []
    const projectChats = chatsByProjectId[activeProject.id] || []
    return projectChats
      .map((c) => c.chat)
      .filter((c) => c.context.type === 'AGENT_RUN' || c.context.type === 'AGENT_RUN_FEATURE')
  }, [chatsByProjectId, activeProject?.id])

  const runsActive = useMemo(
    () => runsHistory.filter((h) => h.state === 'running' || h.state === 'created'),
    [runsHistory],
  )

  // Unseen completed runs tracking
  const [seenCompletedIds, setSeenCompletedIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('agentRuns.seenCompletedChats')
      if (!raw) return new Set()
      const arr = JSON.parse(raw)
      return new Set(Array.isArray(arr) ? arr : [])
    } catch {
      return new Set()
    }
  })

  const isFinished = (r: Chat) => r.state !== 'running' && r.state !== 'created'
  const isRunUnread = useCallback(
    (run: Chat) => {
      if (!isFinished(run)) return false
      return !seenCompletedIds.has(run.context.agentRunId!)
    },
    [seenCompletedIds],
  )

  const markRunSeen = useCallback((runId: string) => {
    setSeenCompletedIds((prev) => {
      if (prev.has(runId)) return prev
      const next = new Set(prev)
      next.add(runId)
      try {
        localStorage.setItem('agentRuns.seenCompletedChats', JSON.stringify(Array.from(next)))
      } catch {}
      return next
    })
  }, [])

  const getCompletedUnreadCount = useCallback(
    (projectId?: string) => {
      const runs = projectId
        ? runsHistory.filter((r) => r.context.projectId === projectId)
        : runsHistory
      let count = 0
      for (const r of runs) {
        if (isFinished(r) && r.context.agentRunId && !seenCompletedIds.has(r.context.agentRunId))
          count += 1
      }
      return count
    },
    [runsHistory, seenCompletedIds],
  )

  const coerceAgentTypeForStory = async (
    agentType: AgentType,
    projectId: string,
    storyId: string,
  ): Promise<AgentType> => {
    try {
      const story = await storiesService.getStory(projectId, storyId)
      if (story && story.features.length === 0) return 'speccer'
    } catch (err) {
      console.warn(
        '[AgentsContext] coerceAgentTypeForStory failed; keeping provided agentType',
        (err as any)?.message || err,
      )
    }
    return agentType
  }

  const startAgent = useCallback(
    async (agentType: AgentType, projectId: string, storyId: string, featureId?: string) => {
      if (!activeConfig) throw new Error('NO ACTIVE LLM CONFIG')
      const githubCredentialsId = activeProject?.metadata?.githubCredentialsId
      if (!githubCredentialsId) throw new Error('NO ACTIVE GITHUB CREDENTIALS ID')

      const activeCredentials = await getCredentials(githubCredentialsId)
      if (!activeCredentials) throw new Error('NO ACTIVE GITHUB CREDENTIALS')

      const effectiveAgentType = await coerceAgentTypeForStory(agentType, projectId, storyId)
      const agentRunId = Date.now().toString()

      const context: ChatContext = {
        type: featureId ? 'AGENT_RUN_FEATURE' : 'AGENT_RUN',
        projectId,
        storyId,
        featureId,
        agentRunId,
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
      // The start-run behavior (orchestrator execution) will be integrated in a subsequent layer.
      // This satisfies the data representation of the story.
    },
    [activeConfig, appSettings, activeProject, getCredentials],
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

  const value = useMemo<AgentsContextValue>(
    () => ({
      runsActive,
      runsHistory,
      isRunUnread,
      markRunSeen,
      getCompletedUnreadCount,
      startAgent,
      cancelRun,
      deleteRunHistory,
      rateRun,
    }),
    [
      runsActive,
      runsHistory,
      isRunUnread,
      markRunSeen,
      getCompletedUnreadCount,
      startAgent,
      cancelRun,
      deleteRunHistory,
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
