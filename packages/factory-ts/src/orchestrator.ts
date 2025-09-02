import { randomUUID } from 'node:crypto';
import { createRunHandle, RunHandle, RunMetadata, RunState, StepInfo, StepState } from './events';
import { loadProject, loadTask, LoaderOptions } from './loaders/projectLoader';
import { makeLLMClient, LLMClientOrConfig } from './llm/factory';
import { UsageAccumulator } from './llm/types';
import { openAICostTable } from './llm/costs';

export interface RunOptions {
  rootDir?: string; // override repo root detection
  signal?: AbortSignal; // external cancellation
  labels?: Record<string, string>;
}

export interface RunTaskParams {
  projectId: string;
  taskId: string | number;
  llmConfig: LLMClientOrConfig;
  options?: RunOptions;
}

export interface RunFeatureParams extends RunTaskParams {
  featureId: string | number;
}

// Internal active runs registry for lifecycle and concurrency-safety
const activeRuns = new Map<string, { handle: RunHandle; controller: AbortController; done: Promise<void> }>();

function nowISO() {
  return new Date().toISOString();
}

function stepStarted(runId: string, handle: RunHandle, name: string, index: number, description?: string): StepInfo {
  const step: StepInfo = {
    stepId: randomUUID(),
    name,
    description,
    index,
    createdAt: nowISO(),
  };
  const state: StepState = { status: 'running', updatedAt: nowISO() };
  handle.bus.emit('step:started', { runId, step, state });
  return step;
}

function stepCompleted(runId: string, handle: RunHandle, stepId: string) {
  const state: StepState = { status: 'completed', updatedAt: nowISO(), progress: 1 };
  handle.bus.emit('step:updated', { runId, stepId, state });
}

function stepErrored(runId: string, handle: RunHandle, stepId: string, message: string) {
  const state: StepState = { status: 'error', updatedAt: nowISO() };
  handle.bus.emit('step:updated', { runId, stepId, state });
  handle.bus.emit('error', { runId, stepId, message, occurredAt: nowISO() });
}

async function withAbort<T>(signal: AbortSignal, fn: () => Promise<T>): Promise<T> {
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  return await fn();
}

async function startRunLifecycle(runId: string, handle: RunHandle, meta: RunMetadata, initial: RunState) {
  handle.bus.emit('run:started', { meta, state: initial });
}

function finalizeRun(runId: string, handle: RunHandle, state: RunState, cancelled: boolean) {
  if (cancelled) {
    handle.bus.emit('run:cancelled', { runId, state });
  } else if (state.status === 'error') {
    // No explicit run:error event in spec; emit run:updated with error state then completed for closure
    handle.bus.emit('run:updated', { runId, state });
    handle.bus.emit('run:completed', { runId, state });
  } else {
    handle.bus.emit('run:completed', { runId, state });
  }
  handle.bus.removeAllListeners();
}

export async function runTask(params: RunTaskParams): Promise<RunHandle> {
  return internalRun({ ...params, featureId: undefined });
}

export async function runFeature(params: RunFeatureParams): Promise<RunHandle> {
  return internalRun(params);
}

