import { DefaultRunHandle, SimpleEventBus, makeRunId } from './events/runtime';
import { RunEvent, RunHandle } from './events/types';
import { toISO } from './events/types';

export type LLMConfig = {
  provider?: string;
  model?: string;
  apiKeyEnv?: string;
  temperature?: number;
  maxTokens?: number;
};

export type StartRunParams = {
  projectId: string;
  taskId?: string | number;
  featureId?: string | number;
  llmConfig?: LLMConfig;
  budgetUSD?: number;
  metadata?: Record<string, unknown>;
};

export function startRun(params: StartRunParams): RunHandle {
  const bus = new SimpleEventBus();
  const id = makeRunId('run');
  const handle = new DefaultRunHandle(id, bus);

  const runId = handle.id;
  const startEvent: RunEvent = {
    type: 'run/started',
    time: toISO(),
    runId,
    payload: {
      projectId: params.projectId,
      taskId: params.taskId != null ? String(params.taskId) : undefined,
      featureId: params.featureId != null ? String(params.featureId) : undefined,
      meta: {
        llm: params.llmConfig?.model,
        budgetUSD: params.budgetUSD,
        ...(params.metadata ?? {}),
      },
    },
  };
  bus.emit(startEvent);

  // Simulated lifecycle: progress -> usage -> completed (or cancelled)
  let cancelled = false;
  const unsubscribe = handle.onEvent((e) => {
    if (e.type === 'run/cancelled') cancelled = true;
  });

  queueMicrotask(() => {
    if (cancelled) return;
    bus.emit({
      type: 'run/progress',
      time: toISO(),
      runId,
      payload: { message: 'Initializing', step: 'init', progress: 0.1 },
    });
  });

  setTimeout(() => {
    if (cancelled) return;
    bus.emit({
      type: 'run/progress',
      time: toISO(),
      runId,
      payload: { message: 'Loading project/task', step: 'load', progress: 0.4 },
    });
  }, 50);

  setTimeout(() => {
    if (cancelled) return;
    bus.emit({
      type: 'run/usage',
      time: toISO(),
      runId,
      payload: { requests: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, costUSD: 0 },
    });
  }, 80);

  setTimeout(() => {
    if (cancelled) return;
    bus.emit({
      type: 'run/progress',
      time: toISO(),
      runId,
      payload: {
        message: params.featureId != null ? `Running feature ${params.featureId}` : (params.taskId != null ? `Running task ${params.taskId}` : 'Running'),
        step: 'execute',
        progress: 0.8,
      },
    });
  }, 120);

  setTimeout(() => {
    if (cancelled) return;
    bus.emit({
      type: 'run/completed',
      time: toISO(),
      runId,
      payload: { success: true, usage: { requests: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, costUSD: 0 }, message: 'Run complete' },
    });
    unsubscribe();
  }, 180);

  return handle;
}

export function runTask(params: { projectId: string; taskId: string | number; llmConfig?: LLMConfig; budgetUSD?: number; metadata?: Record<string, unknown> }): RunHandle {
  return startRun({ ...params });
}

export function runFeature(params: { projectId: string; taskId: string | number; featureId: string | number; llmConfig?: LLMConfig; budgetUSD?: number; metadata?: Record<string, unknown> }): RunHandle {
  return startRun({ ...params });
}
