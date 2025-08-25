const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tasksIndex', {
  getSnapshot: () => ipcRenderer.invoke('tasks-index:get'),
  onUpdate: (callback) => {
      const listener = (_event, value) => callback(value);
      ipcRenderer.on('tasks-index:update', listener);
      return () => ipcRenderer.removeListener('tasks-index:update', listener);
  },
  deleteFeature: (taskId, featureId) => ipcRenderer.invoke('tasks-feature:delete', { taskId, featureId }),
  deleteTask: (taskId) => ipcRenderer.invoke('tasks:delete', { taskId }),
});
