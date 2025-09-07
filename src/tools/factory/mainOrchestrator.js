import { ipcMain, webContents } from 'electron';
import IPC_HANDLER_KEYS from '../../ipcHandlersKeys.js';
import path from 'node:path';
import fs from 'node:fs';

// Load factory-ts as a proper npm module (workspace dependency)
let factoryTs;
async function loadFactory()
{
  if (factoryTs) return factoryTs;
  try {
    console.log('[factory] Loading factory-ts via module resolution');
    factoryTs = await import('factory-ts');
  } catch (err) {
    console.error('[factory] Failed to load factory-ts as a module. Ensure workspaces are installed and the package is built.');
    console.error(err?.stack || String(err));
    throw err;
  }
  console.log('[factory] factory-ts loaded successfully');
  return factoryTs;
}

const RUN_SUBSCRIBERS = new Map(); // runId -> Set<webContentsId>
const RUNS = new Map(); // runId -> RunHandle
const RUN_META = new Map(); // runId -> metadata snapshot
const RUN_TIMERS = new Map(); // runId -> heartbeat timer
const RUN_MESSAGES = new Map(); // runId -> last messages array or grouped object

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

function persistMessages(runId, messages) {
  try {
    if (!HISTORY || !messages) return;
    const h = HISTORY;
    if (typeof h.writeMessages === 'function') {
      h.writeMessages(runId, messages);
    } else if (typeof h.saveMessages === 'function') {
      h.saveMessages(runId, messages);
    }
  } catch (e) {
    console.warn('[factory] persistMessages error', e?.message || e);
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

// --- Normalization: convert persisted messages array into feature-keyed logs ---
const DEFAULT_FEATURE_KEY = '__task__';
function parseFeatureMarker(content) {
  if (!content || typeof content !== 'string') return null;
  // Matches lines like: --- BEGIN FEATURE <id>: <title> ---
  const m = /^---\s*BEGIN\s+FEATURE\s+([^:]+)\s*:/.exec(content);
  return m ? String(m[1]).trim() : null;
}
function ensureGroup(map, featureId) {
  if (!map[featureId]) {
    map[featureId] = { startDate: new Date().toISOString(), featureId, messages: [] };
  }
  return map[featureId];
}
function normalizeRunMessagesToFeatureLog(messages) {
  // If already in the expected shape (object of { featureId: { startDate, messages } }), return as-is
  if (messages && !Array.isArray(messages) && typeof messages === 'object') {
    return messages;
  }
  const result = {};
  if (!Array.isArray(messages)) {
    // Unknown shape -> fallback to empty task bucket
    result[DEFAULT_FEATURE_KEY] = { startDate: new Date().toISOString(), featureId: DEFAULT_FEATURE_KEY, messages: [] };
    return result;
  }
  let current = DEFAULT_FEATURE_KEY;
  ensureGroup(result, current);
  for (const msg of messages) {
    try {
      const role = msg?.role;
      const content = msg?.content;
      if (role === 'system') {
        const fid = parseFeatureMarker(content);
        if (fid) {
          current = fid;
          ensureGroup(result, current);
          // Do not include the marker message in the feature messages
          continue;
        }
      }
      const grp = ensureGroup(result, current);
      // Push shallow clone to avoid accidental mutations downstream
      grp.messages.push({ ...msg });
    } catch {}
  }
  // Assign a simple endDate for groups that have messages
  const now = new Date().toISOString();
  for (const fid of Object.keys(result)) {
    const g = result[fid];
    if (g && Array.isArray(g.messages) && g.messages.length > 0) {
      g.endDate = now;
    }
  }
  return result;
}

export async function registerFactoryIPC(mainWindow, projectRoot) {
  console.log('[factory] Registering IPC handlers. projectRoot=', projectRoot);

  // Ensure workspace .env is loaded in main process so child processes and libs see credentials
  loadWorkspaceDotenv(projectRoot);

  const factory = await loadFactory();
  const { createOrchestrator, createHistoryStore, createPricingManager } = factory

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

      // Capture and persist messages when provided (init, snapshots, or final)
      try {
        if ((e?.type === 'llm/messages/snapshot' || e?.type === 'llm/messages/final' || e?.type === 'llm/messages/init') && (e?.payload?.messages || e?.payload?.messageGroups)) {
          const toPersist = e?.payload?.messageGroups ?? e?.payload?.messages;
          RUN_MESSAGES.set(runHandle.id, toPersist);
          persistMessages(runHandle.id, toPersist);
        }
      } catch (err) {
        console.warn('[factory] Failed to persist messages for', runHandle.id, err?.message || err);
      }

      updateMetaFromEvent(runHandle.id, e);
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

  // Helper to proactively mark and persist cancellation, even if the run handle doesn't emit an event
  function markCancelled(runId, reason) {
    const meta = RUN_META.get(runId);
    if (!meta) return;
    const evt = { type: 'run/cancelled', payload: { reason: reason || 'Cancelled' }, ts: nowIso() };
    updateMetaFromEvent(runId, evt);
    broadcastEventToSubscribers(runId, evt);
    // Persist last known messages if we have any
    const last = RUN_MESSAGES.get(runId);
    if (last) persistMessages(runId, last);
    stopHeartbeat(runId);
  }

  ipcMain.handle(IPC_HANDLER_KEYS.FACTORY_START_TASK, (_evt, { agentType, projectId, taskId, llmConfig, options }) => {
    console.log('[factory] START_TASK', maskSecrets({ agentType, projectId, taskId, llmConfig, options }));
    try {
      const run = orchestrator.startRun({ agentType, projectId, taskId, llmConfig, options });
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

  ipcMain.handle(IPC_HANDLER_KEYS.FACTORY_START_FEATURE, (_evt, { agentType, projectId, taskId, featureId, llmConfig, options }) => {
    console.log('[factory] START_FEATURE', maskSecrets({ agentType, projectId, taskId, featureId, llmConfig, options }));
    try {
      const run = orchestrator.startRun({ agentType, projectId, taskId, featureId, llmConfig, options });
      console.log('[factory] Run started (feature)', run?.id);
      const initMeta = {
        runId: run.id,
        agentType,
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
      const raw = HISTORY?.getRunMessages?.(runId) || [];
      const normalized = normalizeRunMessagesToFeatureLog(raw);
      return normalized;
    } catch (e) {
      console.warn('[factory] history:messages error', e?.message || e);
      // Return empty feature log structure to satisfy UI expectations
      return { [DEFAULT_FEATURE_KEY]: { startDate: nowIso(), featureId: DEFAULT_FEATURE_KEY, messages: [] } };
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
  return factory
}
