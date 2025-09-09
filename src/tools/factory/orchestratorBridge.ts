/* Renderer-side bridge: talks to Electron preload (window.factory) instead of importing Node modules. */

import type { AgentType, LLMConfig } from 'thefactory-tools';
import { GithubCredentials, WebSearchApiKeys } from 'thefactory-tools/dist/types';

export type EventSourceLike = {
  addEventListener: (type: string, handler: (e: any) => void) => void;
  close: () => void;
};

export type RunHandle = { id: string; cancel: (reason?: string) => void };

export type StartTaskRunParams = { agentType: AgentType, projectId: string; taskId: string; llmConfig: LLMConfig; githubCredentials: GithubCredentials; webSearchApiKeys?: WebSearchApiKeys; options?: Record<string, any> };
export type StartFeatureRunParams = StartTaskRunParams & { featureId: string };

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

function redactSecrets(llmConfig: LLMConfig) : any {
  try {
    const o = JSON.parse(JSON.stringify(llmConfig));
    if ('apiKey' in o) o.apiKey = '***';
    return o;
  } catch {
    return {};
  }
}

export async function startTaskRun(params: StartTaskRunParams): Promise<{ handle: RunHandle; events: EventSourceLike }> {
  if (!(window as any).factory) throw new Error('Factory preload not available');
  const { agentType, projectId, taskId, llmConfig, githubCredentials, webSearchApiKeys, options } = params;
  console.log('[factory:renderer] Starting task run', { agentType, projectId, taskId, llmConfig: redactSecrets(llmConfig), options });
  const res = await (window as any).factory.startTaskRun(agentType, projectId, taskId, llmConfig, githubCredentials, webSearchApiKeys, options ?? {});
  const runId: string = res?.runId;
  if (!runId) throw new Error('Failed to start task run: missing runId');
  const handle: RunHandle = { id: runId, cancel: (reason?: string) => (window as any).factory.cancelRun(runId, reason) } as any;
  const events = makeEventSourceLike(runId);
  return { handle, events };
}

export async function startFeatureRun(params: StartFeatureRunParams): Promise<{ handle: RunHandle; events: EventSourceLike }> {
  if (!(window as any).factory) throw new Error('Factory preload not available');
  const { agentType, projectId, taskId, featureId, llmConfig, githubCredentials, webSearchApiKeys, options } = params;
  console.log('[factory:renderer] Starting feature run', { agentType, projectId, taskId, featureId, llmConfig: redactSecrets(llmConfig), options });
  const res = await (window as any).factory.startFeatureRun(agentType, projectId, taskId, featureId, llmConfig, githubCredentials, webSearchApiKeys, options ?? {});
  const runId: string = res?.runId;
  if (!runId) throw new Error('Failed to start feature run: missing runId');
  const handle: RunHandle = { id: runId, cancel: (reason?: string) => (window as any).factory.cancelRun(runId, reason) } as any;
  const events = makeEventSourceLike(runId);
  return { handle, events };
}

export async function startRunGeneric(params: StartTaskRunParams & { featureId?: string }) {
  if (params.featureId != null) return startFeatureRun(params as StartFeatureRunParams);
  if (params.taskId != null) return startTaskRun(params);
  throw new Error('taskId or featureId required');
}

export function attachToRun(runId: string): { handle: RunHandle; events: EventSourceLike } {
  if (!(window as any).factory) throw new Error('Factory preload not available');
  const handle: RunHandle = { id: runId, cancel: (reason?: string) => (window as any).factory.cancelRun(runId, reason) } as any;
  const events = makeEventSourceLike(runId);
  return { handle, events };
}

export function streamRunJSONL(_handle: RunHandle) {
  throw new Error('streamRunJSONL is not available in renderer. Use main/CLI.');
}

export async function deleteHistoryRun(runId: string): Promise<void> {
  await (window as any).factory?.deleteRun?.(runId);
}