async function internalRun(params: RunTaskParams & { featureId?: string | number }): Promise<RunHandle> {
  const runId = randomUUID();
  const controller = new AbortController();
  const signal = controller.signal;
  const { handle } = createRunHandle(runId, {
    onCancel: () => controller.abort(),
  });

  // Propagate external signal to internal controller
  if (params.options?.signal) {
    if (params.options.signal.aborted) controller.abort();
    else params.options.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  // Register active run atomically
  activeRuns.set(runId, { handle, controller, done: Promise.resolve() });

  const loaderOptions: LoaderOptions = { rootDir: params.options?.rootDir };

  const meta: RunMetadata = {
    runId,
    projectId: params.projectId,
    taskId: String(params.taskId),
    featureId: params.featureId != null ? String(params.featureId) : undefined,
    llmModel: typeof (params.llmConfig as any)?.model === 'string' ? (params.llmConfig as any).model : undefined,
    createdAt: nowISO(),
  };

  let state: RunState = {
    status: 'running',
    usage: undefined,
    updatedAt: nowISO(),
    labels: params.options?.labels,
  };

  await startRunLifecycle(runId, handle, meta, state);

  // Begin async execution; do not await here to allow immediate return of handle
  const done = (async () => {
    const usageAcc = new UsageAccumulator(meta.llmModel ?? '', openAICostTable);

    try {
      // Step 1: Load Project
      const s1 = stepStarted(runId, handle, 'load:project', 0, `Load project ${params.projectId}`);
      const loadedProject = await withAbort(signal, () => loadProject(params.projectId, loaderOptions));
      stepCompleted(runId, handle, s1.stepId);

      // Step 2: Load Task
      const s2 = stepStarted(runId, handle, 'load:task', 1, `Load task ${params.taskId}`);
      const loadedTask = await withAbort(signal, () => loadTask(params.projectId, params.taskId, loaderOptions));
      stepCompleted(runId, handle, s2.stepId);

      // Step 3: Prepare LLM client
      const s3 = stepStarted(runId, handle, 'prepare:llm', 2, 'Instantiate LLM client');
      const llmClient = await withAbort(signal, () => makeLLMClient(params.llmConfig));
      // Update metadata with resolved model if not set
      if (!meta.llmModel) meta.llmModel = llmClient.model;
      stepCompleted(runId, handle, s3.stepId);

      // Emit a usage snapshot (likely zero initially)
      const snap = llmClient.getUsage();
      usageAcc.add({ promptTokens: snap.promptTokens, completionTokens: snap.completionTokens, totalTokens: snap.totalTokens, isEstimated: snap.isEstimated });
      handle.bus.emit('usage:updated', {
        runId,
        usage: { promptTokens: snap.promptTokens, completionTokens: snap.completionTokens, totalTokens: snap.totalTokens, costUSD: snap.cost.totalCostUSD ?? undefined },
        costs: { totalUSD: snap.cost.totalCostUSD ?? undefined, models: meta.llmModel ? { [meta.llmModel]: snap.cost.totalCostUSD ?? 0 } : undefined },
        updatedAt: nowISO(),
      });

      // Step 4: Execute (placeholder)
      const s4 = stepStarted(runId, handle, 'execute', 3, params.featureId ? `Run feature ${params.featureId}` : 'Run task');
      // Placeholder no-op: In future, connect to agent engine passing run handle and llmClient
      // Respect cancellation while simulating a short execution tick
      await withAbort(signal, async () => {
        // brief yield to simulate start
        await new Promise((r) => setTimeout(r, 0));
      });
      stepCompleted(runId, handle, s4.stepId);

      // Mark run completed
      state = { ...state, status: 'completed', updatedAt: nowISO() };
      finalizeRun(runId, handle, state, false);
    } catch (err: any) {
      if (signal.aborted) {
        state = { ...state, status: 'cancelled', updatedAt: nowISO() };
        finalizeRun(runId, handle, state, true);
      } else {
        const message = err?.message ? String(err.message) : 'Unknown error';
        handle.bus.emit('error', { runId, message, occurredAt: nowISO(), stack: err?.stack });
        state = { ...state, status: 'error', updatedAt: nowISO(), summary: message };
        finalizeRun(runId, handle, state, false);
      }
    } finally {
      // Cleanup registry
      const rec = activeRuns.get(runId);
      if (rec) activeRuns.delete(runId);
    }
  })();

  // Update registry with actual done promise
  const record = activeRuns.get(runId);
  if (record) activeRuns.set(runId, { ...record, done });

  return handle;
}

export function getActiveRuns(): Array<{ runId: string; handle: RunHandle }> {
  return Array.from(activeRuns.entries()).map(([runId, { handle }]) => ({ runId, handle }));
}

export async function cancelRun(runId: string): Promise<boolean> {
  const rec = activeRuns.get(runId);
  if (!rec) return false;
  rec.controller.abort();
  try { await rec.done; } catch { /* ignore */ }
  return true;
}
