import { contextBridge, ipcRenderer } from 'electron';

function startTaskRun(projectId: string, taskId: string) {
  return ipcRenderer.invoke('factory:start-task', { projectId, taskId });
}

function startFeatureRun(projectId: string, taskId: string, featureId: string) {
  return ipcRenderer.invoke('factory:start-feature', { projectId, taskId, featureId });
}

function cancelRun(runId: string) {
  return ipcRenderer.invoke('factory:cancel', { runId });
}

function subscribe(runId: string, onEvent: (e: any) => void) {
  const handler = (_event: any, e: any) => {
    if (e.runId === runId) onEvent(e);
  };
  ipcRenderer.on('factory:event', handler);
  ipcRenderer.send('factory:events:subscribe', { runId });
  return () => {
    ipcRenderer.send('factory:events:unsubscribe', { runId });
    ipcRenderer.removeListener('factory:event', handler);
  };
}

contextBridge.exposeInMainWorld('factory', {
  startTaskRun,
  startFeatureRun,
  cancelRun,
  subscribe,
});

export {};
