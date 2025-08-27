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
  },
  // NEW: set active tasks context (project-aware)
  setContext: (projectId) => ipcRenderer.invoke('tasks:set-context', { projectId }),
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
  // NEW: set active docs context (project-aware)
  setContext: (projectId) => ipcRenderer.invoke('docs:set-context', { projectId }),
};

const CHAT_API = {
  getCompletion: (messages, config) => ipcRenderer.invoke('chat:completion', {messages, config}),
  listModels: (config) => ipcRenderer.invoke('chat:list-models', config),
  list: () => ipcRenderer.invoke('chat:list'),
  create: () => ipcRenderer.invoke('chat:create'),
  load: (chatId) => ipcRenderer.invoke('chat:load', chatId),
  save: (chatId, messages) => ipcRenderer.invoke('chat:save', {chatId, messages}),
  delete: (chatId) => ipcRenderer.invoke('chat:delete', chatId),
};

const NOTIFICATIONS_API = {
  sendOs: (data) => ipcRenderer.invoke('notifications:send-os', data),
  onClicked: (callback) => {
    ipcRenderer.on('notifications:clicked', (_event, metadata) => callback(metadata));
    return () => ipcRenderer.removeListener('notifications:clicked', callback);
  }
};

// Projects Index API
const PROJECTS_API = {
  get: () => ipcRenderer.invoke('projects-index:get'),
  subscribe: (callback) => {
    const listener = (_event, snapshot) => callback(snapshot);
    ipcRenderer.on('projects-index:update', listener);
    return () => ipcRenderer.removeListener('projects-index:update', listener);
  },
};

contextBridge.exposeInMainWorld('tasksIndex', TASKS_API);
contextBridge.exposeInMainWorld('docsIndex', DOCS_API);
contextBridge.exposeInMainWorld('chat', CHAT_API);
contextBridge.exposeInMainWorld('notifications', NOTIFICATIONS_API);
contextBridge.exposeInMainWorld('projectsIndex', PROJECTS_API);
