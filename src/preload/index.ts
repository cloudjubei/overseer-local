import { electronAPI } from '@electron-toolkit/preload'
import { contextBridge, ipcRenderer } from 'electron'
import IPC_HANDLER_KEYS from './ipcHandlersKeys'

const FILES_API = {
  updateAllTools: () => ipcRenderer.invoke(IPC_HANDLER_KEYS.FILES_UPDATE_ALL_TOOLS),
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
  updateStoryStatus: (projectId, storyId, status) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.STORIES_UPDATE_STATUS, { projectId, storyId, status }),
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

const COMPLETION_API = {
  sendCompletion: (messages, systemPrompt, config) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.COMPLETION_SEND, {
      messages,
      systemPrompt,
      config,
    }),
  sendCompletionTools: (
    projectId,
    chatContext,
    completionMessage,
    systemPrompt,
    settings,
    config,
  ) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.COMPLETION_TOOLS_SEND, {
      projectId,
      chatContext,
      completionMessage,
      systemPrompt,
      settings,
      config,
    }),
  resumeCompletionTools: (projectId, chatContext, toolsGranted, systemPrompt, settings, config) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.COMPLETION_TOOLS_RESUME, {
      projectId,
      chatContext,
      toolsGranted,
      systemPrompt,
      settings,
      config,
    }),
  retryCompletionTools: (projectId, chatContext, systemPrompt, settings, config) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.COMPLETION_TOOLS_RETRY, {
      projectId,
      chatContext,
      systemPrompt,
      settings,
      config,
    }),

  abortCompletion: (chatContext) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.COMPLETION_ABORT, {
      chatContext,
    }),
}

const CHATS_API = {
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
  deleteLastMessage: (chatContext) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.CHATS_DELETE_LAST_MESSAGE, { chatContext }),

  getChatSettings: () => ipcRenderer.invoke(IPC_HANDLER_KEYS.CHATS_GET_SETTINGS),
  resetChatSettings: (chatContext) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.CHATS_RESET_SETTINGS, { chatContext }),
  updateChatCompletionSettings: (chatContext, patch) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.CHATS_UPDATE_COMPLETION_SETTINGS, { chatContext, patch }),

  getDefaultPrompt: (chatContext) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.CHATS_GET_DEFAULT_PROMPT, { chatContext }),
  getSettingsPrompt: (contextArguments) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.CHATS_GET_SETTINGS_PROMPT, { contextArguments }),
  updateSettingsPrompt: (chatContext, prompt) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.CHATS_UPDATE_SETTINGS_PROMPT, { chatContext, prompt }),
  resetSettingsPrompt: (chatContext) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.CHATS_RESET_SETTINGS_PROMPT, { chatContext }),
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
  getUnreadNotifications: (projectId) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.NOTIFICATIONS_UNREAD, { projectId }),
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

const PROJECTSGROUPS_API = {
  subscribe: (callback) => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on(IPC_HANDLER_KEYS.PROJECTSGROUPS_SUBSCRIBE, listener)
    return () => ipcRenderer.removeListener(IPC_HANDLER_KEYS.PROJECTSGROUPS_SUBSCRIBE, listener)
  },
  listProjectsGroups: () => ipcRenderer.invoke(IPC_HANDLER_KEYS.PROJECTSGROUPS_LIST),
  getProjectsGroup: (groupId) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.PROJECTSGROUPS_GET, { groupId }),
  createProjectsGroup: (input) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.PROJECTSGROUPS_CREATE, { input }),
  updateProjectsGroup: (groupId, patch) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.PROJECTSGROUPS_UPDATE, { groupId, patch }),
  deleteProjectsGroup: (groupId) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.PROJECTSGROUPS_DELETE, { groupId }),
  reorderProject: (groupId, payload) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.PROJECTSGROUPS_PROJECT_REORDER, { groupId, payload }),
  reorderGroup: (payload) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.PROJECTSGROUPS_GROUP_REORDER, { payload }),
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
  executeTool: (projectId, toolName, args) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.FACTORY_TOOLS_EXECUTE, { projectId, toolName, args }),
  previewTool: (projectId, toolName, args) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.FACTORY_TOOLS_PREVIEW, { projectId, toolName, args }),
}

