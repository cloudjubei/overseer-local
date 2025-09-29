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

export function AgentsProvider({ children }: { children: React.ReactNode }) {
  const { appSettings } = useAppSettings()
  const { activeConfig } = useLLMConfig()
  const { activeProject } = useProjectContext()
  const { getCredentials } = useGitHubCredentials()
  const [runsHistory, setRunsHistory] = useState<AgentRunHistory[]>([])
  const runsActive = useMemo(
    () => runsHistory.filter((h) => h.state === 'running' || h.state === 'created'),
    [runsHistory],
  )

  const update = async () => {
    const history = await factoryAgentRunService.listRunHistory()
    setRunsHistory(history)
  }

  const fireCompletionNotification = useCallback(async (run: AgentRunHistory) => {
    try {
      const baseTitle = 'Agent finished'
      const parts: string[] = []
      parts.push(`Agent ${run.agentType}`)
      parts.push(`story ${run.storyId}`)
      const message = parts.join(' • ')

      await notificationsService.create(run.projectId, {
        type: 'success',
        category: 'agentRun',
        title: baseTitle,
        message,
        metadata: { runId: run.id },
      } as any)
    } catch (err) {
      console.warn(
        '[AgentsContext] Failed to create completion notifications',
        (err as any)?.message || err,
      )
    }
  }, [])

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

  const activeCredentials = useMemo(() => {
    if (activeProject) {
      const githubCredentialsId = activeProject.metadata?.githubCredentialsId
      if (githubCredentialsId) {
        return getCredentials(githubCredentialsId)
      }
    }
    return
  }, [activeProject, getCredentials])

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
    [activeConfig, appSettings, activeCredentials],
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
      startAgent,
      cancelRun,
      deleteRunHistory,
      rateRun,
    }),
    [runsActive, runsHistory, startAgent, cancelRun, deleteRunHistory, rateRun],
  )

  return <AgentsContext.Provider value={value}>{children}</AgentsContext.Provider>
}

export function useAgents(): AgentsContextValue {
  const ctx = useContext(AgentsContext)
  if (!ctx) throw new Error('useAgents must be used within AgentsProvider')
  return ctx
}
