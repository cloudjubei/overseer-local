import { EventSourceLike } from '../../tools/factory/orchestratorBridge';
import { startTaskRun, startFeatureRun } from '../../tools/factory/orchestratorBridge';

export type AgentRunState = 'running' | 'completed' | 'cancelled' | 'error';

export type AgentRun = {
  runId: string;
  projectId: string;
  taskId?: string;
  featureId?: string;
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
};

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
  // Support both costUSD and costUsd
  return payload.costUSD ?? payload.costUsd ?? payload.usd ?? undefined;
}

class AgentsServiceImpl {
  private runs = new Map<string, RunRecord>();
  private subscribers = new Set<Subscriber>();

  private notify() {
    const list = Array.from(this.runs.values()).map(this.publicFromRecord);
    for (const cb of this.subscribers) cb(list);
  }

  private publicFromRecord(rec: RunRecord): AgentRun {
    const { events: _ev, cancel: _c, ...pub } = rec as any;
    return pub as AgentRun;
  }

  subscribe(cb: Subscriber): () => void {
    this.subscribers.add(cb);
    // initial push
    cb(Array.from(this.runs.values()).map(this.publicFromRecord));
    return () => {
      this.subscribers.delete(cb);
    };
  }

  list(): AgentRun[] {
    return Array.from(this.runs.values()).map(this.publicFromRecord);
  }

  cancelRun(runId: string) {
    const rec = this.runs.get(runId);
    console.log('[agentsService] cancelRun', { runId, known: !!rec });
    if (!rec) return;
    try { rec.cancel('User requested'); } catch (err) { console.warn('[agentsService] cancel error', err?.message || err); }
    rec.state = 'cancelled';
    rec.updatedAt = new Date().toISOString();
    this.notify();
  }

  private wireRunEvents(run: RunRecord) {
    const onAny = (e: any) => {
      console.log('[agentsService] event', run.runId, e?.type);
      run.updatedAt = getEventTs(e);
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
      } else if (e.type === 'run/error') {
        run.state = 'error';
        run.message = e.payload?.message || 'Error';
      } else if (e.type === 'run/cancelled') {
        run.state = 'cancelled';
        run.message = e.payload?.reason || 'Cancelled';
      } else if (e.type === 'run/completed' || e.type === 'run/complete') {
        run.state = 'completed';
        run.message = e.payload?.message || e.payload?.summary || 'Completed';
      }
      this.notify();
      if (run.state !== 'running') {
        // auto close listener
        try { run.events.close(); } catch {}
      }
    };
    run.events.addEventListener('*', onAny);
  }

  startTaskAgent(projectId: string, taskId: string): AgentRun {
    console.log('[agentsService] startTaskAgent', { projectId, taskId });
    const { handle, events } = startTaskRun({ projectId, taskId });
    const run: RunRecord = {
      runId: handle.id,
      projectId,
      taskId: String(taskId),
      state: 'running',
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      events,
      cancel: (reason?: string) => handle.cancel(reason),
    } as RunRecord;

    this.wireRunEvents(run);

    this.runs.set(run.runId, run);
    this.notify();
    return this.publicFromRecord(run);
  }

  startFeatureAgent(projectId: string, taskId: string, featureId: string): AgentRun {
    console.log('[agentsService] startFeatureAgent', { projectId, taskId, featureId });
    const { handle, events } = startFeatureRun({ projectId, taskId, featureId });
    const run: RunRecord = {
      runId: handle.id,
      projectId,
      taskId: String(taskId),
      featureId: String(featureId),
      state: 'running',
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
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