const FACTORY_TESTS_API = {
  subscribe: (callback) => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on(IPC_HANDLER_KEYS.FACTORY_TESTS_SUBSCRIBE, listener)
    return () => ipcRenderer.removeListener(IPC_HANDLER_KEYS.FACTORY_TESTS_SUBSCRIBE, listener)
  },
  listTests: (projectId) => ipcRenderer.invoke(IPC_HANDLER_KEYS.FACTORY_TESTS_LIST, { projectId }),
  runTests: (projectId, paths) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.FACTORY_TESTS_RUN_TESTS, { projectId, paths }),
  runAllTests: (projectId) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.FACTORY_TESTS_RUN_ALL_TESTS, { projectId }),
  runTestsE2E: (projectId, command) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.FACTORY_TESTS_RUN_TESTS_E2E, { projectId, command }),
  runCoverages: (projectId, paths) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.FACTORY_TESTS_RUN_COVERAGES, { projectId, paths }),
  runAllCoverages: (projectId) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.FACTORY_TESTS_RUN_ALL_COVERAGES, { projectId }),
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

const GIT_API = {
  getMergePlan: (projectId, options) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.GIT_GET_MERGE_PLAN, { projectId, options }),
  buildMergeReport: (projectId, plan, options) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.GIT_BUILD_MERGE_REPORT, {
      projectId,
      plan,
      options,
    }),
  applyMerge: (projectId, options) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.GIT_APPLY_MERGE, { projectId, options }),
  getLocalStatus: (projectId, options) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.GIT_GET_LOCAL_STATUS, { projectId, options }),
  getBranchDiffSummary: (projectId, options) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.GIT_GET_BRANCH_DIFF_SUMMARY, { projectId, options }),
  deleteBranch: (projectId, name) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.GIT_DELETE_BRANCH, { projectId, name }),
  push: (projectId, remote, branch) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.GIT_PUSH, { projectId, remote, branch }),
  pull: (projectId, remote, branch) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.GIT_PULL, { projectId, remote, branch }),
  deleteRemoteBranch: (projectId, name) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.GIT_DELETE_REMOTE_BRANCH, { projectId, name }),
  startMonitor: (projectId, options) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.GIT_MONITOR_START, { projectId, options }),
  stopMonitor: (projectId) => ipcRenderer.invoke(IPC_HANDLER_KEYS.GIT_MONITOR_STOP, { projectId }),
  checkout: (projectId, name) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.GIT_CHECKOUT, { projectId, name }),
  getLocalDiffSummary: (projectId, options) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.GIT_GET_LOCAL_DIFF_SUMMARY, { projectId, options }),
  stage: (projectId, paths) => ipcRenderer.invoke(IPC_HANDLER_KEYS.GIT_STAGE, { projectId, paths }),
  unstage: (projectId, paths) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.GIT_UNSTAGE, { projectId, paths }),
  reset: (projectId, paths) => ipcRenderer.invoke(IPC_HANDLER_KEYS.GIT_RESET, { projectId, paths }),
  commit: (projectId, input) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.GIT_COMMIT, { projectId, input }),
  getFileContent: (projectId, path, ref) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.GIT_GET_FILE_CONTENT, { projectId, path, ref }),
  resetAll: (projectId) => ipcRenderer.invoke(IPC_HANDLER_KEYS.GIT_RESET_ALL, { projectId }),
  subscribeToMonitorUpdates: (callback) => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on(IPC_HANDLER_KEYS.GIT_MONITOR_UPDATE, listener)
    return () => ipcRenderer.removeListener(IPC_HANDLER_KEYS.GIT_MONITOR_UPDATE, listener)
  },
  listUnifiedBranches: (projectId) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.GIT_LIST_UNIFIED_BRANCHES, { projectId }),
  selectCommits: (projectId, options) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.GIT_SELECT_COMMITS, { projectId, options }),
}

const GIT_CREDENTIALS_API = {
  subscribe: (callback) => {
    const listener = (_event, _payload) => callback()
    ipcRenderer.on(IPC_HANDLER_KEYS.GIT_CREDENTIALS_SUBSCRIBE, listener)
    return () => ipcRenderer.removeListener(IPC_HANDLER_KEYS.GIT_CREDENTIALS_SUBSCRIBE, listener)
  },
  list: () => ipcRenderer.invoke(IPC_HANDLER_KEYS.GIT_CREDENTIALS_LIST),
  add: (input) => ipcRenderer.invoke(IPC_HANDLER_KEYS.GIT_CREDENTIALS_ADD, { input }),
  update: (id, patch) => ipcRenderer.invoke(IPC_HANDLER_KEYS.GIT_CREDENTIALS_UPDATE, { id, patch }),
  remove: (id) => ipcRenderer.invoke(IPC_HANDLER_KEYS.GIT_CREDENTIALS_REMOVE, { id }),
  get: (id) => ipcRenderer.invoke(IPC_HANDLER_KEYS.GIT_CREDENTIALS_GET, { id }),
}

