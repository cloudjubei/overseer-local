import { useEffect, useMemo, useState, useCallback } from 'react';
import { agentsService, AgentRun } from '../services/agentsService';
import { AgentType } from 'packages/factory-ts/src/types';

export function useAgents() {
  const [runs, setRuns] = useState<AgentRun[]>(() => agentsService.list());

  useEffect(() => {
    const unsub = agentsService.subscribe((r) => setRuns(r));
    return () => unsub();
  }, []);

  const startTaskAgent = useCallback(async (agentType: AgentType, projectId: string, taskId: string) => agentsService.startTaskAgent(agentType, projectId, taskId), []);
  const startFeatureAgent = useCallback(async (agentType: AgentType, projectId: string, taskId: string, featureId: string) => agentsService.startFeatureAgent(agentType, projectId, taskId, featureId), []);
  const cancelRun = useCallback((runId: string) => agentsService.cancelRun(runId), []);
  const removeRun = useCallback(async (runId: string) => agentsService.removeRun(runId), []);

  const activeRuns = useMemo(() => runs.filter(r => r.state === 'running'), [runs]);
  return { runs, activeRuns, startTaskAgent, startFeatureAgent, cancelRun, removeRun };
}
