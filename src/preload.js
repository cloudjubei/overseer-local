import { contextBridge, ipcRenderer } from 'electron';
import IPC_HANDLER_KEYS from "./ipcHandlersKeys"

const FILES_API = {
  subscribe: (callback) => {
    const listener = (_event) => callback();
    ipcRenderer.on(IPC_HANDLER_KEYS.FILES_SUBSCRIBE, listener);
    return () => ipcRenderer.removeListener(IPC_HANDLER_KEYS.FILES_SUBSCRIBE, listener);
  },
  listFiles: (project) => ipcRenderer.invoke(IPC_HANDLER_KEYS.FILES_LIST, { project }),
  readFile: (project, relPath, encoding = 'utf8') => ipcRenderer.invoke(IPC_HANDLER_KEYS.FILES_READ, { project, relPath, encoding }),
  readFileBinary: (project, relPath) => ipcRenderer.invoke(IPC_HANDLER_KEYS.FILES_READ_BINARY, { project, relPath }),
  readDirectory: (project, relPath) => ipcRenderer.invoke(IPC_HANDLER_KEYS.FILES_READ_DIRECTORY, { project, relPath }),
  writeFile: (project, relPath, content, encoding = 'utf8') => ipcRenderer.invoke(IPC_HANDLER_KEYS.FILES_WRITE, { project, relPath, content, encoding }),
  deleteFile: (project, relPath) => ipcRenderer.invoke(IPC_HANDLER_KEYS.FILES_DELETE, { project, relPath }),
  renameFile: (project, relPathSource, relPathTarget) => ipcRenderer.invoke(IPC_HANDLER_KEYS.FILES_RENAME, { project, relPathSource, relPathTarget }),
  uploadFile: (project, name, content) => ipcRenderer.invoke(IPC_HANDLER_KEYS.FILES_UPLOAD, { project, name, content })
};

const TASKS_API = {
  subscribe: (callback) => {
    const listener = (_event) => callback();
    ipcRenderer.on(IPC_HANDLER_KEYS.TASKS_SUBSCRIBE, listener);
    return () => ipcRenderer.removeListener(IPC_HANDLER_KEYS.TASKS_SUBSCRIBE, listener);
  },
  listTasks: (project) => ipcRenderer.invoke(IPC_HANDLER_KEYS.TASKS_LIST, { project }),
  getTask: (project, taskId) => ipcRenderer.invoke(IPC_HANDLER_KEYS.TASKS_GET, { project, taskId }),
  createTask: (project, task) => ipcRenderer.invoke(IPC_HANDLER_KEYS.TASKS_CREATE, { project, task }),
  updateTask: (project, taskId, data) => ipcRenderer.invoke(IPC_HANDLER_KEYS.TASKS_UPDATE, { project, taskId, data }),
  deleteTask: (project, taskId) => ipcRenderer.invoke(IPC_HANDLER_KEYS.TASKS_DELETE, { project, taskId }),
  getFeature: (project, featureId) => ipcRenderer.invoke(IPC_HANDLER_KEYS.TASKS_FEATURE_GET, { project, featureId }),
  addFeature: (project, taskId, feature) => ipcRenderer.invoke(IPC_HANDLER_KEYS.TASKS_FEATURE_ADD, { project, taskId, feature }),
  updateFeature: (project, taskId, featureId, data) => ipcRenderer.invoke(IPC_HANDLER_KEYS.TASKS_FEATURE_UPDATE, { project, taskId, featureId, data }),
  deleteFeature: (project, taskId, featureId) => ipcRenderer.invoke(IPC_HANDLER_KEYS.TASKS_FEATURE_DELETE, { project, taskId, featureId }),
  reorderFeatures: (project, taskId, payload) => ipcRenderer.invoke(IPC_HANDLER_KEYS.TASKS_FEATURES_REORDER, { project, taskId, payload }),

  getReferencesOutbound: (project, reference) => ipcRenderer.invoke(IPC_HANDLER_KEYS.TASKS_REFERENCES_OUTBOUND, { project, reference }),
  getReferencesInbound: (project, reference) => ipcRenderer.invoke(IPC_HANDLER_KEYS.TASKS_REFERENCES_INBOUND, { project, reference }),
  validateReference: (project, reference) => ipcRenderer.invoke(IPC_HANDLER_KEYS.TASKS_REFERENCE_VALIDATE, { project, reference }),
  validateReferences: (project, reference, proposed) => ipcRenderer.invoke(IPC_HANDLER_KEYS.TASKS_REFERENCES_VALIDATE, { project, reference, proposed }),
  searchReferences: (project, query, limit) => ipcRenderer.invoke(IPC_HANDLER_KEYS.TASKS_REFERENCES_SEARCH, { project, query, limit })
};

