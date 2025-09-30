import { electronAPI } from '@electron-toolkit/preload'
import { contextBridge, ipcRenderer } from 'electron'
import IPC_HANDLER_KEYS from './ipcHandlersKeys'

const FILES_API = {
  subscribe: (callback) => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on(IPC_HANDLER_KEYS.FILES_SUBSCRIBE, listener)
    return () => ipcRenderer.removeListener(IPC_HANDLER_KEYS.FILES_SUBSCRIBE, listener)
  },
  listFiles: (projectId) => ipcRenderer.invoke(IPC_HANDLER_KEYS.FILES_LIST, { projectId }),
  readFile: (projectId, relPath, encoding = 'utf8') =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.FILES_READ_FILE, { projectId, relPath, encoding }),
  readPaths: (projectId, pathsRel) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.FILES_READ_PATHS, { projectId, pathsRel }),
  getAllFileStats: (projectId) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.FILES_GET_ALL_STATS, { projectId }),
  writeFile: (projectId, relPath, content, encoding = 'utf8') =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.FILES_WRITE_FILE, {
      projectId,
      relPath,
      content,
      encoding,
    }),
  renamePath: (projectId, srcRel, dstRel) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.FILES_RENAME_PATH, { projectId, srcRel, dstRel }),
  deletePath: (projectId, relPath) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.FILES_DELETE_PATH, { projectId, relPath }),
  searchFiles: (projectId, query, relPath = '.') =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.FILES_SEARCH, { projectId, query, relPath }),
  uploadFile: (projectId, name, content) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.FILES_UPLOAD_FILE, { projectId, name, content }),
}

const STORIES_API = {
  subscribe: (callback) => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on(IPC_HANDLER_KEYS.STORIES_SUBSCRIBE, listener)
    return () => ipcRenderer.removeListener(IPC_HANDLER_KEYS.STORIES_SUBSCRIBE, listener)
  },
  listStories: (projectId) => ipcRenderer.invoke(IPC_HANDLER_KEYS.STORIES_LIST, { projectId }),
  getStory: (projectId, storyId) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.STORIES_GET, { projectId, storyId }),
  createStory: (projectId, input) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.STORIES_CREATE, { projectId, input }),
  updateStory: (projectId, storyId, patch) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.STORIES_UPDATE, { projectId, storyId, patch }),
  deleteStory: (projectId, storyId) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.STORIES_DELETE, { projectId, storyId }),
  getFeature: (projectId, featureId) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.STORIES_FEATURE_GET, { projectId, featureId }),
  addFeature: (projectId, storyId, input) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.STORIES_FEATURE_ADD, { projectId, storyId, input }),
  updateFeature: (projectId, storyId, featureId, patch) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.STORIES_FEATURE_UPDATE, {
      projectId,
      storyId,
      featureId,
      patch,
    }),
  deleteFeature: (projectId, storyId, featureId) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.STORIES_FEATURE_DELETE, { projectId, storyId, featureId }),
  reorderFeatures: (projectId, storyId, payload) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.STORIES_FEATURES_REORDER, { projectId, storyId, payload }),
}

