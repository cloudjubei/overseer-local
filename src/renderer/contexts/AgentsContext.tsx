import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { AgentRunHistory, AgentType, AgentRunRatingPatch } from 'thefactory-tools'
import { useAppSettings } from './AppSettingsContext'
import { useLLMConfig } from '../contexts/LLMConfigContext'
import { factoryService } from '../services/factoryService'
import { tasksService } from '../services/tasksService'
import { notificationsService } from '../services/notificationsService'
import { useGitHubCredentials } from './GitHubCredentialsContext'
import { useProjectContext } from './ProjectContext'

export type AgentsContextValue = {
  runsHistory: AgentRunHistory[]
  startTaskAgent: (agentType: AgentType, projectId: string, taskId: string) => Promise<void>
  startFeatureAgent: (
    agentType: AgentType,
    projectId: string,
    taskId: string,
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
  }, [tasksService])

  const activeCredentials = useMemo(() => {
    if (activeProject) {
      const githubCredentialsId = activeProject.metadata?.githubCredentialsId
      if (githubCredentialsId) {
        return getCredentials(githubCredentialsId)
      }
    }
  }, [activeProject, getCredentials])

  const coerceAgentTypeForTask = async (
    agentType: AgentType,
    projectId: string,
    taskId: string,
  ): Promise<AgentType> => {
    try {
      const task = await tasksService.getTask(projectId, taskId)
      if (task && task.features.length === 0) return 'speccer'
    } catch (err) {
      console.warn(
        '[agentsService] coerceAgentTypeForTask failed; keeping provided agentType',
        (err as any)?.message || err,
      )
    }
    return agentType
  }

  const startTaskAgent = useCallback(
    async (agentType: AgentType, projectId: string, taskId: string) => {
      if (!activeConfig) {
        throw new Error('NO ACTIVE LLM CONFIG')
      }
      if (!activeCredentials) {
        throw new Error('NO ACTIVE GITHUB CREDENTIALS')
      }
      const effectiveAgentType = await coerceAgentTypeForTask(agentType, projectId, taskId)
      const historyRun = factoryService.startTaskRun({
        agentType: effectiveAgentType,
        projectId,
        taskId,
        llmConfig: activeConfig,
        githubCredentials: activeCredentials,
        webSearchApiKeys: appSettings.webSearchApiKeys,
      })
      setRunsHistory((prev) => [...prev, historyRun])
    },
    [activeConfig, appSettings],
  )

  const startFeatureAgent = useCallback(
    async (agentType: AgentType, projectId: string, taskId: string, featureId: string) => {
      if (!activeConfig) {
        throw new Error('NO ACTIVE LLM CONFIG')
      }
      if (!activeCredentials) {
        throw new Error('NO ACTIVE GITHUB CREDENTIALS')
      }
      const historyRun = factoryService.startFeatureRun({
        agentType,
        projectId,
        taskId,
        featureId,
        llmConfig: activeConfig,
        githubCredentials: activeCredentials,
        webSearchApiKeys: appSettings.webSearchApiKeys,
      })
      setRunsHistory((prev) => [...prev, historyRun])
    },
    [activeConfig, appSettings],
  )

  const cancelRun = useCallback(async (runId: string) => factoryService.cancelRun(runId), [])

  const deleteRunHistory = useCallback(async (runId: string) => {
    await factoryService.deleteRunHistory(runId)
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
      parts.push(`task ${run.taskId}`)
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
      startTaskAgent,
      startFeatureAgent,
      cancelRun,
      deleteRunHistory,
      rateRun,
    }),
    [runsHistory, startTaskAgent, startFeatureAgent, cancelRun, deleteRunHistory, rateRun],
  )

  return <AgentsContext.Provider value={value}>{children}</AgentsContext.Provider>
}

export function useAgents(): AgentsContextValue {
  const ctx = useContext(AgentsContext)
  if (!ctx) throw new Error('useAgents must be used within AgentsProvider')
  return ctx
}
