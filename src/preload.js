import { contextBridge, ipcRenderer } from 'electron'
import IPC_HANDLER_KEYS from './ipcHandlersKeys'

const FILES_API = {
  subscribe: (callback) => {
    const listener = (_event, files) => callback(files)
    ipcRenderer.on(IPC_HANDLER_KEYS.FILES_SUBSCRIBE, listener)
    return () => ipcRenderer.removeListener(IPC_HANDLER_KEYS.FILES_SUBSCRIBE, listener)
  },
  listFiles: (projectId) => ipcRenderer.invoke(IPC_HANDLER_KEYS.FILES_LIST, { projectId }),
  readFile: (projectId, relPath, encoding = 'utf8') =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.FILES_READ, { projectId, relPath, encoding }),
  readFileBinary: (projectId, relPath) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.FILES_READ_BINARY, { projectId, relPath }),
  readDirectory: (projectId, relPath) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.FILES_READ_DIRECTORY, { projectId, relPath }),
  writeFile: (projectId, relPath, content, encoding = 'utf8') =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.FILES_WRITE, { projectId, relPath, content, encoding }),
  deleteFile: (projectId, relPath) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.FILES_DELETE, { projectId, relPath }),
  renameFile: (projectId, relPathSource, relPathTarget) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.FILES_RENAME, { projectId, relPathSource, relPathTarget }),
  uploadFile: (projectId, name, content) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.FILES_UPLOAD, { projectId, name, content }),
}

const TASKS_API = {
  subscribe: (callback) => {
    const listener = (_event, tasks) => callback(tasks)
    ipcRenderer.on(IPC_HANDLER_KEYS.TASKS_SUBSCRIBE, listener)
    return () => ipcRenderer.removeListener(IPC_HANDLER_KEYS.TASKS_SUBSCRIBE, listener)
  },
  listTasks: (projectId) => ipcRenderer.invoke(IPC_HANDLER_KEYS.TASKS_LIST, { projectId }),
  getTask: (projectId, taskId) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.TASKS_GET, { projectId, taskId }),
  createTask: (projectId, task) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.TASKS_CREATE, { projectId, task }),
  updateTask: (projectId, taskId, data) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.TASKS_UPDATE, { projectId, taskId, data }),
  deleteTask: (projectId, taskId) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.TASKS_DELETE, { projectId, taskId }),
  getFeature: (projectId, featureId) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.TASKS_FEATURE_GET, { projectId, featureId }),
  addFeature: (projectId, taskId, feature) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.TASKS_FEATURE_ADD, { projectId, taskId, feature }),
  updateFeature: (projectId, taskId, featureId, data) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.TASKS_FEATURE_UPDATE, {
      projectId,
      taskId,
      featureId,
      data,
    }),
  deleteFeature: (projectId, taskId, featureId) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.TASKS_FEATURE_DELETE, { projectId, taskId, featureId }),
  reorderFeatures: (projectId, taskId, payload) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.TASKS_FEATURES_REORDER, { projectId, taskId, payload }),
}

const CHATS_API = {
  listModels: (config) => ipcRenderer.invoke(IPC_HANDLER_KEYS.CHATS_LIST_MODELS, { config }),
  subscribe: (callback) => {
    const listener = (_event, chats) => callback(chats)
    ipcRenderer.on(IPC_HANDLER_KEYS.CHATS_SUBSCRIBE, listener)
    return () => ipcRenderer.removeListener(IPC_HANDLER_KEYS.CHATS_SUBSCRIBE, listener)
  },
  listChats: (projectId) => ipcRenderer.invoke(IPC_HANDLER_KEYS.CHATS_LIST, { projectId }),
  createChat: (projectId) => ipcRenderer.invoke(IPC_HANDLER_KEYS.CHATS_CREATE, { projectId }),
  getChat: (projectId, chatId) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.CHATS_GET, { projectId, chatId }),
  deleteChat: (projectId, chatId) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.CHATS_DELETE, { projectId, chatId }),
  getCompletion: (projectId, chatId, newMessages, config) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.CHATS_COMPLETION, {
      projectId,
      chatId,
      newMessages,
      config,
    }),
}

