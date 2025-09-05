import { EventSourceLike, attachToRun, startTaskRun, startFeatureRun, deleteHistoryRun } from '../../tools/factory/orchestratorBridge';
import { LLMConfigManager } from '../utils/LLMConfigManager';
import { AgentType, LLMConfig } from 'packages/factory-ts/src/types';
import { notificationsService } from './notificationsService';

export type AgentRunState = 'running' | 'completed' | 'cancelled' | 'error';

export interface AgentRunMessage {
  role: string;
  content: string;
}

export type AgentRun = {
  runId: string;
  agentType: AgentType;
  projectId: string;
  taskId: string;
  state: AgentRunState;
  message?: string;
  progress?: number; // 0..1 (if available)
  costUSD?: number;
  promptTokens?: number;
  completionTokens?: number;
  provider?: string;
  model?: string;
  startedAt: string; // ISO
  updatedAt: string; // ISO

  messagesLog?: Record<string,AgentFeatureRunLog>
};
export type AgentFeatureRunLog = {
  startDate: Date;
  endDate?: Date;
  featureId: string;
  messages: AgentRunMessage[];
}

// Internal structure to keep handle + eventSource
interface RunRecord extends AgentRun {
  events: EventSourceLike;
  cancel: (reason?: string) => void;
}

type Subscriber = (runs: AgentRun[]) => void;

function getEventTs(e: any): string {
  return e?.ts || e?.time || new Date().toISOString();
}

function getCostUSD(payload: any | undefined): number | undefined {
  if (!payload) return undefined;
  return payload.costUSD ?? payload.costUsd ?? payload.usd ?? undefined;
}

function redactConfig(config: LLMConfig | null | undefined) {
  if (!config) return null;
  const { apiKey, ...rest } = config as any;
  return { ...rest, apiKey: apiKey ? '***' : '' };
}

const NOOP_EVENTS: EventSourceLike = { addEventListener: (_t: string, _h: (e: any) => void) => {}, close: () => {} };
const DEFAULT_FEATURE_KEY = '__task__';

class AgentsServiceImpl {
  private runs = new Map<string, RunRecord>();
  private subscribers = new Set<Subscriber>();
  private llmManager = new LLMConfigManager();
  private bootstrapped = false;

  private notify() {
    const list = Array.from(this.runs.values()).map(this.publicFromRecord);
    for (const cb of this.subscribers) cb(list);
  }

  private publicFromRecord(rec: RunRecord): AgentRun {
    const { events: _ev, cancel: _c, ...pub } = rec as any;
    return pub as AgentRun;
  }

