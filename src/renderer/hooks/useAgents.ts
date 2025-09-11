import { useEffect, useState, useCallback } from 'react';
import { AgentRunHistory, AgentType } from 'thefactory-tools';
import { useAppSettings } from '../contexts/AppSettingsContext';
import { useLLMConfig } from './useLLMConfig';
import { factoryService } from '../services/factoryService';
import { tasksService } from '../services/tasksService';
import { notificationsService } from '../services/notificationsService';

export function useAgents() //TODO; transform into Context like AppSettings (after them)
{
  const { appSettings } = useAppSettings()
  const { activeConfig } = useLLMConfig()
  const [runsHistory, setRunsHistory] = useState<AgentRunHistory[]>([]);

  const update = async () => {
      await factoryService.listRunsActive(); //so that it recreates handles
      const history = await factoryService.listRunHistory();
      setRunsHistory(history);
  };

  const updateRun = (updated: AgentRunHistory) => {
    if (updated.state !== 'running'){
      fireCompletionNotification(updated)
    }
    setRunsHistory((prev) => [...prev.filter((p) => p.id !== updated.id), updated])
  };

  useEffect(() => {
    update();

    const unsubscribe = factoryService.subscribeRuns(updateRun);

    return () => {
      unsubscribe();
    };
  }, [tasksService]);

  const startTaskAgent = useCallback(async (agentType: AgentType, projectId: string, taskId: string) => {
    if (!activeConfig){
      throw new Error("NO ACTIVE LLM CONFIG") 
    }
    const effectiveAgentType = await coerceAgentTypeForTask(agentType, projectId, taskId);

    const historyRun = factoryService.startTaskRun({ agentType: effectiveAgentType, projectId, taskId, llmConfig: activeConfig, githubCredentials: appSettings.github, webSearchApiKeys: appSettings.webSearchApiKeys })
    setRunsHistory([...runsHistory, historyRun])
  }, [activeConfig, appSettings]);

  const startFeatureAgent = useCallback(async (agentType: AgentType, projectId: string, taskId: string, featureId: string) => {
    if (!activeConfig){
      throw new Error("NO ACTIVE LLM CONFIG") 
    }

    const historyRun = factoryService.startFeatureRun({ agentType, projectId, taskId, featureId, llmConfig: activeConfig, githubCredentials: appSettings.github, webSearchApiKeys: appSettings.webSearchApiKeys })
    setRunsHistory([...runsHistory, historyRun])
  }, [activeConfig, appSettings]);

  const cancelRun = useCallback(async (runId: string) => factoryService.cancelRun(runId), []);
  const deleteRunHistory = useCallback(async (runId: string) => {
    await factoryService.deleteRunHistory(runId)
    setRunsHistory((prev) => [...prev.filter((p) => p.id !== runId)])
  }, []);

  const coerceAgentTypeForTask = async(agentType: AgentType, projectId: string, taskId: string): Promise<AgentType> => {
    try {
      const task = await tasksService.getTask(projectId, taskId);
      if (task && task.features.length === 0) return 'speccer';
    } catch (err) {
      console.warn('[agentsService] coerceAgentTypeForTask failed; keeping provided agentType', (err as any)?.message || err);
    }
    return agentType;
  }

  const fireCompletionNotification = async(run: AgentRunHistory) => {
    try {
      const baseTitle = 'Agent finished';
      const parts: string[] = [];
      parts.push(`Agent ${run.agentType}`);
      parts.push(`task ${run.taskId}`);
      const message = parts.join(' • ');

      await notificationsService.create(run.projectId, {
        type: 'success',
        category: 'agentRun',
        title: baseTitle,
        message,
        metadata: { runId: run.id },
      } as any);

    } catch (err) {
      console.warn('[useAgents] Failed to create completion notifications', (err as any)?.message || err);
    }
  }

  return { runsHistory, startTaskAgent, startFeatureAgent, cancelRun, deleteRunHistory };
}