const NOTIFICATIONS_API = {
  onOpenNotification: (callback) => {
    const listener = (_event, metadata) => callback(metadata)
    ipcRenderer.on(IPC_HANDLER_KEYS.NOTIFICATIONS_ON_OPEN, listener)
    return () => ipcRenderer.removeListener(IPC_HANDLER_KEYS.NOTIFICATIONS_ON_OPEN, listener)
  },

  sendOs: (data) => ipcRenderer.invoke(IPC_HANDLER_KEYS.NOTIFICATIONS_SEND_OS, data),
  subscribe: (callback) => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on(IPC_HANDLER_KEYS.NOTIFICATIONS_SUBSCRIBE, listener)
    return () => ipcRenderer.removeListener(IPC_HANDLER_KEYS.NOTIFICATIONS_SUBSCRIBE, listener)
  },
  getRecentNotifications: (projectId) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.NOTIFICATIONS_RECENT, { projectId }),
  getUnreadNotificationsCount: (projectId) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.NOTIFICATIONS_UNREADCOUNT, { projectId }),
  markAllNotificationsAsRead: (projectId) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.NOTIFICATIONS_MARKALLASREAD, { projectId }),
  markNotificationAsRead: (projectId, id) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.NOTIFICATIONS_MARKASREAD, { projectId, id }),
  deleteAllNotifications: (projectId) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.NOTIFICATIONS_DELETEALL, { projectId }),
  create: (projectId, input) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.NOTIFICATIONS_CREATE, { projectId, input }),
}

const PROJECTS_API = {
  subscribe: (callback) => {
    const listener = (_event, projects) => callback(projects)
    ipcRenderer.on(IPC_HANDLER_KEYS.PROJECTS_SUBSCRIBE, listener)
    return () => ipcRenderer.removeListener(IPC_HANDLER_KEYS.PROJECTS_SUBSCRIBE, listener)
  },
  listProjects: () => ipcRenderer.invoke(IPC_HANDLER_KEYS.PROJECTS_LIST),
  getProject: (id) => ipcRenderer.invoke(IPC_HANDLER_KEYS.PROJECTS_GET, { id }),
  createProject: (project) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.PROJECTS_CREATE, { id: project?.id, project }),
  updateProject: (id, project) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.PROJECTS_UPDATE, { id, project }),
  deleteProject: (id) => ipcRenderer.invoke(IPC_HANDLER_KEYS.PROJECTS_DELETE, { id }),
  reorderTask: (projectId, fromIndex, toIndex) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.PROJECTS_TASK_REORDER, { projectId, fromIndex, toIndex }),
}

const SCREENSHOT_API = {
  capture: (options) => ipcRenderer.invoke('screenshot:capture', options),
}

const SETTINGS_API = {
  subscribe: (callback) => {
    const listener = (_event, projectSettings) => callback(projectSettings)
    ipcRenderer.on(IPC_HANDLER_KEYS.SETTINGS_SUBSCRIBE, listener)
    return () => ipcRenderer.removeListener(IPC_HANDLER_KEYS.SETTINGS_SUBSCRIBE, listener)
  },
  getAppSettings: () => ipcRenderer.invoke(IPC_HANDLER_KEYS.SETTINGS_GET_APP),
  updateAppSettings: (updates) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.SETTINGS_UPDATE_APP, { updates }),
  getProjectSettings: (projectId) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.SETTINGS_GET_PROJECT, { projectId }),
  updateProjectSettings: (projectId, updates) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.SETTINGS_UPDATE_PROJECT, { projectId, updates }),
}

