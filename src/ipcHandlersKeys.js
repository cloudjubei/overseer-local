const IPC_HANDLER_KEYS = {
  // Projects
  PROJECTS_SUBSCRIBE: 'projects:subscribe',
  PROJECTS_LIST: 'projects:list',
  PROJECTS_GET: 'projects:get',
  PROJECTS_CREATE: 'projects:create',
  PROJECTS_UPDATE: 'projects:update',
  PROJECTS_DELETE: 'projects:delete',
  PROJECTS_TASK_REORDER: 'projects:reorder_task',

  // Chats
  CHATS_SUBSCRIBE: 'chats:subscribe',
  CHATS_COMPLETION: 'chats:completion',
  CHATS_LIST_MODELS: 'chats:list-models',
  CHATS_LIST: 'chats:list',
  CHATS_CREATE: 'chats:create',
  CHATS_GET: 'chats:get',
  CHATS_DELETE: 'chats:delete',

  // Files
  FILES_SUBSCRIBE: 'files:subscribe',
  FILES_LIST: 'files:list',
  FILES_READ: 'files:read',
  FILES_READ_BINARY: 'files:read-binary',
  FILES_READ_DIRECTORY: 'files:read-directory',
  FILES_WRITE: 'files:write',
  FILES_DELETE: 'files:delete',
  FILES_RENAME: 'files:rename',
  FILES_UPLOAD: 'files:upload',

  // Tasks
  TASKS_SUBSCRIBE: 'tasks:subscribe',
  TASKS_LIST: 'tasks:list',
  TASKS_GET: 'tasks:get',
  TASKS_CREATE: 'tasks:create',
  TASKS_UPDATE: 'tasks:update',
  TASKS_DELETE: 'tasks:delete',
  TASKS_FEATURE_GET: 'tasks-feature:get',
  TASKS_FEATURE_ADD: 'tasks-feature:add',
  TASKS_FEATURE_UPDATE: 'tasks-feature:update',
  TASKS_FEATURE_DELETE: 'tasks-feature:delete',
  TASKS_FEATURES_REORDER: 'tasks-features:reorder',

  // Settings
  SETTINGS_SUBSCRIBE: 'preferences:subscribe',
  SETTINGS_GET_APP: 'preferences:get-app',
  SETTINGS_UPDATE_APP: 'preferences:update-app',
  SETTINGS_GET_PROJECT: 'preferences:get-project',
  SETTINGS_UPDATE_PROJECT: 'preferences:update-project',

  // Notifications
  NOTIFICATIONS_ON_OPEN: 'notifications:on-open',
  NOTIFICATIONS_SEND_OS: 'notifications:send-os',
  NOTIFICATIONS_SUBSCRIBE: 'notifications:subscribe',
  NOTIFICATIONS_RECENT: 'notifications:recent',
  NOTIFICATIONS_UNREADCOUNT: 'notifications:unread-count',
  NOTIFICATIONS_MARKALLASREAD: 'notifications:mark-all-as-read',
  NOTIFICATIONS_MARKASREAD: 'notifications:mark-as-read',
  NOTIFICATIONS_DELETEALL: 'notifications:delete-all',
  NOTIFICATIONS_CREATE: 'notifications:create',

  // LiveData
  LIVE_DATA_SUBSCRIBE: 'live-data:subscribe',
  LIVE_DATA_ADD_SERVICE: 'live-data:add-service',
  LIVE_DATA_REMOVE_SERVICE: 'live-data:remove-service',
  LIVE_DATA_GET_STATUS: 'live-data:get-status',
  LIVE_DATA_TRIGGER_UPDATE: 'live-data:trigger-update',
  LIVE_DATA_UPDATE_CONFIG: 'live-data:update-config',
  LIVE_DATA_GET_DATA: 'live-data:get-data',

  // Factory runs
  FACTORY_RUNS_SUBSCRIBE: 'factory:runs:subscribe',
  FACTORY_RUNS_START_TASK: 'factory:runs:start-task',
  FACTORY_RUNS_START_FEATURE: 'factory:runs:start-feature',
  FACTORY_RUNS_CANCEL: 'factory:runs:cancel',
  FACTORY_RUNS_LIST_ACTIVE: 'factory:runs:list-active',
  FACTORY_RUNS_LIST_HISTORY: 'factory:runs:list-history',
  FACTORY_RUNS_DELETE_HISTORY: 'factory:runs:delete-history',
  FACTORY_RUNS_RATE: 'factory:runs:rate',

  // Factory pricing
  FACTORY_PRICING_LIST: 'factory:pricing:list',
  FACTORY_PRICING_REFRESH: 'factory:pricing:refresh',

  // Database status
  DB_SUBSCRIBE: 'db:subscribe',
  DB_CONNECT: 'db:connect',
  DB_GET_STATUS: 'db:get-status',
  DB_ENTITIES_ADD: 'db:entities-add',
  DB_ENTITIES_GET: 'db:entities-get',
  DB_ENTITIES_UPDATE: 'db:entities-update',
  DB_ENTITIES_DELETE: 'db:entities-delete',
  DB_ENTITIES_SEARCH: 'db:entities-search',
  DB_ENTITIES_MATCH: 'db:entities-match',
  DB_ENTITIES_CLEAR: 'db:entities-clear',
  DB_DOCUMENTS_ADD: 'db:documents-add',
  DB_DOCUMENTS_GET: 'db:documents-get',
  DB_DOCUMENTS_UPDATE: 'db:documents-update',
  DB_DOCUMENTS_DELETE: 'db:documents-delete',
  DB_DOCUMENTS_SEARCH: 'db:documents-search',
  DB_DOCUMENTS_CLEAR: 'db:documents-clear',

  // Document ingestion
  DOCUMENT_INGESTION_ALL: 'document-ingestion:all-projects',
  DOCUMENT_INGESTION_PROJECT: 'document-ingestion:project',
}

export default IPC_HANDLER_KEYS
