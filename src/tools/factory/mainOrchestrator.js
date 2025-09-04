import { ipcMain, webContents } from 'electron';
import IPC_HANDLER_KEYS from '../../ipcHandlersKeys.js';
import path from 'node:path';
import fs from 'node:fs';

// Load local package factory-ts from monorepo
// Use dynamic import to avoid issues with CJS/ESM resolution in Electron
let factoryTs;
async function loadFactory() {
  if (factoryTs) return factoryTs;
  const cwd = process.cwd();
  const distEsm = path.resolve(cwd, 'packages/factory-ts/dist/index.js');
  const distCjs = path.resolve(cwd, 'packages/factory-ts/dist/index.cjs');
  try {
    console.log('[factory] Loading factory-ts from', distEsm);
    factoryTs = await import(distEsm);
  } catch (errEsm) {
    console.warn('[factory] Failed to load ESM build, trying CJS', errEsm?.message || errEsm);
    try {
      factoryTs = await import(distCjs);
    } catch (errCjs) {
      console.error('[factory] Failed to load factory-ts from dist. Did you build it? npm run factory:build');
      console.error(errCjs?.stack || String(errCjs));
      throw errCjs;
    }
  }
  console.log('[factory] factory-ts loaded successfully');
  return factoryTs;
}

const RUN_SUBSCRIBERS = new Map(); // runId -> Set<webContentsId>
const RUNS = new Map(); // runId -> RunHandle
const RUN_META = new Map(); // runId -> metadata snapshot
const RUN_TIMERS = new Map(); // runId -> heartbeat timer

let PRICING = null;
let HISTORY = null;

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
    return o;
  } catch {
    return obj;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function persistMeta(runId) {
  try {
    const meta = RUN_META.get(runId);
    if (!meta || !HISTORY) return;
    const h = HISTORY;
    if (typeof h.addOrUpdateRun === 'function') {
      h.addOrUpdateRun(meta);
    } else if (typeof h.updateRunMeta === 'function') {
      h.updateRunMeta(meta.runId, meta);
    } else if (typeof h.upsertRun === 'function') {
      h.upsertRun(meta);
    } else if (typeof h.addRun === 'function') {
      h.addRun(meta);
    } else {
      // No known persistence API; noop
    }
  } catch (e) {
    console.warn('[factory] persistMeta error', e?.message || e);
  }
}

function updateMetaFromEvent(runId, e) {
  const meta = RUN_META.get(runId);
  if (!meta) return;
  meta.updatedAt = e?.ts || e?.time || nowIso();
  const type = e?.type;
  const payload = e?.payload || {};
  if (type === 'run/progress' || type === 'run/progress/snapshot') {
    if (typeof payload?.progress === 'number') meta.progress = payload.progress;
    else if (typeof payload?.percent === 'number') meta.progress = Math.max(0, Math.min(1, payload.percent / 100));
    if (payload?.message) meta.message = payload.message;
  } else if (type === 'run/usage') {
    if (payload?.costUSD != null) meta.costUSD = payload.costUSD;
    else if (payload?.costUsd != null) meta.costUSD = payload.costUsd;
    else if (payload?.usd != null) meta.costUSD = payload.usd;
    if (payload?.promptTokens != null) meta.promptTokens = payload.promptTokens;
    if (payload?.completionTokens != null) meta.completionTokens = payload.completionTokens;
    if (payload?.provider) meta.provider = payload.provider;
    if (payload?.model) meta.model = payload.model;
  } else if (type === 'run/start') {
    if (payload?.llm?.provider) meta.provider = payload.llm.provider;
    if (payload?.llm?.model) meta.model = payload.llm.model;
  } else if (type === 'run/error') {
    meta.state = 'error';
    meta.message = payload?.message || payload?.error || 'Error';
  } else if (type === 'run/cancelled') {
    meta.state = 'cancelled';
    meta.message = payload?.reason || 'Cancelled';
  } else if (type === 'run/completed' || type === 'run/complete') {
    meta.state = 'completed';
    meta.message = payload?.message || payload?.summary || 'Completed';
  }
  // Persist snapshot on each update
  persistMeta(runId);
}

function loadWorkspaceDotenv(projectRoot) {
  try {
    const dotenv = require('dotenv');
    const envPath = path.join(projectRoot, '.env');
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
      console.log('[factory] Loaded workspace .env from', envPath);
    } else {
      console.log('[factory] No .env at', envPath);
    }
  } catch (e) {
    // If dotenv isn't available or fails, ignore silently to avoid crashing Electron main
    console.warn('[factory] dotenv not loaded in main process (optional):', e?.message || e);
  }
}

