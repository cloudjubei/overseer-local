import { DefaultRunHandle, SimpleEventBus, makeRunId } from './events/runtime';
import { RunEvent, RunHandle, toISO } from './events/types';
import { FileChangeManager, FileChange } from './files/fileChangeManager';
import { SandboxOverlay } from './files/sandboxOverlay';
import { createHistoryStore, HistoryStore } from './db/store';
import { InMemoryGitService, GitService } from './git/gitService';
import { attachRunRecorder } from './artifacts/recorder';
import { getConfig } from './config';
import { addUsage, UsageStats } from './telemetry';
import { logger } from './utils/logger';

export type LLMConfig = {
  provider?: string;
  model?: string;
  apiKeyEnv?: string;
  temperature?: number;
  maxTokens?: number;
};

export type StartRunParams = {
  projectId: string;
  taskId?: string | number;
  featureId?: string | number;
  llmConfig?: LLMConfig;
  budgetUSD?: number;
  metadata?: Record<string, unknown>;
};

type RunContext = {
  bus: SimpleEventBus;
  handle: DefaultRunHandle;
  overlay: SandboxOverlay;
  fcm: FileChangeManager;
  history?: HistoryStore;
  git: GitService;
  usage: UsageStats;
  usageTimer?: any;
  budgetUSD?: number;
  meta: { projectId: string; taskId?: string; featureId?: string };
};

const RUNS = new Map<string, RunContext>();