  private async bootstrapFromActiveRuns() {
    if (this.bootstrapped) return;
    this.bootstrapped = true;
    try {
      const factory = (window as any).factory;
      if (!factory) return;
      // 1) Attach to active
      if (typeof factory.listActiveRuns === 'function') {
        const active = await factory.listActiveRuns();
        if (Array.isArray(active)) {
          for (const m of active) {
            if (!m?.runId) continue;
            if (this.runs.has(m.runId)) continue;
            const { handle, events } = attachToRun(m.runId);
            const run: RunRecord = {
              runId: handle.id,
              agentType: m.agentType,
              projectId: m.projectId,
              taskId: m.taskId,
              featureId: m.featureId ?? undefined,
              state: m.state ?? 'running',
              message: m.message ?? 'Running... ',
              progress: m.progress,
              costUSD: m.costUSD,
              promptTokens: m.promptTokens,
              completionTokens: m.completionTokens,
              provider: m.provider,
              model: m.model,
              startedAt: m.startedAt || new Date().toISOString(),
              updatedAt: m.updatedAt || new Date().toISOString(),
              messagesLog: {},
              events,
              cancel: (reason?: string) => handle.cancel(reason),
            } as RunRecord;
            this.wireRunEvents(run);
            this.runs.set(run.runId, run);

            try {
              run.messagesLog  = await factory.getRunMessages(run.runId);
            } catch (err) {
              console.warn('[agentsService] Failed to load messages for active run', run.runId, (err as any)?.message || err);
            }
          }
        }
      }

      const history = await factory.listRunHistory();
      if (Array.isArray(history)) {
        for (const m of history) {
          if (!m?.runId) continue;
          if (this.runs.has(m.runId)) continue;
          const rec: RunRecord = {
            runId: m.runId,
            agentType: m.agentType,
            projectId: m.projectId,
            taskId: m.taskId,
            featureId: m.featureId ?? undefined,
            state: m.state ?? 'completed',
            message: m.message ?? '',
            progress: m.progress,
            costUSD: m.costUSD,
            promptTokens: m.promptTokens,
            completionTokens: m.completionTokens,
            provider: m.provider,
            model: m.model,
            startedAt: m.startedAt || new Date().toISOString(),
            updatedAt: m.updatedAt || new Date().toISOString(),
            messagesLog: {},
            events: NOOP_EVENTS,
            cancel: () => {},
          } as RunRecord;
          this.runs.set(rec.runId, rec);
          
          try {
            rec.messagesLog  = await factory.getRunMessages(rec.runId);
          } catch (err) {
            console.warn('[agentsService] Failed to load messages for history run', rec.runId, (err as any)?.message || err);
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
    cb(Array.from(this.runs.values()).map(this.publicFromRecord));
    return () => {
      this.subscribers.delete(cb);
    };
  }

  list(): AgentRun[] {
    // Also attempt a bootstrap if not yet done (defensive)
    this.bootstrapFromActiveRuns();
    return Array.from(this.runs.values()).map(this.publicFromRecord);
  }

  cancelRun(runId: string) {
    const rec = this.runs.get(runId);
    console.log('[agentsService] cancelRun', { runId, known: !!rec });
    if (!rec) return;
    try { rec.cancel('User requested'); } catch (err) { console.warn('[agentsService] cancel error', (err as any)?.message || err); }
    rec.state = 'cancelled';
    rec.updatedAt = new Date().toISOString();
    this.notify();
  }

  async removeRun(runId: string) {
    const rec = this.runs.get(runId);
    if (!rec) return;
    if (rec.state === 'running') {
      console.warn('[agentsService] removeRun ignored for running run', runId);
      return;
    }
    // Optimistic update
    this.runs.delete(runId);
    this.notify();
    try {
      await deleteHistoryRun(runId);
    } catch (err) {
      console.warn('[agentsService] Failed to delete run from history store', (err as any)?.message || err);
    }
  }

  private logEventVerbose(run: RunRecord, e: any) {
    try {
      const type = e?.type || 'unknown';
      const payload = e?.payload;
      if (String(type).startsWith('llm/')) {
        console.log('[agentsService] LLM event', run.runId, type, payload ? JSON.parse(JSON.stringify(payload)) : undefined);
      } else if (type === 'run/log' || type === 'run/progress' || type === 'run/progress/snapshot' || type === 'run/snapshot' || type === 'run/heartbeat') {
        console.log('[agentsService] event', run.runId, type, payload?.message || '');
      } else if (type) {
        console.log('[agentsService] event', run.runId, type);
      } else {
        console.log('[agentsService] event', run.runId, e);
      }
    } catch (err) {
      console.warn('[agentsService] logEventVerbose error', (err as any)?.message || err);
    }
  }

  private appendMessage(run: RunRecord, msg: any, featureId: string) {

    if (!run.messagesLog){
      run.messagesLog = {}
    }
    let existing : AgentFeatureRunLog | undefined = run.messagesLog![featureId]
    if (!existing){
      existing = { startDate: new Date(), featureId, messages: [] }
      run.messagesLog[featureId] = existing
    }

    existing.messages.push({ ...msg });
  }

  private replaceMessages(run: RunRecord, messages: any[], featureId: string, isEnd: boolean = false) {
    if (!run.messagesLog){
      run.messagesLog = {}
    }
    let existing : AgentFeatureRunLog | undefined = run.messagesLog![featureId]
    if (!existing){
      existing = { startDate: new Date(), featureId, messages: [] }
      run.messagesLog[featureId] = existing
    }
    if (isEnd){
      existing.endDate = new Date()
    }

    const newMessages = []
    for(const m of messages){
      newMessages.push({ ...m})
    }
    existing.messages = newMessages
  }

  private deriveFeatureKey(e?: any): string {
    return `${e?.payload?.featureId || DEFAULT_FEATURE_KEY}`
  }

  private async fireCompletionNotifications(run: RunRecord) {
    try {
      const baseTitle = 'Agent finished';
      const parts: string[] = [];
      parts.push(`Agent ${run.agentType}`);
      parts.push(`task ${run.taskId}`);
      const message = parts.join(' • ');

      await notificationsService.create(run.projectId, {
        type: 'success',
        category: 'tasks',
        title: baseTitle,
        message,
        metadata: { taskId: run.taskId },
      } as any);

    } catch (err) {
      console.warn('[agentsService] Failed to create completion notifications', (err as any)?.message || err);
    }
  }

  private wireRunEvents(run: RunRecord) {
    const onAny = (e: any) => {
      this.logEventVerbose(run, e);
      run.updatedAt = getEventTs(e);
      const featureKey = this.deriveFeatureKey(e);

      // Conversation handling
      if (e.type === 'llm/messages/init') {
        const msgs = e.payload?.messages ?? [];
        this.replaceMessages(run, msgs, featureKey);
      } else if (e.type === 'llm/messages/snapshot') {
        const msgs = e.payload?.messages ?? [];
        this.replaceMessages(run, msgs, featureKey);
      } else if (e.type === 'llm/message') {
        const msg = e.payload?.message;
        if (msg) this.appendMessage(run, msg, featureKey);
      } else if (e.type === 'llm/messages/final') {
        const msgs = e.payload?.messages ?? [];
        this.replaceMessages(run, msgs, featureKey, true);
      }

      // Meta updates
      if (e.type === 'run/progress' || e.type === 'run/progress/snapshot') {
        run.message = e.payload?.message ?? run.message;
        if (typeof e.payload?.progress === 'number') {
          run.progress = e.payload.progress;
        } else if (typeof e.payload?.percent === 'number') {
          run.progress = Math.max(0, Math.min(1, e.payload.percent / 100));
        }
      } else if (e.type === 'run/usage') {
        run.costUSD = getCostUSD(e.payload) ?? run.costUSD;
        run.promptTokens = e.payload?.promptTokens ?? run.promptTokens;
        run.completionTokens = e.payload?.completionTokens ?? run.completionTokens;
        run.provider = e.payload?.provider ?? run.provider;
        run.model = e.payload?.model ?? run.model;
      } else if (e.type === 'run/start') {
        // initialize from start payload if present
        run.provider = e.payload?.llm?.provider ?? run.provider;
        run.model = e.payload?.llm?.model ?? run.model;
      } else if (e.type === 'run/snapshot') {
        // synchronize local state with snapshot from main
        const p = e.payload || {};
        run.message = p.message ?? run.message;
        if (typeof p.progress === 'number') run.progress = p.progress;
        if (p.costUSD != null) run.costUSD = p.costUSD;
        if (p.promptTokens != null) run.promptTokens = p.promptTokens;
        if (p.completionTokens != null) run.completionTokens = p.completionTokens;
        if (p.provider) run.provider = p.provider;
        if (p.model) run.model = p.model;
        if (p.state) run.state = p.state;
        if (p.startedAt) run.startedAt = p.startedAt;
      } else if (e.type === 'run/error') {
        run.state = 'error';
        run.message = e.payload?.message || e.payload?.error || 'Error';
      } else if (e.type === 'run/cancelled') {
        run.state = 'cancelled';
        run.message = e.payload?.reason || 'Cancelled';
      } else if (e.type === 'run/completed' || e.type === 'run/complete') {
        run.state = 'completed';
        run.message = e.payload?.message || e.payload?.summary || 'Completed';
        // Fire notifications for completion
        this.fireCompletionNotifications(run);
      }
      this.notify();
      if (run.state !== 'running') {
        try { run.events.close(); } catch {}
      }
    };
    run.events.addEventListener('*', onAny);
  }

  private getActiveLLMConfig(): LLMConfig | null {
    try {
      return this.llmManager.getActiveConfig() as unknown as LLMConfig;
    } catch {
      return null;
    }
  }

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

  async startTaskAgent(agentType: AgentType, projectId: string, taskId: string): Promise<AgentRun> {
    const llmConfig = this.getActiveLLMConfig();
    if (!llmConfig){
      throw new Error("NO ACTIVE LLM CONFIG") 
    }

    // Enforce default: when the task has no features, prefer speccer (global behavior)
    const effectiveAgentType = await this.coerceAgentTypeForTask(agentType, projectId, taskId);

    console.log('[agentsService] startTaskAgent', { agentType: effectiveAgentType, projectId, taskId, llmConfig: redactConfig(llmConfig) });
    const { handle, events } = await startTaskRun({ agentType: effectiveAgentType, projectId, taskId, llmConfig, options: {  } });
    const run: RunRecord = {
      runId: handle.id,
      agentType: effectiveAgentType,
      projectId,
      taskId,
      state: 'running',
      message: 'Starting agent... ',
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      provider: llmConfig?.provider,
      model: llmConfig?.model,
      messagesLog: {},
      events,
      cancel: (reason?: string) => handle.cancel(reason),
    } as RunRecord;

    this.wireRunEvents(run);

    this.runs.set(run.runId, run);
    this.notify();
    return this.publicFromRecord(run);
  }

  async startFeatureAgent(agentType: AgentType, projectId: string, taskId: string, featureId: string): Promise<AgentRun> {
    const llmConfig = this.getActiveLLMConfig();
    if (!llmConfig){
      throw new Error("NO ACTIVE LLM CONFIG") 
    }
    console.log('[agentsService] startFeatureAgent', { agentType, projectId, taskId, featureId, llmConfig: redactConfig(llmConfig) });
    const { handle, events } = await startFeatureRun({ agentType, projectId, taskId, featureId, llmConfig, options: { } });
    const run: RunRecord = {
      runId: handle.id,
      agentType,
      projectId,
      taskId,
      featureId,
      state: 'running',
      message: 'Starting agent... ',
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      provider: llmConfig?.provider,
      model: llmConfig?.model,
      messagesLog: {},
      events,
      cancel: (reason?: string) => handle.cancel(reason),
    } as RunRecord;

    this.wireRunEvents(run);

    this.runs.set(run.runId, run);
    this.notify();
    return this.publicFromRecord(run);
  }
}

export const agentsService = new AgentsServiceImpl();
