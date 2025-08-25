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
  updateTask: async (taskId, data) => {
    return await ipcRenderer.invoke('tasks:update', { taskId, data });
  },
  updateFeature: async (taskId, featureId, data) => {
    return await ipcRenderer.invoke('tasks-feature:update', { taskId, featureId, data });
  },
  addFeature: async (taskId, feature) => {
    return await ipcRenderer.invoke('tasks-feature:add', { taskId, feature });
  },
  addTask: async (task) => {
    return await ipcRenderer.invoke('tasks:add', task);
  }
});

contextBridge.exposeInMainWorld('docsIndex', {
  getSnapshot: async () => {
    return await ipcRenderer.invoke('docs-index:get');
  },
  onUpdate: (cb) => {
    const listener = (_event, data) => cb(data);
    ipcRenderer.on('docs-index:update', listener);
    return () => ipcRenderer.removeListener('docs-index:update', listener);
  },
  getFile: async (relativePath) => {
    return await ipcRenderer.invoke('docs-file:get', relativePath);
  },
  getRenderedMarkdown: async (relativePath) => {
    return await ipcRenderer.invoke('docs-file:render', relativePath);
  },
  saveFile: async (relativePath, content) => {
    return await ipcRenderer.invoke('docs-file:save', { relativePath, content });
  }
});