const LLM_CONFIGS_API = {
  subscribe: (callback) => {
    const listener = (_event, _payload) => callback()
    ipcRenderer.on(IPC_HANDLER_KEYS.LLM_CONFIGS_SUBSCRIBE, listener)
    return () => ipcRenderer.removeListener(IPC_HANDLER_KEYS.LLM_CONFIGS_SUBSCRIBE, listener)
  },
  list: () => ipcRenderer.invoke(IPC_HANDLER_KEYS.LLM_CONFIGS_LIST),
  add: (input) => ipcRenderer.invoke(IPC_HANDLER_KEYS.LLM_CONFIGS_ADD, { input }),
  update: (id, patch) => ipcRenderer.invoke(IPC_HANDLER_KEYS.LLM_CONFIGS_UPDATE, { id, patch }),
  remove: (id) => ipcRenderer.invoke(IPC_HANDLER_KEYS.LLM_CONFIGS_REMOVE, { id }),
  getActiveAgentRunId: () => ipcRenderer.invoke(IPC_HANDLER_KEYS.LLM_CONFIGS_GET_ACTIVE_AGENT_RUN),
  setActiveAgentRunId: (id) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.LLM_CONFIGS_SET_ACTIVE_AGENT_RUN, { id }),
  getRecentAgentRunIds: () => ipcRenderer.invoke(IPC_HANDLER_KEYS.LLM_CONFIGS_GET_RECENT_AGENT_RUN),
  getActiveChatId: () => ipcRenderer.invoke(IPC_HANDLER_KEYS.LLM_CONFIGS_GET_ACTIVE_CHAT),
  setActiveChatId: (id) => ipcRenderer.invoke(IPC_HANDLER_KEYS.LLM_CONFIGS_SET_ACTIVE_CHAT, { id }),
  getRecentChatIds: () => ipcRenderer.invoke(IPC_HANDLER_KEYS.LLM_CONFIGS_GET_RECENT_CHAT),
  bumpRecent: (context, id, limit) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.LLM_CONFIGS_BUMP_RECENT, { context, id, limit }),
  importLegacyLocalStorage: (payload) =>
    ipcRenderer.invoke(IPC_HANDLER_KEYS.LLM_CONFIGS_IMPORT_LEGACY_LOCALSTORAGE, { payload }),
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)

    contextBridge.exposeInMainWorld('storiesService', STORIES_API)
    contextBridge.exposeInMainWorld('projectsService', PROJECTS_API)
    contextBridge.exposeInMainWorld('projectsGroupsService', PROJECTSGROUPS_API)
    contextBridge.exposeInMainWorld('filesService', FILES_API)
    contextBridge.exposeInMainWorld('chatsService', CHATS_API)
    contextBridge.exposeInMainWorld('completionService', COMPLETION_API)
    contextBridge.exposeInMainWorld('notificationsService', NOTIFICATIONS_API)
    contextBridge.exposeInMainWorld('screenshot', SCREENSHOT_API)
    contextBridge.exposeInMainWorld('settingsService', SETTINGS_API)
    contextBridge.exposeInMainWorld('liveDataService', LIVEDATA_API)
    contextBridge.exposeInMainWorld('factoryAgentRunService', FACTORY_AGENT_RUN_API)
    contextBridge.exposeInMainWorld('factoryToolsService', FACTORY_TOOLS_API)
    contextBridge.exposeInMainWorld('factoryTestsService', FACTORY_TESTS_API)
    contextBridge.exposeInMainWorld('dbService', DB_API)
    contextBridge.exposeInMainWorld('documentIngestionService', DOCUMENT_INGESTION_API)
    contextBridge.exposeInMainWorld('gitService', GIT_API)
    contextBridge.exposeInMainWorld('gitCredentialsService', GIT_CREDENTIALS_API)
    contextBridge.exposeInMainWorld('llmConfigsService', LLM_CONFIGS_API)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
