import path from 'node:path';
import { EventEmitter } from 'node:events';
import { taskUtils as defaultTaskUtils, TaskUtils } from './taskUtils.js';
import GitManager from './git/gitManager.js';
import { runAgentOnTask, runAgentOnFeature } from './orchestrator.js';
import { createCompletionClient, type CompletionClient } from './completion.js';

export type LLMConfig = {
  model: string;
  provider?: string; // e.g., openai, azure, together, groq, openrouter, ollama, custom
  apiKey?: string;
  baseURL?: string;
  // extra provider fields (azure etc.) tolerated
  [key: string]: any;
};

export type StartRunCommon = {
  projectId?: string;
  taskId: string;
  llmConfig: LLMConfig;
  budgetUSD?: number;
  metadata?: Record<string, any>;
};

export type StartTaskRunArgs = StartRunCommon & {
  // For task-level runs we need to know which agent to use; default developer
  agent?: 'developer' | 'tester' | 'planner' | 'contexter' | 'speccer';
};

export type StartFeatureRunArgs = StartRunCommon & {
  featureId: string;
  agent?: 'developer' | 'tester' | 'planner' | 'contexter' | 'speccer';
};

export type RunEvent = { type: string; payload?: any };
export type Unsubscribe = () => void;

export interface RunHandle {
  id: string;
  onEvent(cb: (e: RunEvent) => void): Unsubscribe;
  cancel(reason?: string): void;
}

export interface HistoryStore { /* placeholder for future persistence */ }

export function createHistoryStore(_opts: { dbPath: string }): HistoryStore {
  // No-op stub to satisfy Electron integration; implement later
  return {} as HistoryStore;
}

function makeId(prefix: string) { return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`; }

function buildCompletion(llmConfig: LLMConfig): CompletionClient {
  // Delegate to completion.ts factory; tolerate missing fields
  return createCompletionClient(llmConfig);
}

function attachLLMLogging(comp: CompletionClient, emit: (e: RunEvent) => void): CompletionClient {
  // Wrap the completion client to emit llm events
  const wrapped: CompletionClient = async (req) => {
    emit({ type: 'llm/request', payload: { model: req.model } });
    try {
      const res = await comp(req);
      emit({ type: 'llm/response', payload: { model: req.model, message: res.message } });
      return res;
    } catch (err) {
      emit({ type: 'llm/error', payload: { error: String((err as Error)?.message || err) } });
      throw err;
    }
  };
  return wrapped;
}

export function createOrchestrator(opts: { projectRoot?: string; history?: HistoryStore }) {
  const projectRoot = path.resolve(opts.projectRoot || process.cwd());

  // A run registry
  const runs = new Map<string, { ee: EventEmitter; cancelled: boolean; cancel: (r?: string) => void }>();

  function newRunHandle(prefix: string): { id: string; ee: EventEmitter; handle: RunHandle; signalCancelled: () => boolean } {
    const id = makeId(prefix);
    const ee = new EventEmitter();
    let cancelled = false;
    const handle: RunHandle = {
      id,
      onEvent: (cb) => {
        const fn = (e: RunEvent) => cb(e);
        ee.on('event', fn);
        return () => { try { ee.off('event', fn); } catch {} };
      },
      cancel: (reason?: string) => {
        if (!cancelled) {
          cancelled = true;
          ee.emit('event', { type: 'run/cancelled', payload: { reason } } satisfies RunEvent);
        }
      }
    };
    runs.set(id, { ee, cancelled, cancel: handle.cancel });
    return { id, ee, handle, signalCancelled: () => cancelled };
  }

  function makeTooling() {
    // Clone task utils with project root set
    const tools: TaskUtils = { ...defaultTaskUtils } as TaskUtils;
    tools.setProjectRoot(projectRoot);
    return tools;
  }

  function makeGit(branchHint?: string) {
    return new GitManager(projectRoot, branchHint);
  }

  async function ensureBranch(git: GitManager, taskId: string, ee: EventEmitter) {
    const branch = `features/${taskId}`;
    try {
      ee.emit('event', { type: 'run/log', payload: { message: `Checking out branch ${branch}` } } satisfies RunEvent);
      await git.checkoutBranch(branch, true);
    } catch (e) {
      ee.emit('event', { type: 'run/log', payload: { message: `Branch checkout/create failed, retrying without create: ${String(e)}` } } satisfies RunEvent);
      try { await git.checkoutBranch(branch, false); } catch {}
    }
    try { await git.pull(branch); } catch {}
  }

  function getAgentFromArgs(args: { agent?: any; metadata?: any }, fallback: any = 'developer') {
    return args.agent || args.metadata?.agent || fallback;
  }

  function startTaskRun(args: StartTaskRunArgs): RunHandle {
    const { id, ee, handle } = newRunHandle('task');
    (async () => {
      ee.emit('event', { type: 'run/start', payload: { scope: 'task', id, taskId: args.taskId, llm: { model: args.llmConfig?.model } } } satisfies RunEvent);
      try {
        const tools = makeTooling();
        const git = makeGit();
        await ensureBranch(git, args.taskId, ee);

        const completion = attachLLMLogging(buildCompletion(args.llmConfig), (e) => ee.emit('event', e));
        const agent = getAgentFromArgs(args, 'developer');

        // Load task then run agent on task
        const task = await tools.getTask(args.taskId);
        await runAgentOnTask(args.llmConfig.model, agent, task, tools, git, completion);

        ee.emit('event', { type: 'run/completed', payload: { ok: true } } satisfies RunEvent);
      } catch (err) {
        ee.emit('event', { type: 'run/error', payload: { error: String((err as Error)?.stack || err) } } satisfies RunEvent);
      } finally {
        ee.emit('event', { type: 'run/complete' } satisfies RunEvent);
      }
    })();
    return handle;
  }

  function startFeatureRun(args: StartFeatureRunArgs): RunHandle {
    const { id, ee, handle } = newRunHandle('feature');
    (async () => {
      ee.emit('event', { type: 'run/start', payload: { scope: 'feature', id, taskId: args.taskId, featureId: args.featureId, llm: { model: args.llmConfig?.model } } } satisfies RunEvent);
      try {
        const tools = makeTooling();
        const git = makeGit();
        await ensureBranch(git, args.taskId, ee);

        const completion = attachLLMLogging(buildCompletion(args.llmConfig), (e) => ee.emit('event', e));
        const agent = getAgentFromArgs(args, 'developer');

        const task = await tools.getTask(args.taskId);
        const feature = (task.features || []).find(f => f.id === args.featureId);
        if (!feature) throw new Error(`Feature ${args.featureId} not found in task ${args.taskId}`);

        await runAgentOnFeature(args.llmConfig.model, agent, task, feature, tools, git, completion);
        ee.emit('event', { type: 'run/completed', payload: { ok: true } } satisfies RunEvent);
      } catch (err) {
        ee.emit('event', { type: 'run/error', payload: { error: String((err as Error)?.stack || err) } } satisfies RunEvent);
      } finally {
        ee.emit('event', { type: 'run/complete' } satisfies RunEvent);
      }
    })();
    return handle;
  }

  return {
    startTaskRun,
    startFeatureRun,
  };
}

export default { createOrchestrator, createHistoryStore };
