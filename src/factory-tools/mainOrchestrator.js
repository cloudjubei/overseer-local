import { ipcMain, webContents } from 'electron';
import IPC_HANDLER_KEYS from '../ipcHandlersKeys.js';
import path from 'node:path';
import fs from 'node:fs';
import { createOrchestrator, createAgentRunStore, createPricingManager } from 'thefactory-tools'

const RUN_SUBSCRIBERS = new Map(); // runId -> Set<webContentsId>
const RUNS = new Map(); // runId -> RunHandle
const RUN_MESSAGES = new Map(); // runId -> last messages array or grouped object

let PRICING = null;
let HISTORY = null;

// Expose getter for other managers (e.g., LiveData) to access pricing manager
export function getPricingManager() {
  return PRICING;
}

function sendEventToWC(wcId, runId, event) {
  const wc = webContents.fromId(wcId);
  if (wc && !wc.isDestroyed()) {
    try {
      wc.send(IPC_HANDLER_KEYS.FACTORY_EVENT, { runId, event });
    } catch (err) {
      console.warn(`[factory] Failed to send event to wc ${wcId} for run ${runId}:`, err?.message || err);
    }
  }
}

function broadcastEventToSubscribers(runId, event) {
  const subscribers = RUN_SUBSCRIBERS.get(runId);
  if (!subscribers || subscribers.size === 0) return;
  for (const wcId of subscribers) {
    sendEventToWC(wcId, runId, event);
  }
}

function maskSecrets(obj) {
  try {
    const o = JSON.parse(JSON.stringify(obj));
    if (o && o.llmConfig && typeof o.llmConfig === 'object') {
      if ('apiKey' in o.llmConfig) o.llmConfig.apiKey = '***';
    }
    if (o && o.githubCredentials && typeof o.githubCredentials === 'object') {
      if ('token' in o.githubCredentials) o.githubCredentials.token = '***';
    }
    if (o && o.webSearchApiKeys && typeof o.webSearchApiKeys === 'object') {
      if ('exa' in o.webSearchApiKeys) o.webSearchApiKeys.exa = '***';
      if ('serpapi' in o.webSearchApiKeys) o.webSearchApiKeys.serpapi = '***';
      if ('tavily' in o.webSearchApiKeys) o.webSearchApiKeys.tavily = '***';
    }
    return o;
  } catch {
    return obj;
  }
}

function nowIso() {
  return new Date().toISOString();
}

