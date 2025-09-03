import path from 'node:path';
import { EventEmitter } from 'node:events';
import { taskUtils as defaultTaskUtils, TaskUtils } from './taskUtils.js';
import { fileTools as defaultFileTools, FileTools } from './fileTools.js';
import GitManager from './gitManager.js';
import { runIsolatedOrchestrator } from './orchestrator.js';
import { createCompletionClient, type CompletionClient } from './completion.js';
import { setFactoryDebug, setLoggerConfig, getLoggerConfig, logger } from './logger.js';
import { createPricingManager, PricingManager, estimateCostUSD } from './pricing.js';

export type LLMConfig = {
  model: string;
  provider?: string; // e.g., openai, azure, together, groq, openrouter, ollama, custom
  apiKey?: string;
  baseURL?: string;
  // extra provider fields (azure etc.) tolerated
  [key: string]: any;
};

export type StartRun = {
  agent: 'developer' | 'tester' | 'planner' | 'contexter' | 'speccer';
  projectId?: string;
  taskId: string;
  featureId?: string;
  llmConfig: LLMConfig;
  budgetUSD?: number;
  metadata?: Record<string, any>;
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

function attachLLMLogging(comp: CompletionClient, emit: (e: RunEvent) => void, opts?: { provider?: string; pricing?: PricingManager }): CompletionClient {
  // Accumulate usage across the run
  let totalPrompt = 0;
  let totalCompletion = 0;
  let totalUSD = 0;

  // Wrap the completion client to emit llm events including request messages and timing
  const wrapped: CompletionClient = async (req) => {
    const startedAt = Date.now();
    try {
      emit({ type: 'llm/request', payload: { model: req.model, messages: req.messages } });
    } catch {}
    try {
      const res = await comp(req);
      const durationMs = Date.now() - startedAt;
      emit({ type: 'llm/response', payload: { model: req.model, message: res.message, durationMs } });
      // Usage (if provided by client)
      const u = res.usage || {};
      const pDelta = Number(u.promptTokens || 0);
      const cDelta = Number(u.completionTokens || 0);
      totalPrompt += pDelta;
      totalCompletion += cDelta;

      // Compute/accumulate cost incrementally
      let lastCostUSD: number | undefined = undefined;
      // Prefer provider-reported cost if available
      if (u.costUSD != null && isFinite(Number(u.costUSD))) {
        lastCostUSD = Number(u.costUSD);
      } else if (opts?.pricing) {
        const price = opts.pricing.getPrice(u.provider || opts.provider, u.model || req.model);
        lastCostUSD = estimateCostUSD(pDelta, cDelta, price);
      }
      if (lastCostUSD != null) totalUSD += lastCostUSD;

      try {
        emit({
          type: 'run/usage',
          payload: {
            provider: u.provider || opts?.provider,
            model: u.model || req.model,
            promptTokens: totalPrompt,
            completionTokens: totalCompletion,
            totalTokens: (totalPrompt + totalCompletion) || u.totalTokens,
            // Emit 0 when no price is available yet, rather than undefined
            costUSD: totalUSD,
            lastDurationMs: durationMs,
          }
        } satisfies RunEvent);
      } catch {}
      return res;
    } catch (err) {
      const durationMs = Date.now() - startedAt;
      emit({ type: 'llm/error', payload: { error: String((err as Error)?.message || err), durationMs } });
      throw err;
    }
  };
  return wrapped;
}

export function createOrchestrator(opts: { projectRoot?: string; history?: HistoryStore; pricing?: PricingManager }) {
  const projectRoot = path.resolve(opts.projectRoot || process.cwd());

  // A run registry
  const runs = new Map<string, { ee: EventEmitter; cancelled: boolean; cancel: (r?: string) => void }>();

  // Pricing manager (load/set defaults from disk on app start)
  const pricing = opts.pricing || createPricingManager({ projectRoot });

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

  function getAgentFromArgs(args: { agent?: any; metadata?: any }, fallback: any = 'developer') {
    return args.agent || args.metadata?.agent || fallback;
  }

  function startRun(args: StartRun): RunHandle {
    const { id, ee, handle } = newRunHandle('task');
    (async () => {
      ee.emit('event', { type: 'run/start', payload: { scope: 'task', id, taskId: args.taskId, llm: { model: args.llmConfig?.model, provider: args.llmConfig?.provider } } } satisfies RunEvent);
      try {
        const taskTools = { ...defaultTaskUtils };
        const fileTools = { ...defaultFileTools };

        const completion = attachLLMLogging(buildCompletion(args.llmConfig), (e) => ee.emit('event', e), { provider: args.llmConfig?.provider, pricing });
        const agentType = getAgentFromArgs(args, 'developer');

        const taskId = args.taskId;
        const featureId = args.featureId;
        await runIsolatedOrchestrator({ model: args.llmConfig.model, agentType, taskId, featureId, gitFactory: (p) => new GitManager(p), taskTools, fileTools, completion, emit: (e) => ee.emit('event', e) });

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
    startRun,
    pricing, // expose for external IPC if needed
  };
}

export { setFactoryDebug, setLoggerConfig, getLoggerConfig, logger, createPricingManager };

export default { createOrchestrator, createHistoryStore, setFactoryDebug, setLoggerConfig, getLoggerConfig, logger, createPricingManager };
