/**
 * IPC keys retained after the backend-only cutover (2026-05). Pre-cutover
 * keys for the data-bearing managers (Projects, Stories, Chats, Files, Git,
 * LiveData, …) lived here too; they're frozen alongside their managers in
 * `src/legacy/` and were retired per
 * [docs/implementation-plan.md § B.3](../../docs/implementation-plan.md).
 */
const IPC_HANDLER_KEYS = {
  AUTH_GET: 'auth:get',
  AUTH_SET: 'auth:set',
  AUTH_CLEAR: 'auth:clear',
}

export default IPC_HANDLER_KEYS
