# thefactory-backend - Architecture & Implementation Plan (v3)

**Updated:** 2026-04-17
**Status:** Phase 1b complete — REST/OpenAPI parity; see Remaining Work for doc drift and follow-up integration

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                     thefactory-backend                          │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌────────────┐  ┌──────────────┐ │
│  │ REST API │  │WebSocket │  │ Auth       │  │ Swagger/     │ │
│  │ (Fastify)│  │ (events) │  │ (Bearer)   │  │ OpenAPI      │ │
│  └────┬─────┘  └────┬─────┘  └──────┬─────┘  └──────────────┘ │
│       │              │               │                          │
│  ┌────┴──────────────┴───────────────┴─────────────────────┐   │
│  │                  Service Layer                           │   │
│  │  toolsService (global + per-project tools)              │   │
│  │  configRepoService (git-backed metadata)                │   │
│  │  projectCheckoutService (clone/pull repos)              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────┐  ┌────────────────────────────────────┐  │
│  │ thefactory-tools │  │ thefactory-db (PostgreSQL+pgvector)│  │
│  └──────────────────┘  └────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer          | Choice                              |
|----------------|-------------------------------------|
| Framework      | Fastify 5                           |
| Schemas        | @sinclair/typebox                   |
| API Docs       | @fastify/swagger + swagger-ui       |
| WebSocket      | @fastify/websocket                  |
| Auth           | Bearer token (env var)              |
| Tools layer    | thefactory-tools (local link)       |
| Database       | thefactory-db / PostgreSQL+pgvector |
| Tests          | Vitest                              |
| Runtime        | Node.js 24+, ESM                    |
| Deployment     | Docker Compose (local), Railway/Fly |

---

## Completed Work

### Phase 1a: Core Infrastructure ✅

| Component | Status | Details |
|-----------|--------|---------|
| Project scaffolding | ✅ | package.json, tsconfig, vitest.config |
| Config loading | ✅ | src/config.ts - env vars: PORT, HOST, BEARER_TOKEN, CONFIG_REPO_PATH, ENCRYPTION_KEY, DATABASE_URL |
| Auth plugin | ✅ | src/plugins/auth.ts - Bearer token validation |
| Swagger plugin | ✅ | src/plugins/swagger.ts - OpenAPI spec generation + UI at /docs |
| WebSocket plugin | ✅ | src/plugins/websocket.ts - client tracking + broadcast |
| Config repo service | ✅ | src/services/configRepoService.ts - git init, debounced commits, daily squash cron |
| Tools service | ✅ | src/services/toolsService.ts - global + per-project tool instances |
| Project checkout service | ✅ | src/services/projectCheckoutService.ts - clone, pull, path resolution |
| Server setup | ✅ | src/server.ts - Fastify app with all plugins, routes, lifecycle |

### Phase 1a: Core API Routes ✅

| Route Group | File | Endpoints | Tests |
|-------------|------|-----------|-------|
| Health | routes/health.ts | GET /health | ✅ |
| Projects | routes/projects.ts | GET, POST, PATCH, DELETE /projects, PUT code-info | ✅ |
| Projects Groups | routes/projectsGroups.ts | GET, POST, PATCH, DELETE /projects-groups, reorder | ✅ |
| Stories & Features | routes/stories.ts | Full CRUD + reorder for stories and features | ✅ |
| Credentials | routes/credentials.ts | LLM configs + Git credentials CRUD | ✅ |

### Phase 1b: Full Feature Parity Routes ✅

| Route Group | File | Endpoints | Tests |
|-------------|------|-----------|-------|
| Chats | routes/chats.ts | list, get, create, topic, update, messages, clear, rate, dynamic-context, delete, settings | ✅ |
| Files | routes/files.ts | list, read, read-paths, read-range, write, search, search-paths, grep, delete, rename, upload, write-patch, write-exact-replaces | ✅ |
| Git | routes/git.ts | status, branches (CRUD), checkout, log, commit, push, pull, stage, unstage, reset, diff, stashes, stash, stash/apply | ✅ |
| Test Runner | routes/testRunner.ts | list, run, run-all, run-e2e, coverage, coverage-all, last-run, last-e2e, last-coverage | ✅ |
| Code Intel | routes/codeIntel.ts | scan, catalogue, code, outline, edit, rename, detect-environment | ✅ |
| Completions | routes/completions.ts | send, send-with-tools, resume | ✅ |

### Schemas ✅

