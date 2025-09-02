import { ipcMain, webContents } from 'electron';
import IPC_HANDLER_KEYS from '../../ipcHandlersKeys.js';
import path from 'node:path';

// Load local package factory-ts from monorepo
// Use dynamic import to avoid issues with CJS/ESM resolution in Electron
let factoryTs;
async function loadFactory() {
  if (factoryTs) return factoryTs;
  // Prefer built dist when present, fallback to src via ts code transpiled by tsup during package install.
  try {
    factoryTs = await import(path.resolve(process.cwd(), 'packages/factory-ts/dist/index.js'));
  } catch {
    factoryTs = await import(path.resolve(process.cwd(), 'packages/factory-ts/dist/index.cjs'));
  }
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
      wc.send(IPC_HANDLER_KEYS.FACTORY_EVENT, { runId, event });
    }
  }
}

export async function registerFactoryIPC(mainWindow, projectRoot) {
  const { createOrchestrator } = await loadFactory();
  // Re-enable history store only in main process context
  let historyStore = undefined;
  try {
    const mod = await import(path.resolve(process.cwd(), 'packages/factory-ts/dist/index.js'));
    if (mod && mod.createHistoryStore) {
      historyStore = mod.createHistoryStore({ dbPath: path.join(projectRoot, '.factory', 'history.sqlite') });
    }
  } catch {
    // optional history, continue without persistence
  }

  const orchestrator = createOrchestrator({ projectRoot /*, history: historyStore*/ });

  function attachRun(runHandle) {
    RUNS.set(runHandle.id, runHandle);
    const unsubscribe = runHandle.onEvent((e) => {
      broadcastEventToSubscribers(runHandle.id, e);
    });
    const cleanup = () => {
      unsubscribe();
      RUNS.delete(runHandle.id);
      RUN_SUBSCRIBERS.delete(runHandle.id);
    };
    runHandle.onEvent((e) => {
      if (e.type === 'run/cancelled' || e.type === 'run/completed') cleanup();
    });
  }

  ipcMain.handle(IPC_HANDLER_KEYS.FACTORY_START_TASK, (_evt, { projectId, taskId, llmConfig, budgetUSD, metadata }) => {
    const run = orchestrator.startTaskRun({ projectId, taskId, llmConfig, budgetUSD, metadata });
    attachRun(run);
    return { runId: run.id };
  });

  ipcMain.handle(IPC_HANDLER_KEYS.FACTORY_START_FEATURE, (_evt, { projectId, taskId, featureId, llmConfig, budgetUSD, metadata }) => {
    const run = orchestrator.startFeatureRun({ projectId, taskId, featureId, llmConfig, budgetUSD, metadata });
    attachRun(run);
    return { runId: run.id };
  });

  ipcMain.handle(IPC_HANDLER_KEYS.FACTORY_CANCEL_RUN, (_evt, { runId, reason }) => {
    const run = RUNS.get(runId);
    if (run) run.cancel(reason);
    return { ok: true };
  });

  ipcMain.on(IPC_HANDLER_KEYS.FACTORY_SUBSCRIBE, (evt, { runId }) => {
    const wcId = evt.sender.id;
    let set = RUN_SUBSCRIBERS.get(runId);
    if (!set) {
      set = new Set();
      RUN_SUBSCRIBERS.set(runId, set);
    }
    set.add(wcId);
    evt.sender.once('destroyed', () => {
      const s = RUN_SUBSCRIBERS.get(runId);
      if (s) s.delete(wcId);
    });
  });
}