const CHATS_API = {
  getCompletion: (context, newMessages, config) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.CHATS_COMPLETION, {
      context,
      newMessages,
      config,
    }),
  // listModels: (config) => ipcRenderer.invoke(IPC_HANDLER_KEYS.CHATS_LIST_MODELS, { config }),
  subscribe: (callback) => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on(IPC_HANDLER_KEYS.CHATS_SUBSCRIBE, listener)
    return () => ipcRenderer.removeListener(IPC_HANDLER_KEYS.CHATS_SUBSCRIBE, listener)
  },
  listChats: (projectId) => ipcRenderer.invoke(IPC_HANDLER_KEYS.CHATS_LIST, { projectId }),
  createChat: (input) => ipcRenderer.invoke(IPC_HANDLER_KEYS.CHATS_CREATE, { input }),
  getChat: (chatContext) => ipcRenderer.invoke(IPC_HANDLER_KEYS.CHATS_GET, { chatContext }),
  updateChat: (chatContext, patch) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.CHATS_UPDATE, { chatContext, patch }),
  deleteChat: (chatContext) => ipcRenderer.invoke(IPC_HANDLER_KEYS.CHATS_DELETE, { chatContext }),

  getChatSettings: () => ipcRenderer.invoke(IPC_HANDLER_KEYS.CHATS_GET_SETTINGS),
  updateChatSettings: (chatContext, patch) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.CHATS_UPDATE_SETTINGS, { chatContext, patch }),
  resetChatSettings: (chatContext) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.CHATS_RESET_SETTINGS, { chatContext }),

  getSettingsPrompt: (contextArguments) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.CHATS_GET_SETTINGS_PROMPT, { contextArguments }),
  getDefaultPrompt: (chatContext) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.CHATS_GET_DEFAULT_PROMPT, { chatContext }),
}

const NOTIFICATIONS_API = {
  onOpenNotification: (callback) => {
    const listener = (_event, payload) => callback(payload)
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
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on(IPC_HANDLER_KEYS.PROJECTS_SUBSCRIBE, listener)
    return () => ipcRenderer.removeListener(IPC_HANDLER_KEYS.PROJECTS_SUBSCRIBE, listener)
  },
  listProjects: () => ipcRenderer.invoke(IPC_HANDLER_KEYS.PROJECTS_LIST),
  getProject: (projectId) => ipcRenderer.invoke(IPC_HANDLER_KEYS.PROJECTS_GET, { projectId }),
  createProject: (input) => ipcRenderer.invoke(IPC_HANDLER_KEYS.PROJECTS_CREATE, { input }),
  updateProject: (projectId, patch) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.PROJECTS_UPDATE, { projectId, patch }),
  deleteProject: (projectId) => ipcRenderer.invoke(IPC_HANDLER_KEYS.PROJECTS_DELETE, { projectId }),
  reorderStory: (projectId, payload) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.PROJECTS_STORY_REORDER, { projectId, payload }),
}

const SCREENSHOT_API = {
  capture: (options) => ipcRenderer.invoke('screenshot:capture', options),
}

const SETTINGS_API = {
  subscribe: (callback) => {
    const listener = (_event, payload) => callback(payload)
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
    const listener = (_event, payload) => callback(payload)
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

const FACTORY_AGENT_RUN_API = {
  subscribeRuns: (callback) => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on(IPC_HANDLER_KEYS.FACTORY_RUNS_SUBSCRIBE, listener)
    return () => ipcRenderer.removeListener(IPC_HANDLER_KEYS.FACTORY_RUNS_SUBSCRIBE, listener)
  },
  startRun: (params) => ipcRenderer.invoke(IPC_HANDLER_KEYS.FACTORY_RUNS_START, params),
  cancelRun: (runId, reason) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.FACTORY_RUNS_CANCEL, { runId, reason }),
  listRunsActive: () => ipcRenderer.invoke(IPC_HANDLER_KEYS.FACTORY_RUNS_LIST_ACTIVE),
  listRunHistory: () => ipcRenderer.invoke(IPC_HANDLER_KEYS.FACTORY_RUNS_LIST_HISTORY),
  getRunHistory: (runId) => ipcRenderer.invoke(IPC_HANDLER_KEYS.FACTORY_RUNS_GET, { runId }),
  deleteRunHistory: (runId) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.FACTORY_RUNS_DELETE_HISTORY, { runId }),
  rateRun: (runId, rating) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.FACTORY_RUNS_RATE, { runId, rating }),

  listPrices: () => ipcRenderer.invoke(IPC_HANDLER_KEYS.FACTORY_PRICING_LIST),
  refreshPricing: (provider, url) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.FACTORY_PRICING_REFRESH, { provider, url }),
}
const FACTORY_TOOLS_API = {
  listTools: (projectId) => ipcRenderer.invoke(IPC_HANDLER_KEYS.FACTORY_TOOLS_LIST, { projectId }),
  executeTool: (projectId, toolName, args) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.FACTORY_TOOLS_EXECUTE, { projectId, toolName, args }),
}

