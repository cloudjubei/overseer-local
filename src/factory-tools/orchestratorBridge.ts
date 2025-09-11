/* Renderer-side bridge: talks to Electron preload (window.factory) instead of importing Node modules. */

import type { AgentType, LLMConfig } from 'thefactory-tools';
import { GithubCredentials, WebSearchApiKeys } from 'thefactory-tools/dist/types';

export type RunHandle = { id: string; cancel: (reason?: string) => void };

export type StartTaskRunParams = { agentType: AgentType, projectId: string; taskId: string; llmConfig: LLMConfig; githubCredentials: GithubCredentials; webSearchApiKeys?: WebSearchApiKeys; options?: Record<string, any> };
export type StartFeatureRunParams = StartTaskRunParams & { featureId: string };

function redactSecrets(llmConfig: LLMConfig) : any {
  try {
    const o = JSON.parse(JSON.stringify(llmConfig));
    if ('apiKey' in o) o.apiKey = '***';
    return o;
  } catch {
    return {};
  }
}

export async function startTaskRun(params: StartTaskRunParams): Promise<RunHandle> {
  if (!(window as any).factory) throw new Error('Factory preload not available');
  const { agentType, projectId, taskId, llmConfig, githubCredentials, webSearchApiKeys, options } = params;
  console.log('[factory:renderer] Starting task run', { agentType, projectId, taskId, llmConfig: redactSecrets(llmConfig), options });
  const res = await (window as any).factory.startTaskRun(agentType, projectId, taskId, llmConfig, githubCredentials, webSearchApiKeys, options ?? {});
  const runId: string = res?.runId;
  if (!runId) throw new Error('Failed to start task run: missing runId');
  return { id: runId, cancel: (reason?: string) => (window as any).factory.cancelRun(runId, reason) };
}

export async function startFeatureRun(params: StartFeatureRunParams): Promise<RunHandle> {
  if (!(window as any).factory) throw new Error('Factory preload not available');
  const { agentType, projectId, taskId, featureId, llmConfig, githubCredentials, webSearchApiKeys, options } = params;
  console.log('[factory:renderer] Starting feature run', { agentType, projectId, taskId, featureId, llmConfig: redactSecrets(llmConfig), options });
  const res = await (window as any).factory.startFeatureRun(agentType, projectId, taskId, featureId, llmConfig, githubCredentials, webSearchApiKeys, options ?? {});
  const runId: string = res?.runId;
  if (!runId) throw new Error('Failed to start feature run: missing runId');
  return { id: runId, cancel: (reason?: string) => (window as any).factory.cancelRun(runId, reason) };
}

export async function startRunGeneric(params: StartTaskRunParams & { featureId?: string }) {
  if (params.featureId != null) return startFeatureRun(params as StartFeatureRunParams);
  if (params.taskId != null) return startTaskRun(params);
  throw new Error('taskId or featureId required');
}

export function attachToRun(runId: string): RunHandle {
  if (!(window as any).factory) throw new Error('Factory preload not available');
  return { id: runId, cancel: (reason?: string) => (window as any).factory.cancelRun(runId, reason) }
}

export async function deleteHistoryRun(runId: string): Promise<void> {
  await (window as any).factory?.deleteRun?.(runId);
}
