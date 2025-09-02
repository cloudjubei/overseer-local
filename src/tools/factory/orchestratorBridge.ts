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
      console.log('[factory:renderer] Subscribing to run events', { runId });
      // subscribe via preload
      unsubscribe = (window as any).factory.subscribe(runId, (e: any) => {
        try {
          // Light trace for events
          if (e?.type) console.log('[factory:renderer] event', runId, e.type);
        } catch {}
        onAny?.(e);
      });
    },
    close: () => {
      console.log('[factory:renderer] Closing event subscription', { runId });
      try { unsubscribe?.(); } catch {}
      unsubscribe = null;
      onAny = null;
    },
  };
}

export function startTaskRun(params: StartTaskRunParams): { handle: RunHandle; events: EventSourceLike } {
  if (!(window as any).factory) throw new Error('Factory preload not available');
  const { projectId, taskId } = params;
  console.log('[factory:renderer] Starting task run', { projectId, taskId: String(taskId) });
  const { runId } = (window as any).factory.startTaskRun(projectId, String(taskId));
  const handle: RunHandle = { id: runId, cancel: (reason?: string) => (window as any).factory.cancelRun(runId, reason) } as any;
  const events = makeEventSourceLike(runId);
  return { handle, events };
}

export function startFeatureRun(params: StartFeatureRunParams): { handle: RunHandle; events: EventSourceLike } {
  if (!(window as any).factory) throw new Error('Factory preload not available');
  const { projectId, taskId, featureId } = params;
  console.log('[factory:renderer] Starting feature run', { projectId, taskId: String(taskId), featureId: String(featureId) });
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