export function createOrchestrator(options?: { projectRoot?: string; history?: HistoryStore; git?: GitService; fcm?: FileChangeManager }) {
  const cfg = getConfig();
  const history = options?.history; // optional, provided by host (Electron main)
  const git = options?.git ?? new InMemoryGitService();
  const fcm = options?.fcm ?? new FileChangeManager();
  const projectRoot = options?.projectRoot ?? cfg.projectRoot;

  logger.info('createOrchestrator()', { projectRoot });

  function startRun(params: StartRunParams): RunHandle {
    logger.info('startRun()', {
      projectId: params.projectId,
      taskId: params.taskId != null ? String(params.taskId) : undefined,
      featureId: params.featureId != null ? String(params.featureId) : undefined,
      llm: params.llmConfig?.model,
      budgetUSD: params.budgetUSD,
    });

    const bus = new SimpleEventBus();
    const id = makeRunId('run');
    const handle = new DefaultRunHandle(id, bus);

    // Recorder subscribes to run lifecycle for history/export
    attachRunRecorder(handle, history);

    const overlay = new SandboxOverlay({ projectRoot, id });
    overlay
      .init()
      .then(() => logger.debug('overlay.init() complete', { runId: id }))
      .catch((e) => logger.warn('overlay.init() failed (non-fatal)', { runId: id, error: String(e) }));
    overlay.attachAbortSignal((handle as any).signal);

    const runId = handle.id;
    const meta = {
      projectId: params.projectId,
      taskId: params.taskId != null ? String(params.taskId) : undefined,
      featureId: params.featureId != null ? String(params.featureId) : undefined,
    };

    const usage: UsageStats = { requests: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, costUSD: 0 };
    const budgetUSD = params.budgetUSD ?? cfg.budgetUSD;

    const ctx: RunContext = { bus, handle, overlay, fcm, history, git, usage, budgetUSD, meta };
    RUNS.set(runId, ctx);

    // Emit start
    const startEvent: RunEvent = {
      type: 'run/started',
      time: toISO(),
      runId,
      payload: {
        projectId: meta.projectId,
        taskId: meta.taskId,
        featureId: meta.featureId,
        meta: {
          llm: params.llmConfig?.model,
          budgetUSD: budgetUSD,
          ...(params.metadata ?? {}),
        },
      },
    } as any;
    logger.debug('emit event run/started', { runId });
    bus.emit(startEvent);

    // Periodic usage snapshot and budget check
    ctx.usageTimer = setInterval(() => {
      const snapshot: RunEvent = {
        type: 'run/progress/snapshot',
        time: toISO(),
        runId,
        payload: {
          message: 'usage/update',
          usage: ctx.usage,
        },
      } as any;
      logger.debug('emit event run/progress/snapshot', { runId, usage: ctx.usage });
      bus.emit(snapshot);
      if (ctx.budgetUSD != null && ctx.usage.costUSD != null && ctx.usage.costUSD > ctx.budgetUSD) {
        logger.warn('budget exceeded; cancelling run', { runId, costUSD: ctx.usage.costUSD, budgetUSD: ctx.budgetUSD });
        bus.emit({ type: 'run/budget-exceeded', time: toISO(), runId, payload: ctx.usage });
        handle.cancel('Budget exceeded');
      }
    }, 2000);

    const unsubscribe = handle.onEvent((e) => {
      if (e.type === 'run/cancelled' || e.type === 'run/completed') {
        logger.info('run finished; cleaning up', { runId, type: e.type });
        clearInterval(ctx.usageTimer);
        overlay
          .cleanup()
          .then(() => logger.debug('overlay.cleanup() complete', { runId }))
          .catch((err) => logger.warn('overlay.cleanup() failed (non-fatal)', { runId, error: String(err) }));
        unsubscribe();
      }
    });

    // Initial progress
    queueMicrotask(() => {
      logger.debug('emit event run/progress (init)', { runId });
      bus.emit({ type: 'run/progress', time: toISO(), runId, payload: { message: 'Initializing', step: 'init', progress: 0.05 } });
    });

    return handle;
  }

  async function addUsageToRun(runId: string, delta: Partial<UsageStats>, llm?: LLMConfig) {
    const ctx = RUNS.get(runId);
    if (!ctx) {
      logger.warn('addUsageToRun: unknown runId', { runId });
      return;
    }
    ctx.usage = addUsage(ctx.usage, delta, llm?.provider, llm?.model);
    logger.debug('emit event run/usage', { runId, delta, usage: ctx.usage });
    ctx.bus.emit({ type: 'run/usage', time: toISO(), runId, payload: ctx.usage });
  }

  function proposeChanges(runId: string, changes: Array<Omit<FileChange, 'diff' | 'hunks'>> & FileChange[], title?: string): string {
    const ctx = RUNS.get(runId);
    if (!ctx) throw new Error(`Unknown runId: ${runId}`);
    logger.info('proposeChanges()', { runId, count: changes?.length ?? 0, title });
    const proposal = ctx.fcm.createProposal(projectRoot, changes as any);

    // Stage into overlay
    (async () => {
      for (const ch of ctx.fcm.listProposalFiles(proposal.id)) {
        try {
          if (ch.status === 'deleted') {
            await ctx.overlay.delete(ch.path);
            logger.debug('overlay.delete()', { runId, path: ch.path });
          } else if (ch.status === 'modified' || ch.status === 'added') {
            await ctx.overlay.write(ch.path, ch.newContent ?? '');
            logger.debug('overlay.write()', { runId, path: ch.path });
          }
        } catch (e) {
          logger.warn('overlay staging failed (non-fatal)', { runId, path: ch.path, error: String(e) });
        }
      }
    })().catch((e) => logger.warn('overlay staging task crashed', { runId, error: String(e) }));

    const summary = ctx.fcm.getSummary(proposal.id);
    logger.debug('emit event file/proposal', { runId, proposalId: proposal.id, summary: summary?.counts });
    ctx.bus.emit({ type: 'file/proposal', time: toISO(), runId, payload: { proposalId: proposal.id, title, summary: { added: summary.counts.added, modified: summary.counts.modified, deleted: summary.counts.deleted } } });
    const diffFiles = ctx.fcm.getProposalDiff(proposal.id).files.map((f) => ({
      filePath: f.path,
      status: f.status as any,
      unifiedDiff: f.diff ?? '',
    }));
    logger.debug('emit event file/diff', { runId, proposalId: proposal.id, files: diffFiles.length });
    ctx.bus.emit({ type: 'file/diff', time: toISO(), runId, payload: { proposalId: proposal.id, files: diffFiles as any, summary: { added: summary.counts.added, modified: summary.counts.modified, deleted: summary.counts.deleted } } });
    return proposal.id;
  }

  const reviewService = {
    async acceptAll(runId: string, proposalId: string) {
      const ctx = RUNS.get(runId);
      if (!ctx) throw new Error(`Unknown runId: ${runId}`);
      logger.info('review.acceptAll()', { runId, proposalId });
      const files = ctx.fcm.listProposalFiles(proposalId).map((f) => f.path);
      await ctx.overlay.acceptFiles(files);
      logger.debug('emit event file/proposal-state accepted', { runId, proposalId });
      ctx.bus.emit({ type: 'file/proposal-state', time: toISO(), runId, payload: { proposalId, state: 'accepted' } });
    },
    async acceptFiles(runId: string, proposalId: string, files: string[]) {
      const ctx = RUNS.get(runId);
      if (!ctx) throw new Error(`Unknown runId: ${runId}`);
      logger.info('review.acceptFiles()', { runId, proposalId, filesCount: files?.length ?? 0 });
      await ctx.overlay.acceptFiles(files);
      logger.debug('emit event file/proposal-state partial', { runId, proposalId });
      ctx.bus.emit({ type: 'file/proposal-state', time: toISO(), runId, payload: { proposalId, state: 'partial' } });
    },
    async rejectAll(runId: string, proposalId: string) {
      const ctx = RUNS.get(runId);
      if (!ctx) throw new Error(`Unknown runId: ${runId}`);
      logger.info('review.rejectAll()', { runId, proposalId });
      await ctx.overlay.rejectAll();
      logger.debug('emit event file/proposal-state rejected', { runId, proposalId });
      ctx.bus.emit({ type: 'file/proposal-state', time: toISO(), runId, payload: { proposalId, state: 'rejected' } });
    },
    async rejectFiles(runId: string, proposalId: string, _files: string[]) {
      const ctx = RUNS.get(runId);
      if (!ctx) throw new Error(`Unknown runId: ${runId}`);
      logger.info('review.rejectFiles()', { runId, proposalId });
      // Overlay has no explicit per-file rejection; unchanged files remain staged only
      logger.debug('emit event file/proposal-state partial (rejectFiles no-op)', { runId, proposalId });
      ctx.bus.emit({ type: 'file/proposal-state', time: toISO(), runId, payload: { proposalId, state: 'partial' } });
    },
    async finalize(runId: string, proposalId: string, message?: string) {
      const ctx = RUNS.get(runId);
      if (!ctx) throw new Error(`Unknown runId: ${runId}`);
      logger.info('review.finalize()', { runId, proposalId, message });
      await ctx.git.applyProposalToBranch(proposalId);
      const sha = await ctx.git.commitProposal(proposalId, message ?? `Accept proposal ${proposalId}`);
      logger.debug('emit event git/commit', { runId, proposalId, sha });
      ctx.bus.emit({ type: 'git/commit', time: toISO(), runId, payload: { proposalId, commitSha: sha, message: message ?? '' } });
      return { commitSha: sha };
    },
  };

  function runTask(params: { projectId: string; taskId: string | number; llmConfig?: LLMConfig; budgetUSD?: number; metadata?: Record<string, unknown> }): RunHandle {
    logger.info('runTask()', { projectId: params.projectId, taskId: String(params.taskId) });
    return startRun({ ...params });
  }

  function runFeature(params: { projectId: string; taskId: string | number; featureId: string | number; llmConfig?: LLMConfig; budgetUSD?: number; metadata?: Record<string, unknown> }): RunHandle {
    logger.info('runFeature()', { projectId: params.projectId, taskId: String(params.taskId), featureId: String(params.featureId) });
    return startRun({ ...params });
  }

  function complete(runId: string, payload?: { success?: boolean; message?: string }) {
    const ctx = RUNS.get(runId);
    if (!ctx) {
      logger.warn('complete(): unknown runId', { runId });
      return;
    }
    logger.info('complete()', { runId, success: payload?.success });
    ctx.bus.emit({ type: 'run/completed', time: toISO(), runId, payload: { success: payload?.success ?? true, usage: ctx.usage, message: payload?.message } as any });
  }

  function cancel(runId: string, reason?: string) {
    const ctx = RUNS.get(runId);
    if (!ctx) {
      logger.warn('cancel(): unknown runId', { runId });
      return;
    }
    logger.info('cancel()', { runId, reason });
    ctx.handle.cancel(reason);
  }

  return {
    startRun,
    startTaskRun: runTask,
    startFeatureRun: runFeature,
    addUsageToRun,
    proposeChanges,
    complete,
    cancel,
    reviewService,
  };
}

// Legacy exports retained
export { createOrchestrator as default };

// Minimal default start functions for compatibility
export function startRun(params: StartRunParams): RunHandle {
  logger.info('default.startRun()', { projectId: params.projectId, taskId: params.taskId != null ? String(params.taskId) : undefined, featureId: params.featureId != null ? String(params.featureId) : undefined });
  const orch = createOrchestrator({ history: createHistoryStore() });
  return orch.startRun(params);
}

export function runTask(params: { projectId: string; taskId: string | number; llmConfig?: LLMConfig; budgetUSD?: number; metadata?: Record<string, unknown> }): RunHandle {
  logger.info('default.runTask()', { projectId: params.projectId, taskId: String(params.taskId) });
  const orch = createOrchestrator({ history: createHistoryStore() });
  return orch.startTaskRun(params);
}

export function runFeature(params: { projectId: string; taskId: string | number; featureId: string | number; llmConfig?: LLMConfig; budgetUSD?: number; metadata?: Record<string, unknown> }): RunHandle {
  logger.info('default.runFeature()', { projectId: params.projectId, taskId: String(params.taskId), featureId: String(params.featureId) });
  const orch = createOrchestrator({ history: createHistoryStore() });
  return orch.startFeatureRun(params);
}
