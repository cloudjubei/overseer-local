
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
  CHATS_COMPLETION: "chats:completion",
  CHATS_LIST_MODELS: "chats:list-models",
  CHATS_LIST: "chats:list",
  CHATS_CREATE: "chats:create",
  CHATS_LOAD: "chats:load",
  CHATS_SAVE: "chats:save",
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
  TASKS_REFERENCES_OUTBOUND: "tasks-references:outbound",
  TASKS_REFERENCES_INBOUND: "tasks-references:inbound",
  TASKS_REFERENCE_VALIDATE: "tasks-reference:validate",
  TASKS_REFERENCES_VALIDATE: "tasks-references:validate",
  TASKS_REFERENCES_SEARCH: "tasks-references:search",

  // Notifications
  NOTIFICATIONS_ON_OPEN: "notifications:on-open",
  NOTIFICATIONS_SEND_OS: "notifications:send-os",
  NOTIFICATIONS_SUBSCRIBE: "notifications:subscribe",
  NOTIFICATIONS_RECENT: "notifications:recent",
  NOTIFICATIONS_UNREADCOUNT: "notifications:unread-count",
  NOTIFICATIONS_MARKALLASREAD: "notifications:mark-all-as-read",
  NOTIFICATIONS_MARKASREAD: "notifications:mark-as-read",
  NOTIFICATIONS_DELETEALL: "notifications:delete-all",
  NOTIFICATIONS_PREFERENCES_SYSTEM: "notifications:preferences-system",
  NOTIFICATIONS_PREFERENCES_SYSTEM_UPDATE: "notifications:preferences-system-update",
  NOTIFICATIONS_PREFERENCES_PROJECT: "notifications:preferences-project",
  NOTIFICATIONS_PREFERENCES_PROJECT_UPDATE: "notifications:preferences-project-update"
}
export default IPC_HANDLER_KEYS