import { useEffect, useMemo, useState, useCallback } from 'react';
import { agentsService, AgentRun } from '../services/agentsService';

export function useAgents() {
  const [runs, setRuns] = useState<AgentRun[]>(() => agentsService.list());

  useEffect(() => {
    const unsub = agentsService.subscribe((r) => setRuns(r));
    return () => unsub();
  }, []);

  const startTaskAgent = useCallback(async (projectId: string, taskId: string) => agentsService.startTaskAgent(projectId, taskId), []);
  const startFeatureAgent = useCallback(async (projectId: string, taskId: string, featureId: string) => agentsService.startFeatureAgent(projectId, taskId, featureId), []);
  const cancelRun = useCallback((runId: string) => agentsService.cancelRun(runId), []);

  const activeRuns = useMemo(() => runs.filter(r => r.state === 'running'), [runs]);
  return { runs, activeRuns, startTaskAgent, startFeatureAgent, cancelRun };
}
