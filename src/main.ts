import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import url from 'node:url';
import { createOrchestrator } from '../packages/factory-ts/src/orchestrator';
import { toEventSourceLike } from '../packages/factory-ts/src/adapters/electronShim';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // In dev we assume Vite dev server serves index.html at localhost
  const devServer = process.env.VITE_DEV_SERVER_URL;
  if (devServer) {
    mainWindow.loadURL(devServer);
  } else {
    mainWindow.loadURL(url.pathToFileURL(path.join(__dirname, '../index.html')).href);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Orchestrator instance in main
const orchestrator = createOrchestrator();

// Run registry: runId -> listeners count
const runListeners = new Map<string, { unsubscribe?: () => void }>();

ipcMain.handle('factory:start-task', (_ev, args: { projectId: string; taskId: string | number }) => {
  const handle = orchestrator.startTaskRun(args);
  const runId = handle.id;
  return { runId };
});

ipcMain.handle('factory:start-feature', (_ev, args: { projectId: string; taskId: string | number; featureId: string | number }) => {
  const handle = orchestrator.startFeatureRun(args);
  const runId = handle.id;
  return { runId };
});

ipcMain.handle('factory:cancel', (_ev, args: { runId: string; reason?: string }) => {
  orchestrator.cancel(args.runId, args.reason);
  return { ok: true };
});

// Event subscription: renderer asks to subscribe and we forward events via ipc
ipcMain.on('factory:events:subscribe', (event, args: { runId: string }) => {
  const { runId } = args;
  // locate handle: orchestrator holds internal map; we subscribe at bus level through toEventSourceLike
  // toEventSourceLike needs a RunHandle; create a synthetic handle from orchestrator by starting a cancel-only wrapper
  // However, we can use the internal map by hooking via orchestrator methods. Simplest: expose a bus subscribe via a temp handle pattern.

  // Create a lightweight listener by hooking DefaultRunHandle's onEvent through a WeakRef API present on returned handles.
  // Since we don't have direct Handle access here, we rely on orchestrator.addUsageToRun events snapshot to not be needed.
  // Alternative: keep a local map of run handles when starting runs.
});

// To keep handles for event forwarding, intercept start handlers above and retain handles
const runHandles = new Map<string, any>();

// Re-define start handlers to save handles
ipcMain.removeHandler('factory:start-task');
ipcMain.removeHandler('factory:start-feature');

ipcMain.handle('factory:start-task', (_ev, args: { projectId: string; taskId: string | number }) => {
  const handle = orchestrator.startTaskRun(args);
  runHandles.set(handle.id, handle);
  return { runId: handle.id };
});

ipcMain.handle('factory:start-feature', (_ev, args: { projectId: string; taskId: string | number; featureId: string | number }) => {
  const handle = orchestrator.startFeatureRun(args);
  runHandles.set(handle.id, handle);
  return { runId: handle.id };
});

ipcMain.on('factory:events:subscribe', (event, args: { runId: string }) => {
  const handle = runHandles.get(args.runId);
  if (!handle) {
    event.sender.send('factory:event', { runId: args.runId, type: 'run/error', payload: { message: 'Unknown runId' }, time: new Date().toISOString() });
    return;
  }
  const unsubscribe = handle.onEvent((e: any) => {
    event.sender.send('factory:event', e);
  });
  runListeners.set(args.runId, { unsubscribe });
});

ipcMain.on('factory:events:unsubscribe', (_event, args: { runId: string }) => {
  const entry = runListeners.get(args.runId);
  if (entry?.unsubscribe) entry.unsubscribe();
  runListeners.delete(args.runId);
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
