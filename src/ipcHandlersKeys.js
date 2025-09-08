
const IPC_HANDLER_KEYS = {
  // Projects
  PROJECTS_SUBSCRIBE: "projects:subscribe",
  PROJECTS_LIST: "projects:list",
  PROJECTS_GET: "projects:get",
  PROJECTS_CREATE: "projects:create",
  PROJECTS_UPDATE: "projects:update",
  PROJECTS_DELETE: "projects:delete",
  PROJECTS_TASK_REORDER: "projects:reorder_task",

  // Chats
  CHATS_SUBSCRIBE: "chats:subscribe",
  CHATS_COMPLETION: "chats:completion",
  CHATS_LIST_MODELS: "chats:list-models",
  CHATS_LIST: "chats:list",
  CHATS_CREATE: "chats:create",
  CHATS_GET: "chats:get",
  CHATS_DELETE: "chats:delete",

  // Files 
  FILES_SUBSCRIBE: "files:subscribe",
  FILES_LIST: "files:list",
  FILES_READ: "files:read",
  FILES_READ_BINARY: "files:read-binary",
  FILES_READ_DIRECTORY: "files:read-directory",
  FILES_WRITE: "files:write",
  FILES_DELETE: "files:delete",
  FILES_RENAME: "files:rename",
  FILES_UPLOAD: "files:upload",

  // Tasks 
  TASKS_SUBSCRIBE: "tasks:subscribe",
  TASKS_LIST: "tasks:list",
  TASKS_GET: "tasks:get",
  TASKS_CREATE: "tasks:create",
  TASKS_UPDATE: "tasks:update",
  TASKS_DELETE: "tasks:delete",
  TASKS_FEATURE_GET: "tasks-feature:get",
  TASKS_FEATURE_ADD: "tasks-feature:add",
  TASKS_FEATURE_UPDATE: "tasks-feature:update",
  TASKS_FEATURE_DELETE: "tasks-feature:delete",
  TASKS_FEATURES_REORDER: "tasks-features:reorder",

  // Settings
  SETTINGS_SUBSCRIBE: "preferences:subscribe",
  SETTINGS_GET_APP: "preferences:get-app",
  SETTINGS_UPDATE_APP: "preferences:update-app",
  SETTINGS_GET_PROJECT: "preferences:get-project",
  SETTINGS_UPDATE_PROJECT: "preferences:update-project",

  // Notifications
  NOTIFICATIONS_ON_OPEN: "notifications:on-open",
  NOTIFICATIONS_SEND_OS: "notifications:send-os",
  NOTIFICATIONS_SUBSCRIBE: "notifications:subscribe",
  NOTIFICATIONS_RECENT: "notifications:recent",
  NOTIFICATIONS_UNREADCOUNT: "notifications:unread-count",
  NOTIFICATIONS_MARKALLASREAD: "notifications:mark-all-as-read",
  NOTIFICATIONS_MARKASREAD: "notifications:mark-as-read",
  NOTIFICATIONS_DELETEALL: "notifications:delete-all",
  NOTIFICATIONS_CREATE: "notifications:create",

  // Factory (agent orchestrator)
  FACTORY_START_TASK: "factory:start-task",
  FACTORY_START_FEATURE: "factory:start-feature",
  FACTORY_CANCEL_RUN: "factory:cancel",
  FACTORY_SUBSCRIBE: "factory:subscribe",
  FACTORY_EVENT: "factory:event",
  FACTORY_LIST_ACTIVE: "factory:list-active",

  // Factory history
  FACTORY_HISTORY_LIST: "factory:history:list",
  FACTORY_HISTORY_MESSAGES: "factory:history:messages",
  FACTORY_HISTORY_DELETE: "factory:history:delete",

  // Factory pricing
  FACTORY_PRICING_GET: "factory:pricing:get",
  FACTORY_PRICING_REFRESH: "factory:pricing:refresh",  
  
  LIVE_DATA_SUBSCRIBE: 'live-data:subscribe',
  LIVE_DATA_GET_STATUS: 'live-data:get-status',
  LIVE_DATA_TRIGGER_UPDATE: 'live-data:trigger-update',
  LIVE_DATA_UPDATE_CONFIG: 'live-data:update-config',
};

export default IPC_HANDLER_KEYS;
