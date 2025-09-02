/* App-facing bridge for Factory TS orchestrator. */
import { startRun, runTask, runFeature } from '../../../packages/factory-ts/src/orchestrator';
import { toEventSourceLike, streamJSONL } from '../../../packages/factory-ts/src/adapters/electronShim';
import type { EventSourceLike } from '../../../packages/factory-ts/src/adapters/electronShim';
import type { RunHandle } from '../../../packages/factory-ts/src/events/types';

export type StartTaskRunParams = {
  projectId: string;
  taskId: string | number;
};

export type StartFeatureRunParams = StartTaskRunParams & { featureId: string | number };

export function startTaskRun(params: StartTaskRunParams): { handle: RunHandle; events: EventSourceLike } {
  const handle = runTask(params);
  const events = toEventSourceLike(handle);
  return { handle, events };
}

export function startFeatureRun(params: StartFeatureRunParams): { handle: RunHandle; events: EventSourceLike } {
  const handle = runFeature(params);
  const events = toEventSourceLike(handle);
  return { handle, events };
}

export function startRunGeneric(params: { projectId: string; taskId?: string | number; featureId?: string | number }) {
  const handle = startRun(params);
  const events = toEventSourceLike(handle);
  return { handle, events };
}

export function streamRunJSONL(handle: RunHandle) {
  return streamJSONL(handle);
}
