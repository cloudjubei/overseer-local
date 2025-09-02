/* Renderer-side bridge: talks to Electron preload (window.factory) instead of importing Node modules. */

export type EventSourceLike = {
  addEventListener: (type: string, handler: (e: any) => void) => void;
  close: () => void;
};

export type RunHandle = { id: string; cancel: (reason?: string) => void };

export type StartTaskRunParams = { projectId: string; taskId: string | number };
export type StartFeatureRunParams = StartTaskRunParams & { featureId: string | number };

function makeEventSourceLike(runId: string): EventSourceLike {
  let onAny: ((e: any) => void) | null = null;
  let unsubscribe: (() => void) | null = null;
  return {
    addEventListener: (_type: string, handler: (e: any) => void) => {
      onAny = handler;
      // subscribe via preload
      unsubscribe = (window as any).factory.subscribe(runId, (e: any) => {
        onAny?.(e);
      });
    },
    close: () => {
      unsubscribe?.();
      unsubscribe = null;
      onAny = null;
    },
  };
}

export function startTaskRun(params: StartTaskRunParams): { handle: RunHandle; events: EventSourceLike } {
  if (!(window as any).factory) throw new Error('Factory preload not available');
  const { projectId, taskId } = params;
  const { runId } = (window as any).factory.startTaskRun(projectId, String(taskId));
  const handle: RunHandle = { id: runId, cancel: (reason?: string) => (window as any).factory.cancelRun(runId, reason) } as any;
  const events = makeEventSourceLike(runId);
  return { handle, events };
}

export function startFeatureRun(params: StartFeatureRunParams): { handle: RunHandle; events: EventSourceLike } {
  if (!(window as any).factory) throw new Error('Factory preload not available');
  const { projectId, taskId, featureId } = params;
  const { runId } = (window as any).factory.startFeatureRun(projectId, String(taskId), String(featureId));
  const handle: RunHandle = { id: runId, cancel: (reason?: string) => (window as any).factory.cancelRun(runId, reason) } as any;
  const events = makeEventSourceLike(runId);
  return { handle, events };
}

export function startRunGeneric(params: { projectId: string; taskId?: string | number; featureId?: string | number }) {
  if (params.featureId != null) return startFeatureRun(params as any);
  if (params.taskId != null) return startTaskRun(params as any);
  throw new Error('taskId or featureId required');
}

export function streamRunJSONL(_handle: RunHandle) {
  throw new Error('streamRunJSONL is not available in renderer. Use main/CLI.');
}
