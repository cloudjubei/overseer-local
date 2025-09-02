import { ipcMain, webContents } from 'electron';
import IPC_HANDLER_KEYS from '../../ipcHandlersKeys.js';
import path from 'node:path';

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

function broadcastEventToSubscribers(runId, event) {
  const subscribers = RUN_SUBSCRIBERS.get(runId);
  if (!subscribers || subscribers.size === 0) return;
  for (const wcId of subscribers) {
    const wc = webContents.fromId(wcId);
    if (wc && !wc.isDestroyed()) {
      try {
        wc.send(IPC_HANDLER_KEYS.FACTORY_EVENT, { runId, event });
      } catch (err) {
        console.warn(`[factory] Failed to send event to wc ${wcId} for run ${runId}:`, err?.message || err);
      }
    }
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

export async function registerFactoryIPC(mainWindow, projectRoot) {
  console.log('[factory] Registering IPC handlers. projectRoot=', projectRoot);
  const { createOrchestrator, createHistoryStore } = await loadFactory();

  let historyStore = undefined;
  try {
    const dbPath = path.join(projectRoot, '.factory', 'history.sqlite');
    if (typeof createHistoryStore === 'function') {
      console.log('[factory] Initializing history store at', dbPath);
      historyStore = createHistoryStore({ dbPath });
    } else {
      console.log('[factory] History store not available; proceeding without persistence');
    }
  } catch (err) {
    console.warn('[factory] Optional history init failed; continuing without it:', err?.message || err);
  }

  console.log('[factory] Creating orchestrator');
  const orchestrator = createOrchestrator({ projectRoot /*, history: historyStore*/ });
  console.log('[factory] Orchestrator ready');

  function attachRun(runHandle) {
    console.log('[factory] Attaching run', runHandle?.id);
    RUNS.set(runHandle.id, runHandle);
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
      broadcastEventToSubscribers(runHandle.id, e);
    });
    const cleanup = () => {
      console.log('[factory] Cleaning up run', runHandle.id);
      try { unsubscribe(); } catch {}
      RUNS.delete(runHandle.id);
      RUN_SUBSCRIBERS.delete(runHandle.id);
    };
    runHandle.onEvent((e) => {
      if (e?.type === 'run/cancelled' || e?.type === 'run/completed' || e?.type === 'run/complete') {
        cleanup();
      }
    });
  }

  ipcMain.handle(IPC_HANDLER_KEYS.FACTORY_START_TASK, (_evt, { projectId, taskId, llmConfig, budgetUSD, metadata }) => {
    console.log('[factory] START_TASK', maskSecrets({ projectId, taskId, llmConfig, budgetUSD, metadata }));
    try {
      const run = orchestrator.startTaskRun({ projectId, taskId, llmConfig, budgetUSD, metadata });
      console.log('[factory] Run started (task)', run?.id);
      attachRun(run);
      return { runId: run.id };
    } catch (err) {
      console.error('[factory] Failed to start task run', err?.stack || String(err));
      throw err;
    }
  });

  ipcMain.handle(IPC_HANDLER_KEYS.FACTORY_START_FEATURE, (_evt, { projectId, taskId, featureId, llmConfig, budgetUSD, metadata }) => {
    console.log('[factory] START_FEATURE', maskSecrets({ projectId, taskId, featureId, llmConfig, budgetUSD, metadata }));
    try {
      const run = orchestrator.startFeatureRun({ projectId, taskId, featureId, llmConfig, budgetUSD, metadata });
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
  });

  // Log window lifecycle for context
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.on('destroyed', () => console.log('[factory] Main window destroyed'));
  }
}