export async function registerFactoryIPC(mainWindow, projectRoot) {
  console.log('[factory] Registering IPC handlers. projectRoot=', projectRoot);

  // Ensure workspace .env is loaded in main process so child processes and libs see credentials
  loadWorkspaceDotenv(projectRoot);

  const { createOrchestrator, createHistoryStore, createPricingManager } = await loadFactory();

  try {
    const dbPath = path.join(projectRoot, '.factory', 'history.sqlite');
    if (typeof createHistoryStore === 'function') {
      console.log('[factory] Initializing history store at', dbPath);
      HISTORY = createHistoryStore({ dbPath });
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

  function startHeartbeat(runId) {
    const prev = RUN_TIMERS.get(runId);
    if (prev) clearInterval(prev);
    const timer = setInterval(() => {
      const meta = RUN_META.get(runId);
      if (!meta) return;
      // Only heartbeat while running
      if (meta.state === 'running') {
        const evt = { type: 'run/heartbeat', payload: {}, ts: nowIso() };
        updateMetaFromEvent(runId, evt);
        broadcastEventToSubscribers(runId, evt);
      }
    }, 15000);
    RUN_TIMERS.set(runId, timer);
  }

  function stopHeartbeat(runId) {
    const t = RUN_TIMERS.get(runId);
    if (t) {
      clearInterval(t);
      RUN_TIMERS.delete(runId);
    }
  }

  function attachRun(runHandle, initMeta) {
    console.log('[factory] Attaching run', runHandle?.id);
    RUNS.set(runHandle.id, runHandle);
    RUN_META.set(runHandle.id, initMeta);
    // Persist initial meta
    persistMeta(runHandle.id);
    startHeartbeat(runHandle.id);

    const unsubscribe = runHandle.onEvent((e) => {
      try {
        // Rich log for visibility; include payload for llm events
        const t = e?.type || 'unknown';
        if (String(t).startsWith('llm/')) {
          console.log('[factory] event', runHandle.id, t, e?.payload ? JSON.parse(JSON.stringify(e.payload)) : undefined);
        } else if (t === 'run/log' || t === 'run/progress' || t === 'run/progress/snapshot') {
          console.log('[factory] event', runHandle.id, t, e?.payload?.message || '');
        } else {
          console.log('[factory] event', runHandle.id, t);
        }
      } catch {}

      // Persist message snapshots when provided
      try {
        if ((e?.type === 'llm/messages/snapshot' || e?.type === 'llm/messages/final') && e?.payload?.messages && HISTORY) {
          const h = HISTORY;
          if (typeof h.writeMessages === 'function') {
            h.writeMessages(runHandle.id, e.payload.messages);
          } else if (typeof h.saveMessages === 'function') {
            h.saveMessages(runHandle.id, e.payload.messages);
          }
        }
      } catch (err) {
        console.warn('[factory] Failed to persist messages for', runHandle.id, err?.message || err);
      }

      updateMetaFromEvent(runHandle.id, e);
      broadcastEventToSubscribers(runHandle.id, e);
    });

    const cleanup = () => {
      console.log('[factory] Cleaning up run', runHandle.id);
      try { unsubscribe(); } catch {}
      stopHeartbeat(runHandle.id);
      RUNS.delete(runHandle.id);
      RUN_SUBSCRIBERS.delete(runHandle.id);
      // keep RUN_META for a while? Persisted already
      RUN_META.delete(runHandle.id);
    };

    runHandle.onEvent((e) => {
      if (e?.type === 'run/cancelled' || e?.type === 'run/completed' || e?.type === 'run/complete' || e?.type === 'run/error') {
        cleanup();
      }
    });
  }

  // Helper to proactively mark and persist cancellation, even if the run handle doesn't emit an event
  function markCancelled(runId, reason) {
    const meta = RUN_META.get(runId);
    if (!meta) return;
    const evt = { type: 'run/cancelled', payload: { reason: reason || 'Cancelled' }, ts: nowIso() };
    updateMetaFromEvent(runId, evt);
    broadcastEventToSubscribers(runId, evt);
    stopHeartbeat(runId);
  }

  ipcMain.handle(IPC_HANDLER_KEYS.FACTORY_START_TASK, (_evt, { projectId, taskId, llmConfig, budgetUSD, metadata }) => {
    console.log('[factory] START_TASK', maskSecrets({ projectId, taskId, llmConfig, budgetUSD, metadata }));
    try {
      const run = orchestrator.startRun({ projectId, taskId, llmConfig, budgetUSD, metadata });
      console.log('[factory] Run started (task)', run?.id);
      const initMeta = {
        runId: run.id,
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

  ipcMain.handle(IPC_HANDLER_KEYS.FACTORY_START_FEATURE, (_evt, { projectId, taskId, featureId, llmConfig, budgetUSD, metadata }) => {
    console.log('[factory] START_FEATURE', maskSecrets({ projectId, taskId, featureId, llmConfig, budgetUSD, metadata }));
    try {
      const run = orchestrator.startRun({ projectId, taskId, featureId, llmConfig, budgetUSD, metadata });
      console.log('[factory] Run started (feature)', run?.id);
      const initMeta = {
        runId: run.id,
        projectId,
        taskId,
        featureId,
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
      console.error('[factory] Failed to start feature run', err?.stack || String(err));
      throw err;
    }
  });

  ipcMain.handle(IPC_HANDLER_KEYS.FACTORY_CANCEL_RUN, (_evt, { runId, reason }) => {
    console.log('[factory] CANCEL_RUN', { runId, reason });
    const run = RUNS.get(runId);
    // Proactively mark as cancelled for UI/history even if run handle doesn't emit an event
    try { markCancelled(runId, reason); } catch {}
    if (run) {
      try { run.cancel(reason); } catch (err) { console.warn('[factory] Error cancelling run', runId, err?.message || err); }
    } else {
      console.warn('[factory] Cancel requested for unknown run', runId);
    }
    return { ok: true };
  });

  ipcMain.on(IPC_HANDLER_KEYS.FACTORY_SUBSCRIBE, (evt, { runId }) => {
    const wcId = evt.sender.id;
    console.log('[factory] SUBSCRIBE', { runId, wcId });
    let set = RUN_SUBSCRIBERS.get(runId);
    if (!set) {
      set = new Set();
      RUN_SUBSCRIBERS.set(runId, set);
    }
    set.add(wcId);
    evt.sender.once('destroyed', () => {
      const s = RUN_SUBSCRIBERS.get(runId);
      if (s) {
        s.delete(wcId);
        console.log('[factory] Unsubscribed (wc destroyed)', { runId, wcId });
      }
    });

    // Immediately send a snapshot to this subscriber to sync current state
    const meta = RUN_META.get(runId);
    if (meta) {
      sendEventToWC(wcId, runId, { type: 'run/snapshot', payload: meta, ts: nowIso() });
    }
  });

  ipcMain.handle(IPC_HANDLER_KEYS.FACTORY_LIST_ACTIVE, () => {
    // Return currently running runs (best-effort snapshot)
    const list = [];
    for (const [runId, meta] of RUN_META.entries()) {
      if (meta?.state === 'running') {
        list.push({ ...meta, runId });
      }
    }
    return list;
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
  ipcMain.handle(IPC_HANDLER_KEYS.FACTORY_HISTORY_MESSAGES, (_evt, { runId }) => {
    try {
      return HISTORY?.getRunMessages?.(runId) || [];
    } catch (e) {
      console.warn('[factory] history:messages error', e?.message || e);
      return [];
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
