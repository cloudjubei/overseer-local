import path from 'node:path';
import fs from 'node:fs';
import { EventEmitter } from 'node:events';
import { taskUtils as defaultTaskUtils } from './taskUtils.js';
import { fileTools as defaultFileTools } from './fileTools.js';
import GitManager from './gitManager.js';
import { runIsolatedOrchestrator } from './orchestrator.js';
import { createCompletionClient, type CompletionClient } from './completion.js';
import { setFactoryDebug, setLoggerConfig, getLoggerConfig, logger } from './logger.js';
import { createPricingManager, PricingManager, estimateCostUSD } from './pricing.js';
import { LLMConfig, RunEvent, AgentRun } from './types.js';

export type Unsubscribe = () => void;

export interface RunHandle {
  id: string;
  onEvent(cb: (e: RunEvent) => void): Unsubscribe;
  cancel(reason?: string): void;
}

export type RunMeta = {
  runId: string;
  projectId?: string;
  taskId?: string;
  featureId?: string;
  state: 'running' | 'completed' | 'cancelled' | 'error';
  message?: string;
  progress?: number;
  costUSD?: number;
  promptTokens?: number;
  completionTokens?: number;
  provider?: string;
  model?: string;
  startedAt?: string;
  updatedAt?: string;
};

export interface HistoryStore {
  addOrUpdateRun(meta: RunMeta): void;
  updateRunMeta(runId: string, patch: Partial<RunMeta>): void;
  writeMessages(runId: string, messages: any[]): void;
  listRuns(): RunMeta[];
  getRun(runId: string): RunMeta | undefined;
  getRunMessages(runId: string): any[];
}

function ensureDir(p: string) {
  try { fs.mkdirSync(p, { recursive: true }); } catch {}
}

export function createHistoryStore(opts: { dbPath: string }): HistoryStore {
  // Use a file-backed store under <dirname(dbPath)>/history
  const baseDir = path.join(path.dirname(opts.dbPath || ''), 'history');
  const runsDir = path.join(baseDir, 'runs');
  const indexFile = path.join(baseDir, 'runs.json');
  ensureDir(runsDir);

  function readIndex(): RunMeta[] {
    try {
      const raw = fs.readFileSync(indexFile, 'utf8');
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr as RunMeta[];
      return [];
    } catch {
      return [];
    }
  }
  function writeIndex(list: RunMeta[]) {
    try { fs.writeFileSync(indexFile, JSON.stringify(list, null, 2), 'utf8'); } catch {}
  }

  function addOrUpdateRun(meta: RunMeta) {
    const list = readIndex();
    const idx = list.findIndex(r => r.runId === meta.runId);
    const merged = { ...(idx >= 0 ? list[idx] : {}), ...meta } as RunMeta;
    if (idx >= 0) list[idx] = merged; else list.push(merged);
    // Keep sorted by updatedAt desc if present
    list.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    writeIndex(list);
  }

  function updateRunMeta(runId: string, patch: Partial<RunMeta>) {
    const list = readIndex();
    const idx = list.findIndex(r => r.runId === runId);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...patch, runId } as RunMeta;
      list.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
      writeIndex(list);
    } else {
      addOrUpdateRun({ runId, state: 'running', ...patch } as RunMeta);
    }
  }

  function messagesFile(runId: string) { return path.join(runsDir, `${runId}.messages.json`); }

  function writeMessages(runId: string, messages: any[]) {
    try { fs.writeFileSync(messagesFile(runId), JSON.stringify(messages ?? [], null, 2), 'utf8'); } catch {}
  }

  function getRunMessages(runId: string): any[] {
    try {
      const raw = fs.readFileSync(messagesFile(runId), 'utf8');
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function listRuns(): RunMeta[] { return readIndex(); }
  function getRun(runId: string): RunMeta | undefined { return readIndex().find(r => r.runId === runId); }

  return { addOrUpdateRun, updateRunMeta, writeMessages, listRuns, getRun, getRunMessages } satisfies HistoryStore;
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

  function startRun(args: AgentRun): RunHandle {
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