All API request/response types defined with TypeBox:
- `schemas/common.ts` - ErrorResponse
- `schemas/projects.ts` - ProjectSpec, create/edit inputs
- `schemas/projectsGroups.ts` - ProjectsGroups
- `schemas/stories.ts` - Story, Feature, create/edit/reorder
- `schemas/credentials.ts` - LLM configs, Git credentials
- `schemas/chats.ts` - Chat, ChatContext, messages, settings, dynamic context
- `schemas/files.ts` - File operations (read, write, search, grep, patch)
- `schemas/git.ts` - Git operations (status, branches, log, commit, stash)
- `schemas/tests.ts` - Test results, coverage, run inputs
- `schemas/codeIntel.ts` - Catalogue, members, AST operations
- `schemas/completions.ts` - Completion request/response, LLM config, settings

### Services ✅

- **toolsService** - Creates and caches:
  - Global: projectTools, projectsGroupsTools, credentialTools, chatsTools, completionTools, agentRunnerTools
  - Per-project (cached by `projectId:path`): fileTools, gitTools, testRunnerTools, codeIntelTools, compileTools
  - Per-project stories: storyTools (cached by projectId)

- **configRepoService** - Git-backed metadata persistence:
  - Initializes git repo on startup
  - Debounced commits: 10s for non-chat, 60s for chat files
  - Daily squash cron: `dev` branch → `main` branch

- **projectCheckoutService** - Project repository management:
  - `getCheckoutPath(projectId)` - resolve from repos dir or project.json path
  - `ensureCheckout(projectId, repoUrl)` - clone if not exists
  - `pullLatest(projectId)` - git pull
  - `listCheckouts()` / `removeCheckout(projectId)`

### Test Coverage ✅

**183 tests across 19 test files, all passing:**

| Test File | Tests | Coverage |
|-----------|-------|----------|
| config.test.ts | Config loading, defaults, env overrides | ✅ |
| server.test.ts | Server lifecycle, decorations, route registration, CORS, auth, WebSocket | ✅ |
| plugins/auth.test.ts | Token validation, public paths | ✅ |
| plugins/swagger.test.ts | OpenAPI spec, docs UI | ✅ |
| plugins/websocket.test.ts | Client set, broadcast function | ✅ |
| services/toolsService.test.ts | Init, cleanup, caching, global tools, per-project tools | ✅ |
| services/configRepoService.test.ts | Git init, debounce, classification | ✅ |
| services/projectCheckoutService.test.ts | Path resolution, listing, cleanup | ✅ |
| routes/health.test.ts | Health endpoint | ✅ |
| routes/projects.test.ts | Full CRUD, validation, code-info | ✅ |
| routes/projectsGroups.test.ts | Full CRUD, reorder | ✅ |
| routes/stories.test.ts | Stories + features CRUD, reorder | ✅ |
| routes/credentials.test.ts | LLM configs + git credentials CRUD | ✅ |
| routes/chats.test.ts | Full chat lifecycle, settings | ✅ |
| routes/files.test.ts | 404 handling, read/write with real project | ✅ |
| routes/git.test.ts | All git operations, 404 handling | ✅ |
| routes/testRunner.test.ts | All test runner endpoints, 404 handling | ✅ |
| routes/codeIntel.test.ts | All code intel endpoints, 404 handling | ✅ |
| routes/completions.test.ts | Auth, validation, error handling | ✅ |

---

## API Route Summary (70+ endpoints)

### Public
- `GET /health`
- `GET /docs` (Swagger UI)
- `GET /docs/json` (OpenAPI spec)
- `WS /ws` (WebSocket events)

### Projects (auth required)
- `GET /api/v1/projects`
- `GET /api/v1/projects/:id`
- `POST /api/v1/projects`
- `PATCH /api/v1/projects/:id`
- `DELETE /api/v1/projects/:id`
- `PUT /api/v1/projects/:id/code-info`

### Projects Groups
- `GET /api/v1/projects-groups`
- `POST /api/v1/projects-groups`
- `PATCH /api/v1/projects-groups/:id`
- `DELETE /api/v1/projects-groups/:id`
- `POST /api/v1/projects-groups/:id/reorder-project`

### Stories & Features
- `GET /api/v1/projects/:projectId/stories`
- `POST /api/v1/projects/:projectId/stories`
- `PATCH /api/v1/stories/:id`
- `DELETE /api/v1/stories/:id`
- `POST /api/v1/stories/reorder`
- `POST /api/v1/stories/:storyId/features`
- `PATCH /api/v1/stories/:storyId/features/:featureId`
- `DELETE /api/v1/stories/:storyId/features/:featureId`
- `POST /api/v1/stories/:storyId/features/reorder`