export async function registerFactoryIPC(mainWindow, projectRoot) {
  console.log('[factory] Registering IPC handlers. projectRoot=', projectRoot);

  try {
    const dbPath = path.join(projectRoot, '.factory');
    if (typeof createHistoryStore === 'function') {
      console.log('[factory] Initializing history store at', dbPath);
      HISTORY = createAgentRunStore({ dbPath });
    } else {
      console.log('[factory] History store not available; proceeding without persistence');
    }
  } catch (err) {
    console.warn('[factory] Optional history init failed; continuing without it:', err?.message || err);
  }

  // Initialize pricing manager and keep reference for IPC operations
  try {
    PRICING = createPricingManager({ projectRoot });
    console.log('[factory] Pricing manager initialized. Loaded', PRICING?.listPrices()?.prices?.length || 0, 'prices.');
  } catch (err) {
    console.warn('[factory] Failed to initialize pricing manager:', err?.message || err);
  }

  console.log('[factory] Creating orchestrator');
  const orchestrator = createOrchestrator({ projectRoot, history: HISTORY, pricing: PRICING });
  console.log('[factory] Orchestrator ready');

  function attachRun(runHandle) {
    console.log('[factory] Attaching run', runHandle?.id);
    RUNS.set(runHandle.id, runHandle);

    const unsubscribe = runHandle.onEvent((e) => {
      broadcastEventToSubscribers(runHandle.id, e);

      // If we receive a run/cancelled event, proactively flush last messages (if any)
      if (e?.type === 'run/cancelled') {
        const last = RUN_MESSAGES.get(runHandle.id);
        if (last) persistMessages(runHandle.id, last);
      }
    });

    const cleanup = () => {
      console.log('[factory] Cleaning up run', runHandle.id);
      try { unsubscribe(); } catch {}
      stopHeartbeat(runHandle.id);
      RUNS.delete(runHandle.id);
      RUN_SUBSCRIBERS.delete(runHandle.id);
      RUN_MESSAGES.delete(runHandle.id);
      // keep RUN_META for a while? Persisted already
      RUN_META.delete(runHandle.id);
    };

    runHandle.onEvent((e) => {
      if (e?.type === 'run/cancelled' || e?.type === 'run/completed' || e?.type === 'run/complete' || e?.type === 'run/error') {
        cleanup();
      }
    });
  }

  ipcMain.handle(IPC_HANDLER_KEYS.FACTORY_START_TASK, (_evt, { agentType, projectId, taskId, llmConfig, githubCredentials, webSearchApiKeys, options }) => {
    console.log('[factory] START_TASK', maskSecrets({ agentType, projectId, taskId, llmConfig, githubCredentials, webSearchApiKeys, options }));
    try {
      const run = orchestrator.startRun({ agentType, projectId, taskId, llmConfig, githubCredentials, webSearchApiKeys, options });
      console.log('[factory] Run started (task)', run?.id);
      const initMeta = {
        runId: run.id,
        agentType,
        projectId,
        taskId,
        featureId: undefined,
        state: 'running',
        message: 'Starting agent... ',
        progress: undefined,
        costUSD: undefined,
        promptTokens: undefined,
        completionTokens: undefined,
        provider: llmConfig?.provider,
        model: llmConfig?.model,
        startedAt: nowIso(),
        updatedAt: nowIso(),
      };
      attachRun(run, initMeta);
      // Emit a synthetic start snapshot
      broadcastEventToSubscribers(run.id, { type: 'run/snapshot', payload: initMeta, ts: nowIso() });
      return { runId: run.id };
    } catch (err) {
      console.error('[factory] Failed to start task run', err?.stack || String(err));
      throw err;
    }
  });

  ipcMain.handle(IPC_HANDLER_KEYS.FACTORY_START_FEATURE, (_evt, { agentType, projectId, taskId, featureId, llmConfig, githubCredentials, webSearchApiKeys, options }) => {
    console.log('[factory] START_FEATURE', maskSecrets({ agentType, projectId, taskId, featureId, llmConfig, githubCredentials, webSearchApiKeys, options }));
    try {
      const run = orchestrator.startRun({ agentType, projectId, taskId, featureId, llmConfig, githubCredentials, webSearchApiKeys, options });
      console.log('[factory] Run started (feature)', run?.id);
     
      attachRun(run);
      return { runId: run.id };
    } catch (err) {
      console.error('[factory] Failed to start feature run', err?.stack || String(err));
      throw err;
    }
  });

  ipcMain.handle(IPC_HANDLER_KEYS.FACTORY_CANCEL_RUN, (_evt, { runId, reason }) => {
    console.log('[factory] CANCEL_RUN', { runId, reason });
    const run = RUNS.get(runId);
    if (run) {
      try { run.cancel(reason); } catch (err) { console.warn('[factory] Error cancelling run', runId, err?.message || err); }
    } else {
      console.warn('[factory] Cancel requested for unknown run', runId);
    }
    return { ok: true };
  });
    // Immediately send a snapshot to this subscriber to sync current state
    const meta = RUN_META.get(runId);
    if (meta) {
      sendEventToWC(wcId, runId, { type: 'run/snapshot', payload: meta, ts: nowIso() });
    }
  });

  ipcMain.handle(IPC_HANDLER_KEYS.FACTORY_HISTORY_LIST_ACTIVE, () => {
    try {
      return HISTORY?.listActiveRuns?.() || [];
    } catch (e) {
      console.warn('[factory] history:list error', e?.message || e);
      return [];
    }
  });

  // History listing and messages API
  ipcMain.handle(IPC_HANDLER_KEYS.FACTORY_HISTORY_LIST, () => {
    try {
      return HISTORY?.listRuns?.() || [];
    } catch (e) {
      console.warn('[factory] history:list error', e?.message || e);
      return [];
    }
  });
  ipcMain.handle(IPC_HANDLER_KEYS.FACTORY_HISTORY_DELETE, (_evt, { runId }) => {
    try {
      if (HISTORY && typeof HISTORY.deleteRun === 'function') {
        HISTORY.deleteRun(runId);
        return { ok: true };
      }
      console.warn('[factory] HISTORY.deleteRun not available');
      return { ok: false };
    } catch (e) {
      console.warn('[factory] history:delete error', e?.message || e);
      return { ok: false, error: e?.message || String(e) };
    }
  });

  // Pricing handlers
  ipcMain.handle(IPC_HANDLER_KEYS.FACTORY_PRICING_GET, () => {
    try {
      const state = PRICING?.listPrices();
      return state || { updatedAt: nowIso(), prices: [] };
    } catch (e) {
      return { updatedAt: nowIso(), prices: [] };
    }
  });

  ipcMain.handle(IPC_HANDLER_KEYS.FACTORY_PRICING_REFRESH, async (_evt, { provider, url }) => {
    try {
      const state = await PRICING?.refresh(provider, url);
      return state || { updatedAt: nowIso(), prices: [] };
    } catch (e) {
      return { updatedAt: nowIso(), prices: [] };
    }
  });

  // Log window lifecycle for context
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.on('destroyed', () => console.log('[factory] Main window destroyed'));
  }
}
