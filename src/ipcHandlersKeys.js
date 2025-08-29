
const IPC_HANDLER_KEYS = {
  PROJECTS_LIST: "projects:list",
  PROJECTS_GET: "projects:get",
  PROJECTS_CREATE: "projects:create",
  PROJECTS_UPDATE: "projects:update",
  PROJECTS_DELETE: "projects:delete",
  PROJECTS_SUBSCRIBE: "projects:subscribe",

  // Chats
  CHATS_COMPLETION: "chats:completion",
  CHATS_LIST_MODELS: "chats:list-models",
  CHATS_LIST: "chats:list",
  CHATS_CREATE: "chats:create",
  CHATS_LOAD: "chats:load",
  CHATS_SAVE: "chats:save",
  CHATS_DELETE: "chats:delete",
  CHATS_SET_CONTEXT: "chats:set-context",

  // Files (aligned with Projects pattern)
  FILES_GET: "files:get",
  FILES_SUBSCRIBE: "files:subscribe",
  FILES_SET_CONTEXT: "files:set-context",
  FILES_READ: "files:read",
  FILES_READ_BINARY: "files:read-binary",
  FILES_WRITE: "files:write",
  FILES_DELETE: "files:delete",
  FILES_RENAME: "files:rename",
  FILES_ENSURE_DIR: "files:ensure-dir",
  FILES_UPLOAD: "files:upload",
}
export default IPC_HANDLER_KEYS