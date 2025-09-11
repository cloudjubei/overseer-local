import { useEffect, useState, useCallback } from 'react';
import { AgentRunHistory, AgentType } from 'thefactory-tools';
import { useAppSettings } from '../contexts/AppSettingsContext';
import { useLLMConfig } from './useLLMConfig';
import { factoryService } from '../services/factoryService';
import { tasksService } from '../services/tasksService';

export function useAgents()
{
  const { appSettings } = useAppSettings()
  const { activeConfig } = useLLMConfig()
  const [runsActive, setRunsActive] = useState<AgentRunHistory[]>([]);
  const [runsHistory, setRunsHistory] = useState<AgentRunHistory[]>([]);

  const update = async () => {
      const active = await factoryService.listRunsActive();
      console.log("useAgents active: ", active)
      // setRunsActive(active);
      const history = await factoryService.listRunHistory();
      console.log("useAgents history: ", history)
      // setRunsHistory(history);
  };

  const updateRun = (updated: AgentRunHistory) => {
      if (updated.state == 'running'){
        const prev = runsActive.findIndex(h => h.id === updated.id)
        if (prev){
          let newActive = [...runsActive]
          newActive[prev] = updated
          setRunsActive(newActive)
        }else{
          setRunsActive([...runsActive, updated])
        }
      }else{
        const newActive = runsActive.filter(h => h.id !== updated.id)
        setRunsActive(newActive)

        const prev = runsHistory.findIndex(h => h.id === updated.id)
        if (prev){
          let newHistory = [...runsHistory]
          newHistory[prev] = updated
          setRunsHistory(newHistory)
        }else{
          setRunsHistory([...runsHistory, updated])
        }
      }
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
    setRunsActive([...runsActive, historyRun])
  }, [activeConfig, appSettings]);

  const startFeatureAgent = useCallback(async (agentType: AgentType, projectId: string, taskId: string, featureId: string) => {
    if (!activeConfig){
      throw new Error("NO ACTIVE LLM CONFIG") 
    }

    const historyRun = factoryService.startFeatureRun({ agentType, projectId, taskId, featureId, llmConfig: activeConfig, githubCredentials: appSettings.github, webSearchApiKeys: appSettings.webSearchApiKeys })
    setRunsActive([...runsActive, historyRun])
  }, [activeConfig, appSettings]);

  const cancelRun = useCallback((runId: string) => factoryService.cancelRun(runId), []);
  const deleteRunHistory = useCallback(async (runId: string) => factoryService.deleteRunHistory(runId), []);

  const coerceAgentTypeForTask = async(agentType: AgentType, projectId: string, taskId: string): Promise<AgentType> => {
    try {
      const task = await tasksService.getTask(projectId, taskId);
      if (task && task.features.length === 0) return 'speccer';
    } catch (err) {
      console.warn('[agentsService] coerceAgentTypeForTask failed; keeping provided agentType', (err as any)?.message || err);
    }
    return agentType;
  }

  return { runsActive, runsHistory, startTaskAgent, startFeatureAgent, cancelRun, deleteRunHistory };
}

    //TODO: get running handles from factory
    // try {
    //   const active = await factoryService.listRunHistoryActive();

    //   for (const m of active) {
    //     if (!m?.runId) continue;
    //     if (this.runs.has(m.runId)) continue;
    //     const handle = attachToRun(m.runId);
    //     this.runs.set(m.runId, handle);
    //   }

    //   this.notify();
    // } catch (err) {
    //   console.warn('[agentsService] bootstrapFromActiveRuns failed', (err as any)?.message || err);
    // }

  // private async fireCompletionNotifications(run: RunRecord) {
  //   try {
  //     const baseTitle = 'Agent finished';
  //     const parts: string[] = [];
  //     parts.push(`Agent ${run.agentType}`);
  //     parts.push(`task ${run.taskId}`);
  //     const message = parts.join(' • ');

  //     await notificationsService.create(run.projectId, {
  //       type: 'success',
  //       category: 'tasks',
  //       title: baseTitle,
  //       message,
  //       metadata: { taskId: run.taskId },
  //     } as any);

  //   } catch (err) {
  //     console.warn('[agentsService] Failed to create completion notifications', (err as any)?.message || err);
  //   }
  // }


  // private async checkAndNotifyFeatureCompletions(run: RunRecord) {
  //   try {
  //     const factory = (window as any).factory;
  //     if (!factory?.getRunMessages) return;
  //     const normalized: Record<string, { featureId: string; messages: any[] }> = await factory.getRunMessages(run.runId);
  //     if (!normalized || typeof normalized !== 'object') return;
  //     if (!run.__notifiedFeatures) run.__notifiedFeatures = new Set<string>();
  //     for (const key of Object.keys(normalized)) {
  //       const group = (normalized as any)[key];
  //       const fid = String(group?.featureId || key);
  //       if (fid === DEFAULT_FEATURE_KEY) continue; // skip task-level chat
  //       if (run.__notifiedFeatures.has(fid)) continue;
  //       const msgs = Array.isArray(group?.messages) ? group.messages : [];
  //       if (msgs.length === 0) continue;
  //       const finished = this.featureHasFinishTool(msgs);
  //       if (finished) {
  //         try {
  //           await notificationsService.create(run.projectId, {
  //             type: 'success',
  //             category: 'tasks',
  //             title: 'Feature completed',
  //             message: `Task ${run.taskId} • Feature ${fid} committed`,
  //             metadata: { taskId: run.taskId, featureId: fid },
  //           } as any);
  //         } catch (err) {
  //           console.warn('[agentsService] Failed to create feature completion notification', (err as any)?.message || err);
  //         }
  //         run.__notifiedFeatures.add(fid);
  //       }
  //     }
  //   } catch (err) {
  //     console.warn('[agentsService] checkAndNotifyFeatureCompletions failed', (err as any)?.message || err);
  //   }
  // }
