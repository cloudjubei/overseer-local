import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { AgentRunHistory, AgentType, AgentRunRatingPatch, AgentRunUpdate } from 'thefactory-tools'
import { useAppSettings } from './AppSettingsContext'
import { useLLMConfig } from '../contexts/LLMConfigContext'
import { factoryAgentRunService } from '../services/factoryAgentRunService'
import { storiesService } from '../services/storiesService'
import { notificationsService } from '../services/notificationsService'
import { useGitHubCredentials } from './GitHubCredentialsContext'
import { useProjectContext } from './ProjectContext'

export type AgentsContextValue = {
  runsActive: AgentRunHistory[]
  runsHistory: AgentRunHistory[]
  // unseen completed runs helpers
  isRunUnread: (run: AgentRunHistory) => boolean
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
  rateRun: (runId: string, rating?: AgentRunRatingPatch) => Promise<void>
}

const AgentsContext = createContext<AgentsContextValue | null>(null)
const notificationsFired = new Set<string>()

export function AgentsProvider({ children }: { children: React.ReactNode }) {
  const { appSettings } = useAppSettings()
  const { activeAgentRunConfig: activeConfig } = useLLMConfig()
  const { activeProject } = useProjectContext()
  const { getCredentials } = useGitHubCredentials()
  const [runsHistory, setRunsHistory] = useState<AgentRunHistory[]>([])
  const runsActive = useMemo(
    () => runsHistory.filter((h) => h.state === 'running' || h.state === 'created'),
    [runsHistory],
  )

  // unseen completed runs tracking
  const [seenCompletedIds, setSeenCompletedIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('agentRuns.seenCompleted')
      if (!raw) return new Set()
      const arr = JSON.parse(raw)
      return new Set(Array.isArray(arr) ? arr : [])
    } catch {
      return new Set()
    }
  })
  const isFinished = (r: AgentRunHistory) => r.state !== 'running' && r.state !== 'created'
  const isRunUnread = useCallback(
    (run: AgentRunHistory) => {
      if (!isFinished(run)) return false
      return !seenCompletedIds.has(run.id)
    },
    [seenCompletedIds],
  )
  const markRunSeen = useCallback((runId: string) => {
    setSeenCompletedIds((prev) => {
      if (prev.has(runId)) return prev
      const next = new Set(prev)
      next.add(runId)
      try {
        localStorage.setItem('agentRuns.seenCompleted', JSON.stringify(Array.from(next)))
      } catch {}
      return next
    })
  }, [])
  const getCompletedUnreadCount = useCallback(
    (projectId?: string) => {
      const runs = projectId ? runsHistory.filter((r) => r.projectId === projectId) : runsHistory
      let count = 0
      for (const r of runs) {
        if (isFinished(r) && !seenCompletedIds.has(r.id)) count += 1
      }
      return count
    },
    [runsHistory, seenCompletedIds],
  )

  const update = async () => {
    const history = await factoryAgentRunService.listRunHistory()
    setRunsHistory(history)
  }

  const fireCompletionNotification = async (run: AgentRunHistory) => {
    if (notificationsFired.has(run.id)) {
      return
    }
    notificationsFired.add(run.id)
    try {
      const baseTitle = 'Agent finished'
      const parts: string[] = []
      parts.push(`Agent ${run.agentType}`)
      parts.push(`story ${run.storyId}`)
      const message = parts.join(' • ')

      await notificationsService.create(run.projectId, {
        type: 'success',
        category: 'agent_runs',
        title: baseTitle,
        message,
        metadata: { runId: run.id },
      })
    } catch (err) {
      console.warn(
        '[AgentsContext] Failed to create completion notifications',
        (err as any)?.message || err,
      )
    }
  }

  const onAgentRunUpdate = useCallback(
    async (agentRunUpdate: AgentRunUpdate) => {
      switch (agentRunUpdate.type) {
        case 'add': {
          const run =
            agentRunUpdate.run ?? (await factoryAgentRunService.getRunHistory(agentRunUpdate.runId))
          if (run) {
            setRunsHistory((prev) => [...prev, run])
          }
          break
        }
        case 'delete': {
          setRunsHistory((prev) => prev.filter((r) => r.id !== agentRunUpdate.runId))
          break
        }
        case 'change': {
          const run =
            agentRunUpdate.run ?? (await factoryAgentRunService.getRunHistory(agentRunUpdate.runId))
          if (run) {
            setRunsHistory((prev) => {
              const prevRunIndex = prev.findIndex((r) => r.id === agentRunUpdate.runId)
              if (prevRunIndex > -1) {
                const newPrev = [...prev]
                const prevRun = newPrev[prevRunIndex]
                const isRunning = run.state === 'running' || run.state === 'created'
                if ((prevRun.state === 'running' || prevRun.state === 'created') && !isRunning) {
                  fireCompletionNotification(run)
                }
                newPrev[prevRunIndex] = run
                return newPrev
              }
              return prev
            })
          }
          break
        }
      }
    },
    [fireCompletionNotification],
  )

  useEffect(() => {
    const unsubscribe = factoryAgentRunService.subscribeRuns(onAgentRunUpdate)
    return () => {
      unsubscribe()
    }
  }, [onAgentRunUpdate])

  useEffect(() => {
    update()
  }, [])

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
        '[agentsService] coerceAgentTypeForStory failed; keeping provided agentType',
        (err as any)?.message || err,
      )
    }
    return agentType
  }

  const startAgent = useCallback(
    async (agentType: AgentType, projectId: string, storyId: string, featureId?: string) => {
      if (!activeConfig) {
        throw new Error('NO ACTIVE LLM CONFIG')
      }
      const githubCredentialsId = activeProject?.metadata?.githubCredentialsId
      if (!githubCredentialsId) {
        throw new Error('NO ACTIVE GITHUB CREDENTIALS ID')
      }
      const activeCredentials = await getCredentials(githubCredentialsId)
      if (!activeCredentials) {
        throw new Error('NO ACTIVE GITHUB CREDENTIALS')
      }
      const effectiveAgentType = await coerceAgentTypeForStory(agentType, projectId, storyId)
      await factoryAgentRunService.startRun({
        agentType: effectiveAgentType,
        projectId,
        storyId,
        featureId,
        llmConfig: activeConfig,
        githubCredentials: activeCredentials,
        webSearchApiKeys: appSettings.webSearchApiKeys,
      })
    },
    [activeConfig, appSettings, activeProject, getCredentials, coerceAgentTypeForStory],
  )

  const cancelRun = useCallback(
    async (runId: string) => await factoryAgentRunService.cancelRun(runId),
    [],
  )

  const deleteRunHistory = useCallback(async (runId: string) => {
    await factoryAgentRunService.deleteRunHistory(runId)
  }, [])

  const rateRun = useCallback(async (runId: string, rating?: AgentRunRatingPatch) => {
    setRunsHistory((prev) =>
      [...prev].map((r) =>
        r.id === runId
          ? {
              ...r,
              rating: rating
                ? { score: rating.score, createdAt: new Date().toISOString() }
                : undefined,
            }
          : r,
      ),
    )
    try {
      await factoryAgentRunService.rateRun(runId, rating)
    } catch (err) {
      console.warn('[AgentsContext] rateRun failed', (err as any)?.message || err)
    }
  }, [])

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
