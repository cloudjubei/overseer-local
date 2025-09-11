import { attachToRun, startTaskRun, startFeatureRun, deleteHistoryRun, RunHandle } from '../../factory-tools/orchestratorBridge';
import { AgentType, LLMConfig, GithubCredentials, WebSearchApiKeys } from 'thefactory-tools';
import { notificationsService } from './notificationsService';

type Subscriber = (runs: RunHandle[]) => void;

function redactConfig(config: LLMConfig | null | undefined) {
  if (!config) return null;
  const { apiKey, ...rest } = config as any;
  return { ...rest, apiKey: apiKey ? '***' : '' };
}

class AgentsServiceImpl {
  private runs = new Map<string, RunHandle>();
  private subscribers = new Set<Subscriber>();
  private bootstrapped = false;

  private notify() {
    const list = Array.from(this.runs.values());
    for (const cb of this.subscribers) cb(list);
  }


  private async bootstrapFromActiveRuns() {
    if (this.bootstrapped) return;
    this.bootstrapped = true;
    try {
      const factory = (window as any).factory;
      if (!factory) return;

      if (typeof factory.listActiveRuns === 'function') {
        const active = await factory.listActiveRuns();

        if (Array.isArray(active)) {
          for (const m of active) {
            if (!m?.runId) continue;
            if (this.runs.has(m.runId)) continue;
            const handle = attachToRun(m.runId);
            this.runs.set(m.runId, handle);
          }
        }
      }

      this.notify();
    } catch (err) {
      console.warn('[agentsService] bootstrapFromActiveRuns failed', (err as any)?.message || err);
    }
  }

  subscribe(cb: Subscriber): () => void {
    this.subscribers.add(cb);
    // Lazy bootstrap when first subscriber attaches
    this.bootstrapFromActiveRuns();
    cb(Array.from(this.runs.values()));
    return () => {
      this.subscribers.delete(cb);
    };
  }

  list(): RunHandle[] {
    // Also attempt a bootstrap if not yet done (defensive)
    this.bootstrapFromActiveRuns();
    return Array.from(this.runs.values())
  }

  cancelRun(runId: string) {
    const rec = this.runs.get(runId);
    console.log('[agentsService] cancelRun', { runId, known: !!rec });
    if (!rec) return;
    try { rec.cancel('User requested'); } catch (err) { console.warn('[agentsService] cancel error', (err as any)?.message || err); }
    this.notify();
  }

  async removeRun(runId: string) {
    const rec = this.runs.get(runId);
    if (!rec) return;
    
    this.runs.delete(runId);
    this.notify();
    try {
      await deleteHistoryRun(runId);
    } catch (err) {
      console.warn('[agentsService] Failed to delete run from history store', (err as any)?.message || err);
    }
  }

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


  private async coerceAgentTypeForTask(agentType: AgentType, projectId: string, taskId: string): Promise<AgentType> {
    try {
      const task = await window.tasksService.getTask(projectId, taskId);
      if (!task) return agentType;
      const features = Array.isArray(task?.features) ? task!.features : [];
      if (features.length === 0 && (agentType === 'developer' || !agentType)) return 'speccer';
      return agentType;
    } catch (err) {
      console.warn('[agentsService] coerceAgentTypeForTask failed; keeping provided agentType', (err as any)?.message || err);
      return agentType;
    }
  }

  async startTaskAgent(agentType: AgentType, projectId: string, taskId: string, llmConfig: LLMConfig, githubCredentials: GithubCredentials, webSearchApiKeys?: WebSearchApiKeys): Promise<RunHandle> {
    
    // Enforce default: when the task has no features, prefer speccer (global behavior)
    const effectiveAgentType = await this.coerceAgentTypeForTask(agentType, projectId, taskId);

    console.log('[agentsService] startTaskAgent', { agentType: effectiveAgentType, projectId, taskId, llmConfig: redactConfig(llmConfig) });
    const handle = await startTaskRun({ agentType: effectiveAgentType, projectId, taskId, llmConfig, githubCredentials, webSearchApiKeys, options: {  } });
    
    this.runs.set(handle.id, handle);
    this.notify();
    return handle;
  }

  async startFeatureAgent(agentType: AgentType, projectId: string, taskId: string, featureId: string, llmConfig: LLMConfig, githubCredentials : GithubCredentials, webSearchApiKeys? : WebSearchApiKeys): Promise<AgentRun> {
    console.log('[agentsService] startFeatureAgent', { agentType, projectId, taskId, featureId, llmConfig: redactConfig(llmConfig) });
    const handle = await startFeatureRun({ agentType, projectId, taskId, featureId, llmConfig, githubCredentials, webSearchApiKeys, options: { } });
   
    this.runs.set(handle.id, handle);
    this.notify();
    return handle;
  }
}

export const agentsService = new AgentsServiceImpl();