### Chats
- `GET /api/v1/chats`
- `POST /api/v1/chats`
- `POST /api/v1/chats/get`
- `POST /api/v1/chats/topic`
- `PATCH /api/v1/chats`
- `DELETE /api/v1/chats`
- `POST /api/v1/chats/messages`
- `POST /api/v1/chats/delete-last-message`
- `POST /api/v1/chats/clear`
- `POST /api/v1/chats/rate`
- `POST /api/v1/chats/dynamic-context`
- `GET /api/v1/chats/settings`

### Files (per-project)
- `GET /api/v1/projects/:projectId/files`
- `POST /api/v1/projects/:projectId/files/read`
- `POST /api/v1/projects/:projectId/files/read-paths`
- `POST /api/v1/projects/:projectId/files/read-range`
- `POST /api/v1/projects/:projectId/files/write`
- `POST /api/v1/projects/:projectId/files/search`
- `POST /api/v1/projects/:projectId/files/search-paths`
- `POST /api/v1/projects/:projectId/files/grep`
- `POST /api/v1/projects/:projectId/files/delete`
- `POST /api/v1/projects/:projectId/files/rename`
- `POST /api/v1/projects/:projectId/files/upload`
- `POST /api/v1/projects/:projectId/files/write-patch`
- `POST /api/v1/projects/:projectId/files/write-exact-replaces`

### Git (per-project)
- `GET /api/v1/projects/:projectId/git/status`
- `GET /api/v1/projects/:projectId/git/branches`
- `POST /api/v1/projects/:projectId/git/branches`
- `POST /api/v1/projects/:projectId/git/checkout`
- `DELETE /api/v1/projects/:projectId/git/branches`
- `GET /api/v1/projects/:projectId/git/log`
- `POST /api/v1/projects/:projectId/git/commit`
- `POST /api/v1/projects/:projectId/git/push`
- `POST /api/v1/projects/:projectId/git/pull`
- `POST /api/v1/projects/:projectId/git/stage`
- `POST /api/v1/projects/:projectId/git/unstage`
- `POST /api/v1/projects/:projectId/git/reset`
- `GET /api/v1/projects/:projectId/git/diff`
- `GET /api/v1/projects/:projectId/git/stashes`
- `POST /api/v1/projects/:projectId/git/stash`
- `POST /api/v1/projects/:projectId/git/stash/apply`

### Test Runner (per-project)
- `GET /api/v1/projects/:projectId/tests/list`
- `POST /api/v1/projects/:projectId/tests/run`
- `POST /api/v1/projects/:projectId/tests/run-all`
- `POST /api/v1/projects/:projectId/tests/run-e2e`
- `POST /api/v1/projects/:projectId/tests/coverage`
- `POST /api/v1/projects/:projectId/tests/coverage-all`
- `GET /api/v1/projects/:projectId/tests/last-run`
- `GET /api/v1/projects/:projectId/tests/last-e2e`
- `GET /api/v1/projects/:projectId/tests/last-coverage`

### Code Intelligence (per-project)
- `POST /api/v1/projects/:projectId/code-intel/scan`
- `GET /api/v1/projects/:projectId/code-intel/catalogue`
- `POST /api/v1/projects/:projectId/code-intel/code`
- `POST /api/v1/projects/:projectId/code-intel/outline`
- `POST /api/v1/projects/:projectId/code-intel/edit`
- `POST /api/v1/projects/:projectId/code-intel/rename`
- `POST /api/v1/projects/:projectId/code-intel/detect-environment`

### Completions
- `POST /api/v1/completions/send`
- `POST /api/v1/completions/send-with-tools`
- `POST /api/v1/completions/resume`

### Credentials
- `GET /api/v1/llm-configs`
- `GET /api/v1/llm-configs/:id`
- `POST /api/v1/llm-configs`
- `PATCH /api/v1/llm-configs/:id`
- `DELETE /api/v1/llm-configs/:id`
- `GET /api/v1/git-credentials`
- `GET /api/v1/git-credentials/:id`
- `POST /api/v1/git-credentials`
- `PATCH /api/v1/git-credentials/:id`
- `DELETE /api/v1/git-credentials/:id`

---

## Data Flow

### Config Repository (git-backed)
```
configRepoPath/
├── .factory/
│   ├── projects/
│   │   └── {project_id}/
│   │       ├── project.json
│   │       └── stories/
│   │           ├── order.json
│   │           └── {story_id}.json
│   ├── chats/
│   │   └── {context_type}/
│   │       └── {chat_file}.json
│   ├── credentials/
│   │   ├── llm-configs.enc.json
│   │   ├── llm-configs-state.enc.json
│   │   └── git-credentials.enc.json
│   └── projects_groups.json
```

