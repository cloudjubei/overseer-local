# 01 - thefactory-backend

## Summary

A new Node.js/TypeScript server that wraps `thefactory-tools` and `thefactory-db` as HTTP and WebSocket APIs, enabling the web app and optionally the desktop/mobile clients to operate without requiring local Node.js tooling.

**Repository:** `thefactory-backend`
**Dependencies:** `thefactory-tools`, `thefactory-db`
**Phase:** 1 (developed alongside web app and overseer-local hybrid mode)

---

## Why This Exists

`thefactory-tools` and `thefactory-db` are Node.js libraries that use `fs`, `child_process`, `pg`, Docker, etc. They cannot run in a browser. The backend is the canonical server-side host for these libraries, exposing their capabilities over the network.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                thefactory-backend                │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ REST API │  │WebSocket │  │ Auth / Session │  │
│  │ (HTTP)   │  │ (events) │  │ Management     │  │
│  └────┬─────┘  └────┬─────┘  └───────┬───────┘  │
│       │              │                │          │
│  ┌────┴──────────────┴────────────────┴───────┐  │
│  │            Service Layer                    │  │
│  │  (wraps thefactory-tools + thefactory-db)  │  │
│  └─────────────────────────────────────────────┘  │
│                                                  │
│  ┌─────────────────┐  ┌───────────────────────┐  │
│  │ thefactory-tools│  │   thefactory-db        │  │
│  │ (file, git,     │  │   (PostgreSQL +        │  │
│  │  agent, chat,   │  │    pgvector)           │  │
│  │  completion...) │  │                        │  │
│  └─────────────────┘  └───────────────────────┘  │
└─────────────────────────────────────────────────┘
```

---

## Tech Stack (recommended)

- **Runtime:** Node.js (same as thefactory-tools)
- **Framework:** Fastify or Express (Fastify preferred for performance and schema validation)
- **WebSocket:** `ws` or Fastify websocket plugin (for real-time events: agent run updates, file changes, git status)
- **Auth:** TBD -- JWT-based sessions at minimum
- **Build:** TypeScript, ESM, same tsconfig patterns as thefactory-tools
- **Tests:** Vitest (consistency with existing projects)

---

## API Surface

The backend API mirrors the IPC surface defined in `overseer-local/src/preload/ipcHandlersKeys.ts`. Each IPC namespace becomes a REST resource group, with WebSocket channels for subscriptions.

### Resource Groups

**Projects**
- `GET /projects` -- list
- `GET /projects/:id` -- get
- `POST /projects` -- create
- `PUT /projects/:id` -- update
- `DELETE /projects/:id` -- delete

**Projects Groups**
- `GET /projects-groups` -- list
- `POST /projects-groups` -- create
- `PUT /projects-groups/:id` -- update
- `DELETE /projects-groups/:id` -- delete
- `POST /projects-groups/reorder` -- reorder groups/projects

**Stories & Features**
- `GET /projects/:projectId/stories` -- list
- `POST /projects/:projectId/stories` -- create
- `PUT /stories/:id` -- update
- `DELETE /stories/:id` -- delete
- `POST /stories/reorder` -- reorder
- CRUD for features nested under stories

**Chats**
- `GET /chats` -- list (scoped to project/group)
- `POST /chats` -- create
- `PUT /chats/:id` -- update
- `DELETE /chats/:id` -- delete
- `GET /chats/:id/settings` -- chat completion settings
- `PUT /chats/:id/settings` -- update settings

**Completions**
- `POST /completions/send` -- single completion
- `POST /completions/send-with-tools` -- tool-calling completion
- `POST /completions/resume` -- resume pending tool calls
- `POST /completions/abort` -- abort running completion
- `POST /completions/start-agent-run` -- start an agent run

**Files**
- `GET /projects/:projectId/files` -- list
- `GET /projects/:projectId/files/read` -- read file content
- `POST /projects/:projectId/files/write` -- write file
- `POST /projects/:projectId/files/search` -- search
- `POST /projects/:projectId/files/upload` -- upload

**Git**
- `GET /projects/:projectId/git/status` -- local status
- `GET /projects/:projectId/git/branches` -- list branches
- `GET /projects/:projectId/git/log` -- commit log
- `POST /projects/:projectId/git/commit` -- commit
- `POST /projects/:projectId/git/push` -- push
- `POST /projects/:projectId/git/pull` -- pull
- And other git operations (stash, merge, checkout, etc.)

**Database (entities/documents)**
- CRUD + search + match for entities and documents
- Same operations as `DB_*` IPC handlers

**LLM Configs**
- CRUD for LLM configurations
- Active config management

**Tests**
- `POST /projects/:projectId/tests/run` -- run tests
- `GET /projects/:projectId/tests/results` -- get results
- Coverage operations

**Settings**
- App-level and project-level settings CRUD

### WebSocket Events

Real-time subscriptions replace the IPC `subscribe` pattern:
- `projects:updated` -- project list changed
- `stories:updated` -- stories changed
- `chats:updated` -- chat list/messages changed
- `completion:progress` -- streaming completion updates
- `agent:run-update` -- agent run status/progress
- `files:changed` -- file watcher events
- `git:status-changed` -- git status updates
- `db:status-changed` -- database connection status
- `tests:result` -- test run results

---

## Open Questions

### User and Client Management

1. **Who are the users?** Single-user local tool? Multi-user SaaS? Team tool?
   - Recommendation: start single-user (password or token auth), design for multi-user later
2. **How is user data isolated?** Per-user projects? Shared workspace?
3. **Client registration:** do clients (desktop, web, mobile) need unique identifiers?

### Data Storage

4. **Where do projects live on the backend?** The current model assumes local filesystem paths. The backend needs to either:
   - Host project files on its own filesystem (cloned repos, uploaded files)
   - Connect to remote repos (GitHub integration already partially exists)
   - Store project metadata in DB only, with file operations delegated to a workspace directory
5. **Database per user or shared?** thefactory-db currently uses a single PostgreSQL database. Multi-user needs schema isolation or separate databases.
6. **`.factory` directory:** currently lives in the project root. On the backend, this needs to map to a server-side storage location per project.

### Security

7. **API keys for LLM providers:** stored server-side? User-provided per session? The current model stores them in LLM configs on the client.
8. **File system access:** the backend has direct fs access -- how to sandbox per-user/project?
9. **Git credentials:** currently stored client-side. Backend needs secure credential storage.

### Deployment

10. **How is the backend deployed?** Docker container? Cloud service? Self-hosted?
11. **Can the backend run locally?** For development, and potentially as a local server that overseer-local connects to (instead of direct thefactory-tools usage).

---

## Implementation Strategy

### Phase 1a: Minimal viable backend

Focus on the operations that the web app absolutely needs and that cannot run in a browser:

1. Project CRUD (metadata stored in DB or filesystem `.factory/`)
2. Stories/features CRUD
3. Chats CRUD + completion sending (proxies to LLM APIs via thefactory-tools)
4. Settings management
5. Basic auth (token-based)

### Phase 1b: Full feature parity

Expand to cover all IPC operations:

6. File operations (read/write/search on server-hosted project dirs)
7. Git operations
8. Agent runs with WebSocket streaming
9. Database entity/document operations
10. Test running
11. Code intelligence
12. Document ingestion

### Phase 1c: Backend-specific features

13. User management
14. CLI client endpoints (for Phase 2 CLI integration)
15. Workspace/project hosting and isolation

---

## Relationship to Existing Code

### What can be reused directly

- All of `thefactory-tools` -- the backend imports and calls the same functions the Electron main process currently calls
- All of `thefactory-db` -- same database layer
- Types from both packages are shared with clients

### What needs to be new

- HTTP/WebSocket server infrastructure
- Auth middleware
- Request validation and serialization
- Session management (mapping connected clients to their active projects/tools instances)
- The "Manager" pattern from overseer-local's main process may be adapted: each Manager becomes a service class that the API routes delegate to

### Key file references

- IPC surface to replicate: `overseer-local/src/preload/ipcHandlersKeys.ts` (215 handler keys across 15 domains)
- Manager implementations to reference: `overseer-local/src/logic/` (one manager per domain)
- Tool creation entry point: `thefactory-tools/src/tools/Tools.ts` (`createTools`)
- Completion pipeline: `thefactory-tools/src/completion/CompletionTools.ts`
- Agent runner: `thefactory-tools/src/agentRunner/AgentRunnerTools.ts`
- Database client: `thefactory-db/src/client/openDatabase.ts`

---

## Fallback: Backend-Only Mode

If maintaining dual local+remote modes in overseer-local becomes too complex, all clients (including desktop) switch to backend-only. In this case:

- overseer-local's main process becomes a thin shell that starts the backend locally and connects to it via HTTP/WebSocket (same as web/mobile)
- All `thefactory-tools` logic lives exclusively on the backend
- The IPC bridge in the preload is replaced with HTTP/WS calls
- This simplifies the codebase at the cost of requiring the backend to always be running
