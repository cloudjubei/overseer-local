import { contextBridge, ipcRenderer } from 'electron';

// Keep an internal snapshot of files index for synchronous access by renderer FileService
let __filesIndexSnapshot = { files: [] };

// Expose a minimal filesIndex object that FileService can read synchronously
const FILES_INDEX_BRIDGE = {
  list: () => (__filesIndexSnapshot.files || []),
  get files() { return __filesIndexSnapshot.files || []; },
};

// Prime and subscribe to files-index updates from main/indexer
(async () => {
  try {
    const snap = await ipcRenderer.invoke('files-index:get');
    __filesIndexSnapshot = snap || { files: [] };
  } catch {
    __filesIndexSnapshot = { files: [] };
  }
})();

ipcRenderer.on('files-index:update', (_event, snapshot) => {
  __filesIndexSnapshot = snapshot || { files: [] };
});

// Provide Files content helpers used by renderer fileService (best-effort bridges)
const FILES_API = {
  getSnapshot: () => ipcRenderer.invoke('files-index:get'),
  onUpdate: (callback) => {
    const listener = (_event, snapshot) => callback(snapshot);
    ipcRenderer.on('files-index:update', listener);
    return () => ipcRenderer.removeListener('files-index:update', listener);
  },
  readFile: (relPath, encoding = 'utf8') => ipcRenderer.invoke('files:read', { relPath, encoding }),
  readFileBinary: (relPath) => ipcRenderer.invoke('files:read-binary', { relPath }),
  writeFile: (relPath, content, encoding = 'utf8') => ipcRenderer.invoke('files:write', { relPath, content, encoding }),
  ensureDir: (relPath) => ipcRenderer.invoke('files:ensure-dir', { relPath }),
  upload: (name, content) => ipcRenderer.invoke('files:upload', { name, content }),
  // set active files context (project-aware)
  setContext: (projectId) => ipcRenderer.invoke('files:set-context', { projectId }),
};

// Tasks API: Data access + mutations only. UI navigation (modals) is handled in the renderer via Navigator/ModalHost.
const TASKS_API = {
  getSnapshot: () => ipcRenderer.invoke('tasks-index:get'),
  onUpdate: (callback) => {
    const listener = (_event, ...args) => callback(...args);
    ipcRenderer.on('tasks-index:update', listener);
    return () => ipcRenderer.removeListener('tasks-index:update', listener);
  },
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

const CHAT_API = {
  getCompletion: (messages, config) => ipcRenderer.invoke('chat:completion', {messages, config}),
  listModels: (config) => ipcRenderer.invoke('chat:list-models', config),
  list: () => ipcRenderer.invoke('chat:list'),
  create: () => ipcRenderer.invoke('chat:create'),
  load: (chatId) => ipcRenderer.invoke('chat:load', chatId),
  save: (chatId, messages) => ipcRenderer.invoke('chat:save', {chatId, messages}),
  delete: (chatId) => ipcRenderer.invoke('chat:delete', chatId),
  // NEW: set active chat context (project-aware)
  setContext: (projectId) => ipcRenderer.invoke('chat:set-context', { projectId }),
};

const NOTIFICATIONS_API = {
  sendOs: (data) => ipcRenderer.invoke('notifications:send-os', data),
  onClicked: (callback) => {
    const listener = (_event, metadata) => callback(metadata);
    ipcRenderer.on('notifications:clicked', listener);
    return () => ipcRenderer.removeListener('notifications:clicked', listener);
  }
};

// Screenshot capture API
const SCREENSHOT_API = {
  /**
   * Capture a screenshot.
   * @param {Object} options
   * @param {number} [options.windowId]
   * @param {{x:number,y:number,width:number,height:number}} [options.rect]
   * @param {'png'|'jpeg'} [options.format]
   * @param {number} [options.quality] // 0-100 (jpeg only)
   * @returns {{ok: boolean, dataUrl?: string, width?: number, height?: number, format?: string, error?: string}}
   */
  capture: (options) => ipcRenderer.invoke('screenshot:capture', options),
};

// Projects Index + CRUD API
const PROJECTS_API = {
  get: () => ipcRenderer.invoke('projects-index:get'),
  subscribe: (callback) => {
    const listener = (_event, snapshot) => callback(snapshot);
    ipcRenderer.on('projects-index:update', listener);
    return () => ipcRenderer.removeListener('projects-index:update', listener);
  },
  create: (spec) => ipcRenderer.invoke('projects:create', { spec }),
  update: (id, spec) => ipcRenderer.invoke('projects:update', { id, spec }),
  delete: (id) => ipcRenderer.invoke('projects:delete', { id }),
};

contextBridge.exposeInMainWorld('tasksIndex', TASKS_API);
contextBridge.exposeInMainWorld('chat', CHAT_API);
contextBridge.exposeInMainWorld('notifications', NOTIFICATIONS_API);
contextBridge.exposeInMainWorld('projectsIndex', PROJECTS_API);
contextBridge.exposeInMainWorld('screenshot', SCREENSHOT_API);
// Expose files index + bridges for renderer FileService
contextBridge.exposeInMainWorld('filesIndex', FILES_INDEX_BRIDGE);
contextBridge.exposeInMainWorld('files', FILES_API);
