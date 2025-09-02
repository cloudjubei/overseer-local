/* Renderer-side bridge: talks to Electron preload (window.factory) instead of importing Node modules. */

export type EventSourceLike = {
  addEventListener: (type: string, handler: (e: any) => void) => void;
  close: () => void;
};

export type RunHandle = { id: string; cancel: (reason?: string) => void };

export type StartTaskRunParams = { projectId: string; taskId: string | number; options?: Record<string, any> };
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
          if (e?.type) console.log('[factory:renderer] event', runId, e.type);
          if (String(e?.type || '').startsWith('llm/')) {
            try { console.log('[factory:renderer] LLM event', runId, e.type, e?.payload ? JSON.parse(JSON.stringify(e.payload)) : undefined); } catch {}
          }
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

function redactOptions(options?: Record<string, any>) {
  if (!options) return {};
  try {
    const o = JSON.parse(JSON.stringify(options));
    if (o.llmConfig && typeof o.llmConfig === 'object') {
      if ('apiKey' in o.llmConfig) o.llmConfig.apiKey = '***';
    }
    return o;
  } catch {
    return {};
  }
}

export async function startTaskRun(params: StartTaskRunParams): Promise<{ handle: RunHandle; events: EventSourceLike }> {
  if (!(window as any).factory) throw new Error('Factory preload not available');
  const { projectId, taskId, options } = params;
  console.log('[factory:renderer] Starting task run', { projectId, taskId: String(taskId), options: redactOptions(options) });
  const res = await (window as any).factory.startTaskRun(projectId, String(taskId), options ?? {});
  const runId: string = res?.runId;
  if (!runId) throw new Error('Failed to start task run: missing runId');
  const handle: RunHandle = { id: runId, cancel: (reason?: string) => (window as any).factory.cancelRun(runId, reason) } as any;
  const events = makeEventSourceLike(runId);
  return { handle, events };
}

export async function startFeatureRun(params: StartFeatureRunParams): Promise<{ handle: RunHandle; events: EventSourceLike }> {
  if (!(window as any).factory) throw new Error('Factory preload not available');
  const { projectId, taskId, featureId, options } = params;
  console.log('[factory:renderer] Starting feature run', { projectId, taskId: String(taskId), featureId: String(featureId), options: redactOptions(options) });
  const res = await (window as any).factory.startFeatureRun(projectId, String(taskId), String(featureId), options ?? {});
  const runId: string = res?.runId;
  if (!runId) throw new Error('Failed to start feature run: missing runId');
  const handle: RunHandle = { id: runId, cancel: (reason?: string) => (window as any).factory.cancelRun(runId, reason) } as any;
  const events = makeEventSourceLike(runId);
  return { handle, events };
}

export async function startRunGeneric(params: { projectId: string; taskId?: string | number; featureId?: string | number; options?: Record<string, any> }) {
  if (params.featureId != null) return startFeatureRun(params as any);
  if (params.taskId != null) return startTaskRun(params as any);
  throw new Error('taskId or featureId required');
}

export function streamRunJSONL(_handle: RunHandle) {
  throw new Error('streamRunJSONL is not available in renderer. Use main/CLI.');
}
