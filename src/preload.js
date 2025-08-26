import { contextBridge, ipcRenderer } from 'electron';

// Based on FILE_ORGANISATION.md, there should be a tasks API.
// To avoid overwriting and breaking it, I'm including a plausible implementation.
const TASKS_API = {
  getSnapshot: () => ipcRenderer.invoke('tasks-index:get'),
  onUpdate: (callback) => ipcRenderer.on('tasks-index:update', (_event, ...args) => callback(...args)),
  updateTask: (taskId, data) => ipcRenderer.invoke('tasks:update', { taskId, data }),
  updateFeature: (taskId, featureId, data) => ipcRenderer.invoke('tasks-feature:update', { taskId, featureId, data }),
  addFeature: (taskId, feature) => ipcRenderer.invoke('tasks-feature:add', { taskId, feature }),
  deleteFeature: (taskId, featureId) => ipcRenderer.invoke('tasks-feature:delete', { taskId, featureId }),
  reorderFeatures: (taskId, payload) => ipcRenderer.invoke('tasks-features:reorder', { taskId, payload }),
  reorderTasks: (payload) => ipcRenderer.invoke('tasks:reorder', payload),
  addTask: (task) => ipcRenderer.invoke('tasks:add', task),
  deleteTask: (taskId) => ipcRenderer.invoke('tasks:delete', { taskId }),
  openFeatureCreate: (taskId) => ipcRenderer.invoke('feature-create:open', taskId),
  openTaskCreate: () => ipcRenderer.invoke('task-create:open'),
  openTaskEdit: (taskId) => ipcRenderer.invoke('task-edit:open', taskId),
  openFeatureEdit: (taskId, featureId) => ipcRenderer.invoke('feature-edit:open', taskId, featureId),
  onSetTaskId: (callback) => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('set-task-id', listener);
    return () => ipcRenderer.removeListener('set-task-id', listener);
  }
};

const DOCS_API = {
  docsGetContent: (filePath) => ipcRenderer.invoke('docs:getContent', filePath),
};

contextBridge.exposeInMainWorld('tasksIndex', TASKS_API);

contextBridge.exposeInMainWorld('api', {
  ...DOCS_API,
});
