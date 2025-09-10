import { useEffect, useMemo, useState, useCallback } from 'react';
import { agentsService, AgentRun } from '../services/agentsService';
import { AgentType } from 'thefactory-tools';
import { useAppSettings } from './useAppSettings';
import { LLMConfigManager } from '../utils/LLMConfigManager';

export function useAgents() {
  const { appSettings } = useAppSettings()
  const [runs, setRuns] = useState<AgentRun[]>(() => agentsService.list());
  const [llmManager, setLLMManager] = useState<LLMConfigManager>(new LLMConfigManager())

  useEffect(() => {
    const unsub = agentsService.subscribe((r) => setRuns(r));
    return () => unsub();
  }, []);

  const startTaskAgent = useCallback(async (agentType: AgentType, projectId: string, taskId: string) => {
    const llmConfig = llmManager.getActiveConfig();
    if (!llmConfig){
      throw new Error("NO ACTIVE LLM CONFIG") 
    }
    console.log("CALLING startTaskAgent with llmConfig: ", llmConfig)
    agentsService.startTaskAgent(agentType, projectId, taskId, llmConfig, appSettings.github, appSettings.webSearchApiKeys)
  }, [llmManager, appSettings]);

  const startFeatureAgent = useCallback(async (agentType: AgentType, projectId: string, taskId: string, featureId: string) => {
    const llmConfig = llmManager.getActiveConfig();
    if (!llmConfig){
      throw new Error("NO ACTIVE LLM CONFIG") 
    }
    console.log("CALLING startFeatureAgent with llmConfig: ", llmConfig)
    agentsService.startFeatureAgent(agentType, projectId, taskId, featureId, llmConfig, appSettings.github, appSettings.webSearchApiKeys)
  }, [llmManager, appSettings]);

  const cancelRun = useCallback((runId: string) => agentsService.cancelRun(runId), []);
  const removeRun = useCallback(async (runId: string) => agentsService.removeRun(runId), []);

  const activeRuns = useMemo(() => runs.filter(r => r.state === 'running'), [runs]);
  return { runs, activeRuns, startTaskAgent, startFeatureAgent, cancelRun, removeRun };
}
