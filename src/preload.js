import { contextBridge, ipcRenderer } from 'electron';
import IPC_HANDLER_KEYS from "./ipcHandlersKeys"

const FILES_API = {
  get: () => ipcRenderer.invoke(IPC_HANDLER_KEYS.FILES_GET),
  subscribe: (callback) => {
    const listener = (_event, snapshot) => callback(snapshot);
    ipcRenderer.on(IPC_HANDLER_KEYS.FILES_SUBSCRIBE, listener);
    return () => ipcRenderer.removeListener(IPC_HANDLER_KEYS.FILES_SUBSCRIBE, listener);
  },
  readFile: (relPath, encoding = 'utf8') => ipcRenderer.invoke(IPC_HANDLER_KEYS.FILES_READ, { relPath, encoding }),
  readFileBinary: (relPath) => ipcRenderer.invoke(IPC_HANDLER_KEYS.FILES_READ_BINARY, { relPath }),
  writeFile: (relPath, content, encoding = 'utf8') => ipcRenderer.invoke(IPC_HANDLER_KEYS.FILES_WRITE, { relPath, content, encoding }),
  deleteFile: (relPath) => ipcRenderer.invoke(IPC_HANDLER_KEYS.FILES_DELETE, { relPath }),
  renameFile: (relPathSource, relPathTarget) => ipcRenderer.invoke(IPC_HANDLER_KEYS.FILES_RENAME, { relPathSource, relPathTarget }),
  ensureDir: (relPath) => ipcRenderer.invoke(IPC_HANDLER_KEYS.FILES_ENSURE_DIR, { relPath }),
  upload: (name, content) => ipcRenderer.invoke(IPC_HANDLER_KEYS.FILES_UPLOAD, { name, content }),
  setContext: (projectId) => ipcRenderer.invoke(IPC_HANDLER_KEYS.FILES_SET_CONTEXT, { projectId }),
};

// Tasks API now follows Projects pattern
const TASKS_API = {
  getSnapshot: () => ipcRenderer.invoke(IPC_HANDLER_KEYS.TASKS_GET),
  subscribe: (callback) => {
    const listener = (_event) => callback();
    ipcRenderer.on(IPC_HANDLER_KEYS.TASKS_SUBSCRIBE, listener);
    return () => ipcRenderer.removeListener(IPC_HANDLER_KEYS.TASKS_SUBSCRIBE, listener);
  },
  // Back-compat signature for existing consumers expecting onUpdate(callback: (snapshot) => void)
  onUpdate: (callback) => {
    const listener = async () => {
      try {
        const snap = await TASKS_API.getSnapshot();
        callback(snap);
      } catch {
        callback(undefined);
      }
    };
    ipcRenderer.on(IPC_HANDLER_KEYS.TASKS_SUBSCRIBE, listener);
    return () => ipcRenderer.removeListener(IPC_HANDLER_KEYS.TASKS_SUBSCRIBE, listener);
  },
  updateTask: (taskId, data) => ipcRenderer.invoke(IPC_HANDLER_KEYS.TASKS_UPDATE, { taskId, data }),
  updateFeature: (taskId, featureId, data) => ipcRenderer.invoke(IPC_HANDLER_KEYS.TASKS_FEATURE_UPDATE, { taskId, featureId, data }),
  addFeature: (taskId, feature) => ipcRenderer.invoke(IPC_HANDLER_KEYS.TASKS_FEATURE_CREATE, { taskId, feature }),
  deleteFeature: (taskId, featureId) => ipcRenderer.invoke(IPC_HANDLER_KEYS.TASKS_FEATURE_DELETE, { taskId, featureId }),
  reorderFeatures: (taskId, payload) => ipcRenderer.invoke(IPC_HANDLER_KEYS.TASKS_FEATURES_REORDER, { taskId, payload }),
  reorderTasks: (payload) => ipcRenderer.invoke(IPC_HANDLER_KEYS.TASKS_REORDER, { payload }),
  addTask: (task) => ipcRenderer.invoke(IPC_HANDLER_KEYS.TASKS_CREATE, { task }),
  deleteTask: (taskId) => ipcRenderer.invoke(IPC_HANDLER_KEYS.TASKS_DELETE, { taskId }),
  onSetTaskId: (callback) => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('set-task-id', listener);
    return () => ipcRenderer.removeListener('set-task-id', listener);
  },
  setContext: (projectId) => ipcRenderer.invoke(IPC_HANDLER_KEYS.TASKS_SET_CONTEXT, { projectId }),
};

// Chats API exposed as a service (mirrors projectsService style)
const CHATS_API = {
  getCompletion: (messages, config) => ipcRenderer.invoke(IPC_HANDLER_KEYS.CHATS_COMPLETION, { messages, config }),
  listModels: (config) => ipcRenderer.invoke(IPC_HANDLER_KEYS.CHATS_LIST_MODELS, config),
  list: () => ipcRenderer.invoke(IPC_HANDLER_KEYS.CHATS_LIST),
  create: () => ipcRenderer.invoke(IPC_HANDLER_KEYS.CHATS_CREATE),
  load: (chatId) => ipcRenderer.invoke(IPC_HANDLER_KEYS.CHATS_LOAD, { chatId }),
  save: (chatId, messages) => ipcRenderer.invoke(IPC_HANDLER_KEYS.CHATS_SAVE, { chatId, messages }),
  delete: (chatId) => ipcRenderer.invoke(IPC_HANDLER_KEYS.CHATS_DELETE, { chatId }),
  setContext: (projectId) => ipcRenderer.invoke(IPC_HANDLER_KEYS.CHATS_SET_CONTEXT, { projectId }),
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
  capture: (options) => ipcRenderer.invoke('screenshot:capture', options),
};

const PROJECTS_API = {
  subscribe: (callback) => {
    const listener = (_event, snapshot) => callback();
    ipcRenderer.on(IPC_HANDLER_KEYS.PROJECTS_SUBSCRIBE, listener);
    return () => ipcRenderer.removeListener(IPC_HANDLER_KEYS.PROJECTS_SUBSCRIBE, listener);
  },
  list: (id) => ipcRenderer.invoke(IPC_HANDLER_KEYS.PROJECTS_LIST),
  get: (id) => ipcRenderer.invoke(IPC_HANDLER_KEYS.PROJECTS_GET, { id }),
  create: (spec) => ipcRenderer.invoke(IPC_HANDLER_KEYS.PROJECTS_CREATE, { spec }),
  update: (id, spec) => ipcRenderer.invoke(IPC_HANDLER_KEYS.PROJECTS_UPDATE, { id, spec }),
  delete: (id) => ipcRenderer.invoke(IPC_HANDLER_KEYS.PROJECTS_DELETE, { id }),
};

contextBridge.exposeInMainWorld('tasksService', TASKS_API);
// Back-compat alias (older code may use window.tasksIndex)
contextBridge.exposeInMainWorld('tasksIndex', TASKS_API);
contextBridge.exposeInMainWorld('notifications', NOTIFICATIONS_API);
contextBridge.exposeInMainWorld('projectsService', PROJECTS_API);
contextBridge.exposeInMainWorld('screenshot', SCREENSHOT_API);
contextBridge.exposeInMainWorld('filesService', FILES_API);
contextBridge.exposeInMainWorld('files', FILES_API);
contextBridge.exposeInMainWorld('chatsService', CHATS_API);