const CHATS_API = {
  getCompletion: (messages, config) => ipcRenderer.invoke(IPC_HANDLER_KEYS.CHATS_COMPLETION, { messages, config }),
  listModels: (config) => ipcRenderer.invoke(IPC_HANDLER_KEYS.CHATS_LIST_MODELS, { config }),
  listChats: (project) => ipcRenderer.invoke(IPC_HANDLER_KEYS.CHATS_LIST, { project }),
  createChat: (project) => ipcRenderer.invoke(IPC_HANDLER_KEYS.CHATS_CREATE, { project }),
  loadChat: (project, chatId) => ipcRenderer.invoke(IPC_HANDLER_KEYS.CHATS_LOAD, { project, chatId }),
  saveChat: (project, chatId, messages) => ipcRenderer.invoke(IPC_HANDLER_KEYS.CHATS_SAVE, { cproject, hatId, messages }),
  deleteChat: (project, chatId) => ipcRenderer.invoke(IPC_HANDLER_KEYS.CHATS_DELETE, { project, chatId }),
};

const NOTIFICATIONS_API = {
  onOpenNotification: (callback) => {
    const listener = (_event, metadata) => callback(metadata);
    ipcRenderer.on(IPC_HANDLER_KEYS.NOTIFICATIONS_ON_OPEN, listener);
    return () => ipcRenderer.removeListener(IPC_HANDLER_KEYS.NOTIFICATIONS_ON_OPEN, listener);
  },

  sendOs: (data) => ipcRenderer.invoke(IPC_HANDLER_KEYS.NOTIFICATIONS_SEND_OS, data),
  subscribe: (callback) => {
    const listener = (_event, snapshot) => callback();
    ipcRenderer.on(IPC_HANDLER_KEYS.NOTIFICATIONS_SUBSCRIBE, listener);
    return () => ipcRenderer.removeListener(IPC_HANDLER_KEYS.NOTIFICATIONS_SUBSCRIBE, listener);
  },
  getRecentNotifications: (project) => ipcRenderer.invoke(IPC_HANDLER_KEYS.NOTIFICATIONS_RECENT, { project }),
  getUnreadNotificationsCount: (project) => ipcRenderer.invoke(IPC_HANDLER_KEYS.NOTIFICATIONS_UNREADCOUNT, { project }),
  markAllNotificationsAsRead: (project) => ipcRenderer.invoke(IPC_HANDLER_KEYS.NOTIFICATIONS_MARKALLASREAD, { project }),
  markNotificationAsRead: (project, id) => ipcRenderer.invoke(IPC_HANDLER_KEYS.NOTIFICATIONS_MARKASREAD, { project, id }),
  deleteAllNotifications: (project) => ipcRenderer.invoke(IPC_HANDLER_KEYS.NOTIFICATIONS_DELETEALL, { project }),
  getSystemPreferences: () => ipcRenderer.invoke(IPC_HANDLER_KEYS.NOTIFICATIONS_PREFERENCES_SYSTEM),
  updateSystemPreferences: (updates) => ipcRenderer.invoke(IPC_HANDLER_KEYS.NOTIFICATIONS_PREFERENCES_SYSTEM_UPDATE, { updates }),
  getProjectPreferences: (project) => ipcRenderer.invoke(IPC_HANDLER_KEYS.NOTIFICATIONS_PREFERENCES_PROJECT, { project }),
  updateProjectPreferences: (project, updates) => ipcRenderer.invoke(IPC_HANDLER_KEYS.NOTIFICATIONS_PREFERENCES_PROJECT_UPDATE, { project, updates }),
};

const PROJECTS_API = {
  subscribe: (callback) => {
    const listener = (_event, snapshot) => callback();
    ipcRenderer.on(IPC_HANDLER_KEYS.PROJECTS_SUBSCRIBE, listener);
    return () => ipcRenderer.removeListener(IPC_HANDLER_KEYS.PROJECTS_SUBSCRIBE, listener);
  },
  listProjects: () => ipcRenderer.invoke(IPC_HANDLER_KEYS.PROJECTS_LIST),
  getProject: (id) => ipcRenderer.invoke(IPC_HANDLER_KEYS.PROJECTS_GET, { id }),
  createProject: (project) => ipcRenderer.invoke(IPC_HANDLER_KEYS.PROJECTS_CREATE, { project }),
  updateProject: (id, project) => ipcRenderer.invoke(IPC_HANDLER_KEYS.PROJECTS_UPDATE, { id, project }),
  deleteProject: (id) => ipcRenderer.invoke(IPC_HANDLER_KEYS.PROJECTS_DELETE, { id }),
  reorderTask: (project, fromIndex, toIndex) => ipcRenderer.invoke(IPC_HANDLER_KEYS.PROJECTS_TASK_REORDER, { project, fromIndex, toIndex }),
};

const SCREENSHOT_API = {
  capture: (options) => ipcRenderer.invoke('screenshot:capture', options),
};

contextBridge.exposeInMainWorld('tasksService', TASKS_API);
contextBridge.exposeInMainWorld('projectsService', PROJECTS_API);
contextBridge.exposeInMainWorld('filesService', FILES_API);
contextBridge.exposeInMainWorld('chatsService', CHATS_API);
contextBridge.exposeInMainWorld('notificationsService', NOTIFICATIONS_API);
contextBridge.exposeInMainWorld('screenshot', SCREENSHOT_API);
