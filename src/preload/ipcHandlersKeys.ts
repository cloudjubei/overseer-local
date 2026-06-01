/**
 * IPC keys retained after the backend-only cutover (2026-05). Pre-cutover
 * keys for the data-bearing managers (Projects, Stories, Chats, Files, Git,
 * LiveData, …) were retired alongside their managers in the cutover.
 */
const IPC_HANDLER_KEYS = {
  AUTH_GET: 'auth:get',
  AUTH_SET: 'auth:set',
  AUTH_CLEAR: 'auth:clear',
  SYSTEM_DICTATION_TRIGGER: 'system-dictation:trigger',
  SYSTEM_DICTATION_OPEN_SETTINGS: 'system-dictation:open-settings',
}

export default IPC_HANDLER_KEYS
