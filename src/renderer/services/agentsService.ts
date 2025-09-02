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
  startedAt: string; // ISO
  updatedAt: string; // ISO
};

// Internal structure to keep handle + eventSource
interface RunRecord extends AgentRun {
  events: EventSourceLike;
  cancel: (reason?: string) => void;
}

type Subscriber = (runs: AgentRun[]) => void;

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
    if (!rec) return;
    try { rec.cancel('User requested'); } catch {}
    rec.state = 'cancelled';
    rec.updatedAt = new Date().toISOString();
    this.notify();
  }

  startTaskAgent(projectId: string, taskId: string): AgentRun {
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

    // wire events
    const onAny = (e: any) => {
      run.updatedAt = e.time || new Date().toISOString();
      if (e.type === 'run/progress' || e.type === 'run/progress/snapshot') {
        run.message = e.payload?.message;
        run.progress = e.payload?.progress ?? run.progress;
      } else if (e.type === 'run/usage') {
        run.costUSD = e.payload?.costUSD ?? run.costUSD;
        run.promptTokens = e.payload?.promptTokens ?? run.promptTokens;
        run.completionTokens = e.payload?.completionTokens ?? run.completionTokens;
      } else if (e.type === 'run/error') {
        run.state = 'error';
        run.message = e.payload?.message || 'Error';
      } else if (e.type === 'run/cancelled') {
        run.state = 'cancelled';
        run.message = e.payload?.reason || 'Cancelled';
      } else if (e.type === 'run/completed') {
        run.state = 'completed';
        // Prefer summary message if present
        run.message = e.payload?.message || 'Completed';
      }
      this.notify();
      if (run.state !== 'running') {
        // auto close listener
        try { run.events.close(); } catch {}
      }
    };
    events.addEventListener('*', onAny);

    this.runs.set(run.runId, run);
    this.notify();
    return this.publicFromRecord(run);
  }

  startFeatureAgent(projectId: string, taskId: string, featureId: string): AgentRun {
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

    const onAny = (e: any) => {
      run.updatedAt = e.time || new Date().toISOString();
      if (e.type === 'run/progress' || e.type === 'run/progress/snapshot') {
        run.message = e.payload?.message;
        run.progress = e.payload?.progress ?? run.progress;
      } else if (e.type === 'run/usage') {
        run.costUSD = e.payload?.costUSD ?? run.costUSD;
        run.promptTokens = e.payload?.promptTokens ?? run.promptTokens;
        run.completionTokens = e.payload?.completionTokens ?? run.completionTokens;
      } else if (e.type === 'run/error') {
        run.state = 'error';
        run.message = e.payload?.message || 'Error';
      } else if (e.type === 'run/cancelled') {
        run.state = 'cancelled';
        run.message = e.payload?.reason || 'Cancelled';
      } else if (e.type === 'run/completed') {
        run.state = 'completed';
        run.message = e.payload?.message || 'Completed';
      }
      this.notify();
      if (run.state !== 'running') {
        try { run.events.close(); } catch {}
      }
    };
    events.addEventListener('*', onAny);

    this.runs.set(run.runId, run);
    this.notify();
    return this.publicFromRecord(run);
  }
}

export const agentsService = new AgentsServiceImpl();