const FACTORY_TESTS_API = {
  subscribe: (callback) => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on(IPC_HANDLER_KEYS.FACTORY_TESTS_SUBSCRIBE, listener)
    return () => ipcRenderer.removeListener(IPC_HANDLER_KEYS.FACTORY_TESTS_SUBSCRIBE, listener)
  },
  listTests: (projectId) => ipcRenderer.invoke(IPC_HANDLER_KEYS.FACTORY_TESTS_LIST, { projectId }),
  runTest: (projectId, path) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.FACTORY_TESTS_RUN_TEST, { projectId, path }),
  runTests: (projectId, path) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.FACTORY_TESTS_RUN_TESTS, { projectId, path }),
  runTestsE2E: (projectId, command) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.FACTORY_TESTS_RUN_TESTS_E2E, { projectId, command }),
  runCoverage: (projectId, path) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.FACTORY_TESTS_RUN_COVERAGE, { projectId, path }),
  runCoverages: (projectId, path) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.FACTORY_TESTS_RUN_COVERAGES, { projectId, path }),
  getLastResult: (projectId) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.FACTORY_TESTS_GET_LAST_RESULT, { projectId }),
  getLastResultE2E: (projectId) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.FACTORY_TESTS_GET_LAST_RESULT_E2E, { projectId }),
  getLastCoverage: (projectId) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.FACTORY_TESTS_GET_LAST_COVERAGE, { projectId }),
}

const DB_API = {
  subscribe: (callback) => {
    const listener = (_event, payload) => callback(payload)
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
  getDocumentBySrc: (projectId, src) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.DB_DOCUMENTS_GET_BY_SRC, { projectId, src }),
  updateDocument: (id, patch) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.DB_DOCUMENTS_UPDATE, { id, patch }),
  deleteDocument: (id) => ipcRenderer.invoke(IPC_HANDLER_KEYS.DB_DOCUMENTS_DELETE, { id }),
  searchDocuments: (params) => ipcRenderer.invoke(IPC_HANDLER_KEYS.DB_DOCUMENTS_SEARCH, { params }),
  matchDocuments: (options) => ipcRenderer.invoke(IPC_HANDLER_KEYS.DB_DOCUMENTS_MATCH, { options }),
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

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)

    contextBridge.exposeInMainWorld('storiesService', STORIES_API)
    contextBridge.exposeInMainWorld('projectsService', PROJECTS_API)
    contextBridge.exposeInMainWorld('filesService', FILES_API)
    contextBridge.exposeInMainWorld('chatsService', CHATS_API)
    contextBridge.exposeInMainWorld('notificationsService', NOTIFICATIONS_API)
    contextBridge.exposeInMainWorld('screenshot', SCREENSHOT_API)
    contextBridge.exposeInMainWorld('settingsService', SETTINGS_API)
    contextBridge.exposeInMainWorld('liveDataService', LIVEDATA_API)
    contextBridge.exposeInMainWorld('factoryAgentRunService', FACTORY_AGENT_RUN_API)
    contextBridge.exposeInMainWorld('factoryToolsService', FACTORY_TOOLS_API)
    contextBridge.exposeInMainWorld('factoryTestsService', FACTORY_TESTS_API)
    contextBridge.exposeInMainWorld('dbService', DB_API)
    contextBridge.exposeInMainWorld('documentIngestionService', DOCUMENT_INGESTION_API)
    contextBridge.exposeInMainWorld('gitMonitorService', GIT_MONITOR_API)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