### Commit Strategy
- **Non-chat changes**: commit 10s after last change
- **Chat changes**: commit 60s after last change
- **Daily cron**: squash `dev` → `main`, push `main` to remote

---

## WebSocket Events

Real-time event broadcasting via `/ws` endpoint:
- `projects:updated` - project list changed
- `stories:updated` - stories changed
- `chats:updated` - chat list/messages changed
- `completion:progress` - streaming completion updates
- `files:changed` - file watcher events
- `git:status-changed` - git status updates
- `tests:result` - test run results

---

## Remaining Work (Future Phases)

### Phase 1 follow-ups 

- [ ] Fix **API Route Summary** paths: stories/features/reorder must stay under `/api/v1/projects/:projectId/stories/...`; add missing routes such as `GET .../stories/order`, `GET .../stories/:storyId`, and `PATCH /api/v1/projects/:id/active`.
- [ ] Clarify **WebSocket Events**: distinguish **transport + `wsBroadcast` helper** (done) from **emitting the named domain events** from routes/services (pending; listed below).
- [ ] **WebSocket domain events**: call `wsBroadcast` from the appropriate route/service paths for the intended events (e.g. `projects:updated`, `stories:updated`, `chats:updated`, `completion:progress`, `files:changed`, `git:status-changed`, `tests:result`), plus tests that prove at least one client receives payloads after a mutation.
- [ ] **`projectCheckoutService`**: register on Fastify (or inject via a thin facade) and use from project lifecycle / file-git routes where clone or `pull` should occur; today the module exists and is tested in isolation but is not wired in `server.ts`.
- [ ] **`DATABASE_URL`**: thread `config.databaseUrl` into `createToolsService` (and any `thefactory-tools` factories that need a DB connection string) so env config matches the architecture diagram; today the value is loaded but not passed through.

### Phase 2: Web App (completely mirrors overseer-local)

- [ ] React web app consuming the backend API
- [ ] Shared types from OpenAPI spec
- [ ] Real-time updates via WebSocket

### Phase 3: Production Deployment

- [ ] Railway/Fly.io deployment config
- [ ] Push-to-deploy CI/CD pipeline
- [ ] Environment variable management
- [ ] Health monitoring and alerts

### Phase 4: overseer-local Migration

- [ ] Generate TypeScript types from OpenAPI spec (`openapi-typescript`)
- [ ] Build API client layer in overseer-local
- [ ] Replace all Managers with API client calls
- [ ] Remove thefactory-tools/db direct dependencies from overseer-local
- [ ] WebSocket event subscription in overseer-local (depends on backend emitting events above)


---

## File Structure

```
thefactory-backend/
├── src/
│   ├── index.ts                    # Entry point
│   ├── config.ts                   # Environment config loader
│   ├── config.test.ts
│   ├── server.ts                   # Fastify app builder
│   ├── server.test.ts
│   ├── plugins/
│   │   ├── auth.ts                 # Bearer token auth
│   │   ├── auth.test.ts
│   │   ├── swagger.ts              # OpenAPI spec generation
│   │   ├── swagger.test.ts
│   │   ├── websocket.ts            # WebSocket plugin
│   │   └── websocket.test.ts
│   ├── services/
│   │   ├── toolsService.ts         # thefactory-tools instances
│   │   ├── toolsService.test.ts
│   │   ├── configRepoService.ts    # Git-backed config repo
│   │   ├── configRepoService.test.ts
│   │   ├── projectCheckoutService.ts  # Project repo management
│   │   └── projectCheckoutService.test.ts
│   ├── schemas/
│   │   ├── common.ts
│   │   ├── projects.ts
│   │   ├── projectsGroups.ts
│   │   ├── stories.ts
│   │   ├── credentials.ts
│   │   ├── chats.ts
│   │   ├── files.ts
│   │   ├── git.ts
│   │   ├── tests.ts
│   │   ├── codeIntel.ts
│   │   └── completions.ts
│   ├── routes/
│   │   ├── health.ts + test
│   │   ├── projects.ts + test
│   │   ├── projectsGroups.ts + test
│   │   ├── stories.ts + test
│   │   ├── credentials.ts + test
│   │   ├── chats.ts + test
│   │   ├── files.ts + test
│   │   ├── git.ts + test
│   │   ├── testRunner.ts + test
│   │   ├── codeIntel.ts + test
│   │   └── completions.ts + test
│   └── test/
│       └── testHelpers.ts
├── Dockerfile
├── docker-compose.yml
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```