const LIVEDATA_API = {
  subscribe: (callback) => {
    const listener = (_event, services) => callback(services)
    ipcRenderer.on(IPC_HANDLER_KEYS.LIVE_DATA_SUBSCRIBE, listener)
    return () => ipcRenderer.removeListener(IPC_HANDLER_KEYS.LIVE_DATA_SUBSCRIBE, listener)
  },
  getStatus: () => ipcRenderer.invoke(IPC_HANDLER_KEYS.LIVE_DATA_GET_STATUS),
  addService: (service) => ipcRenderer.invoke(IPC_HANDLER_KEYS.LIVE_DATA_ADD_SERVICE, { service }),
  removeService: (serviceId) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.LIVE_DATA_REMOVE_SERVICE, { serviceId }),
  triggerUpdate: (serviceId) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.LIVE_DATA_TRIGGER_UPDATE, { serviceId }),
  updateConfig: (serviceId, updates) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.LIVE_DATA_UPDATE_CONFIG, { serviceId, updates }),
  getData: (serviceId) => ipcRenderer.invoke(IPC_HANDLER_KEYS.LIVE_DATA_GET_DATA, { serviceId }),
}

// Factory orchestrator API exposed to renderer
const FACTORY_API = {
  subscribeRuns: (callback) => {
    const listener = (_event, run) => callback(run)
    ipcRenderer.on(IPC_HANDLER_KEYS.FACTORY_RUNS_SUBSCRIBE, listener)
    return () => ipcRenderer.removeListener(IPC_HANDLER_KEYS.FACTORY_RUNS_SUBSCRIBE, listener)
  },
  startTaskRun: (params) => ipcRenderer.invoke(IPC_HANDLER_KEYS.FACTORY_RUNS_START_TASK, params),
  startFeatureRun: (params) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.FACTORY_RUNS_START_FEATURE, params),
  cancelRun: (runId, reason) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.FACTORY_RUNS_CANCEL, { runId, reason }),
  listRunsActive: () => ipcRenderer.invoke(IPC_HANDLER_KEYS.FACTORY_RUNS_LIST_ACTIVE),
  listRunHistory: () => ipcRenderer.invoke(IPC_HANDLER_KEYS.FACTORY_RUNS_LIST_HISTORY),
  deleteRunHistory: (runId) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.FACTORY_RUNS_DELETE_HISTORY, { runId }),
  rateRun: (runId, rating) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.FACTORY_RUNS_RATE, { runId, rating }),

  listPrices: () => ipcRenderer.invoke(IPC_HANDLER_KEYS.FACTORY_PRICING_LIST),
  refreshPricing: (provider, url) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.FACTORY_PRICING_REFRESH, { provider, url }),
}

const DB_API = {
  subscribe: (callback) => {
    const listener = (_event, status) => callback(status)
    ipcRenderer.on(IPC_HANDLER_KEYS.DB_SUBSCRIBE, listener)
    return () => ipcRenderer.removeListener(IPC_HANDLER_KEYS.DB_SUBSCRIBE, listener)
  },
  connect: (connectionString) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.DB_CONNECT, { connectionString }),
  getStatus: () => ipcRenderer.invoke(IPC_HANDLER_KEYS.DB_GET_STATUS),
  addEntity: (input) => ipcRenderer.invoke(IPC_HANDLER_KEYS.DB_ENTITIES_ADD, { input }),
  getEntity: (id) => ipcRenderer.invoke(IPC_HANDLER_KEYS.DB_ENTITIES_GET, { id }),
  updateEntity: (id, patch) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.DB_ENTITIES_UPDATE, { id, patch }),
  deleteEntity: (id) => ipcRenderer.invoke(IPC_HANDLER_KEYS.DB_ENTITIES_DELETE, { id }),
  searchEntities: (params) => ipcRenderer.invoke(IPC_HANDLER_KEYS.DB_ENTITIES_SEARCH, { params }),
  matchEntities: (criteria, options) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.DB_ENTITIES_MATCH, { criteria, options }),
  clearEntities: (projectIds) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.DB_ENTITIES_CLEAR, { projectIds }),
  addDocument: (input) => ipcRenderer.invoke(IPC_HANDLER_KEYS.DB_DOCUMENTS_ADD, { input }),
  getDocumentById: (id) => ipcRenderer.invoke(IPC_HANDLER_KEYS.DB_DOCUMENTS_GET_BY_ID, { id }),
  getDocumentBySrc: (src) => ipcRenderer.invoke(IPC_HANDLER_KEYS.DB_DOCUMENTS_GET_BY_SRC, { src }),
  updateDocument: (id, patch) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.DB_DOCUMENTS_UPDATE, { id, patch }),
  deleteDocument: (id) => ipcRenderer.invoke(IPC_HANDLER_KEYS.DB_DOCUMENTS_DELETE, { id }),
  searchDocuments: (params) => ipcRenderer.invoke(IPC_HANDLER_KEYS.DB_DOCUMENTS_SEARCH, { params }),
  matchDocuments: (criteria, options) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.DB_DOCUMENTS_MATCH, { criteria, options }),
  clearDocuments: (projectIds) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.DB_DOCUMENTS_CLEAR, { projectIds }),
}
const DOCUMENT_INGESTION_API = {
  ingestAllProjects: () => ipcRenderer.invoke(IPC_HANDLER_KEYS.DOCUMENT_INGESTION_ALL),
  ingestProject: (projectId) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.DOCUMENT_INGESTION_PROJECT, { projectId }),
}

