import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { AgentRunHistory, AgentType, AgentRunRatingPatch } from 'thefactory-tools'
import { useAppSettings } from './AppSettingsContext'
import { useLLMConfig } from '../contexts/LLMConfigContext'
import { factoryService } from '../services/factoryService'
import { storiesService } from '../services/storiesService'
import { notificationsService } from '../services/notificationsService'
import { useGitHubCredentials } from './GitHubCredentialsContext'
import { useProjectContext } from './ProjectContext'

export type AgentsContextValue = {
  runsHistory: AgentRunHistory[]
  startStoryAgent: (agentType: AgentType, projectId: string, storyId: string) => Promise<void>
  startFeatureAgent: (
    agentType: AgentType,
    projectId: string,
    storyId: string,
    featureId: string,
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

  const update = async () => {
    await factoryService.listRunsActive() // ensures handles are recreated
    const history = await factoryService.listRunHistory()
    setRunsHistory(history)
  }

  const updateRun = (updated: AgentRunHistory) => {
    if (updated.state !== 'running') {
      fireCompletionNotification(updated)
    }
    setRunsHistory((prev) => [...prev.filter((p) => p.id !== updated.id), updated])
  }

  useEffect(() => {
    update()
    const unsubscribe = factoryService.subscribeRuns(updateRun)
    return () => {
      unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storiesService])

  const activeCredentials = useMemo(() => {
    if (activeProject) {
      const githubCredentialsId = activeProject.metadata?.githubCredentialsId
      if (githubCredentialsId) {
        return getCredentials(githubCredentialsId)
      }
    }
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

  const startStoryAgent = useCallback(
    async (agentType: AgentType, projectId: string, storyId: string) => {
      if (!activeConfig) {
        throw new Error('NO ACTIVE LLM CONFIG')
      }
      if (!activeCredentials) {
        throw new Error('NO ACTIVE GITHUB CREDENTIALS')
      }
      const effectiveAgentType = await coerceAgentTypeForStory(agentType, projectId, storyId)
      const historyRun = await factoryService.startStoryRun({
        agentType: effectiveAgentType,
        projectId,
        storyId,
        llmConfig: activeConfig,
        githubCredentials: activeCredentials,
        webSearchApiKeys: appSettings.webSearchApiKeys,
      })
      setRunsHistory((prev) => [...prev, historyRun])
    },
    [activeConfig, appSettings],
  )

  const startFeatureAgent = useCallback(
    async (agentType: AgentType, projectId: string, storyId: string, featureId: string) => {
      if (!activeConfig) {
        throw new Error('NO ACTIVE LLM CONFIG')
      }
      if (!activeCredentials) {
        throw new Error('NO ACTIVE GITHUB CREDENTIALS')
      }
      const historyRun = await factoryService.startFeatureRun({
        agentType,
        projectId,
        storyId,
        featureId,
        llmConfig: activeConfig,
        githubCredentials: activeCredentials,
        webSearchApiKeys: appSettings.webSearchApiKeys,
      })
      setRunsHistory((prev) => [...prev, historyRun])
    },
    [activeConfig, appSettings],
  )

  const cancelRun = useCallback(async (runId: string) => await factoryService.cancelRun(runId), [])

  const deleteRunHistory = useCallback(async (runId: string) => {
    factoryService.deleteRunHistory(runId)
    setRunsHistory((prev) => [...prev.filter((p) => p.id !== runId)])
  }, [])

  const rateRun = useCallback(async (runId: string, rating?: AgentRunRatingPatch) => {
    const updatedRun = await factoryService.rateRun(runId, rating)
    if (updatedRun) {
      setRunsHistory((prev) => prev.map((r) => (r.id === runId ? updatedRun : r)))
    }
  }, [])

  const fireCompletionNotification = async (run: AgentRunHistory) => {
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
  }

  const value = useMemo<AgentsContextValue>(
    () => ({
      runsHistory,
      startStoryAgent,
      startFeatureAgent,
      cancelRun,
      deleteRunHistory,
      rateRun,
    }),
    [runsHistory, startStoryAgent, startFeatureAgent, cancelRun, deleteRunHistory, rateRun],
  )

  return <AgentsContext.Provider value={value}>{children}</AgentsContext.Provider>
}

export function useAgents(): AgentsContextValue {
  const ctx = useContext(AgentsContext)
  if (!ctx) throw new Error('useAgents must be used within AgentsProvider')
  return ctx
}
