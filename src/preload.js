import { contextBridge, ipcRenderer } from 'electron';

// Tasks API: Data access + mutations only. UI navigation (modals) is handled in the renderer via Navigator/ModalHost.
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
  onSetTaskId: (callback) => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('set-task-id', listener);
    return () => ipcRenderer.removeListener('set-task-id', listener);
  }
};

// Docs Index API exposed to renderer as window.docsIndex
const DOCS_API = {
  get: () => ipcRenderer.invoke('docs-index:get'),
  subscribe: (callback) => {
    const listener = (_event, snapshot) => callback(snapshot);
    ipcRenderer.on('docs-index:update', listener);
    return () => ipcRenderer.removeListener('docs-index:update', listener);
  },
  getFile: (relPath) => ipcRenderer.invoke('docs-file:get', { relPath }),
  saveFile: (relPath, content) => ipcRenderer.invoke('docs-file:save', { relPath, content }),
  upload: (name, content) => ipcRenderer.invoke('docs:upload', { name, content }),
};

const CHAT_API = {
  getCompletion: (messages, config) => ipcRenderer.invoke('chat:completion', {messages, config}),
  list: () => ipcRenderer.invoke('chat:list'),
  create: () => ipcRenderer.invoke('chat:create'),
  load: (chatId) => ipcRenderer.invoke('chat:load', chatId),
  save: (chatId, messages) => ipcRenderer.invoke('chat:save', {chatId, messages}),
  delete: (chatId) => ipcRenderer.invoke('chat:delete', chatId),
};

contextBridge.exposeInMainWorld('tasksIndex', TASKS_API);
contextBridge.exposeInMainWorld('docsIndex', DOCS_API);
contextBridge.exposeInMainWorld('chat', CHAT_API);