const GIT_MONITOR_API = {
  subscribe: (callback) => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on(IPC_HANDLER_KEYS.GIT_MONITOR_SUBSCRIBE, listener)
    return () => ipcRenderer.removeListener(IPC_HANDLER_KEYS.GIT_MONITOR_SUBSCRIBE, listener)
  },
  getStatus: () => ipcRenderer.invoke(IPC_HANDLER_KEYS.GIT_MONITOR_GET_STATUS),
  triggerPoll: () => ipcRenderer.invoke(IPC_HANDLER_KEYS.GIT_MONITOR_TRIGGER_POLL),
  setPollInterval: (ms) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.GIT_MONITOR_SET_POLL_INTERVAL, { ms }),
  hasUnmerged: (branchName, baseBranch) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.GIT_MONITOR_HAS_UNMERGED, { branchName, baseBranch }),
  mergeBranch: (branchName, baseBranch) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.GIT_MONITOR_MERGE_BRANCH, { branchName, baseBranch }),
}

const TIMELINE_API = {
  addTimelineLabel: (input) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.DB_TIMELINE_LABELS_ADD, { input }),
  getTimelineLabelById: (id) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.DB_TIMELINE_LABELS_GET, { id }),
  updateTimelineLabel: (id, patch) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.DB_TIMELINE_LABELS_UPDATE, { id, patch }),
  deleteTimelineLabel: (id) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.DB_TIMELINE_LABELS_DELETE, { id }),
  searchTimelineLabels: (params) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.DB_TIMELINE_LABELS_SEARCH, { params }),
  matchTimelineLabels: (criteria, options) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.DB_TIMELINE_LABELS_MATCH, { criteria, options }),
}

contextBridge.exposeInMainWorld('tasksService', TASKS_API)
contextBridge.exposeInMainWorld('projectsService', PROJECTS_API)
contextBridge.exposeInMainWorld('filesService', FILES_API)
contextBridge.exposeInMainWorld('chatsService', CHATS_API)
contextBridge.exposeInMainWorld('notificationsService', NOTIFICATIONS_API)
contextBridge.exposeInMainWorld('screenshot', SCREENSHOT_API)
contextBridge.exposeInMainWorld('settingsService', SETTINGS_API)
contextBridge.exposeInMainWorld('liveDataService', LIVEDATA_API)
contextBridge.exposeInMainWorld('factoryService', FACTORY_API)
contextBridge.exposeInMainWorld('dbService', DB_API)
contextBridge.exposeInMainWorld('documentIngestionService', DOCUMENT_INGESTION_API)
contextBridge.exposeInMainWorld('gitMonitorService', GIT_MONITOR_API)
contextBridge.exposeInMainWorld('timelineService', TIMELINE_API)
