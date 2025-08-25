const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tasksIndex', {
  getSnapshot: async () => {
    return await ipcRenderer.invoke('tasks-index:get');
  },
  onUpdate: (cb) => {
    const listener = (_event, data) => cb(data);
    ipcRenderer.on('tasks-index:update', listener);
    return () => ipcRenderer.removeListener('tasks-index:update', listener);
  },
  updateFeature: async (taskId, featureId, data) => {
    return await ipcRenderer.invoke('tasks-feature:update', { taskId, featureId, data });
  }
});
