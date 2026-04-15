# 03 - overseer-local Hybrid Mode

## Summary

Modify `overseer-local` so it can operate in two modes: **local mode** (current behavior, everything runs in the Electron main process) and **connected mode** (delegates operations to `thefactory-backend` via HTTP/WebSocket, same as the web app).

**Repository:** `overseer-local` (existing)
**Dependencies:** `thefactory-backend` (for connected mode)
**Phase:** 1 (developed alongside backend and web app)

---

## Why This Exists

- Users who run the backend (for web access, CLI integration, or team use) should be able to connect their desktop app to the same backend, seeing the same projects and data.
- Validates the backend API from a second client (alongside the web app), catching API design issues early.
- Prepares the architecture for the eventual mobile client.
- If dual-mode proves too complex, provides the path to backend-only mode (see fallback below).

---

## Current Architecture

```
overseer-local today:

Renderer ──IPC──▶ Preload ──IPC──▶ Main Process
                                    │
                                    ├── ProjectsManager
                                    ├── StoriesManager
                                    ├── ChatsManager
                                    ├── FilesManager
                                    ├── GitManager
                                    ├── DatabaseManager ──▶ thefactory-db
                                    ├── FactoryToolsManager ──▶ thefactory-tools
                                    ├── FactoryCompletionManager
                                    ├── ...etc
                                    │
                               All managers use local filesystem,
                               child processes, and direct DB access
```

---

## Target Architecture

```
overseer-local hybrid:

Renderer ──IPC──▶ Preload ──IPC──▶ Main Process
                                    │
                                    ├── Mode: LOCAL
                                    │   └── [existing managers, unchanged]
                                    │
                                    └── Mode: CONNECTED
                                        └── BackendProxy
                                            │  HTTP/WS
                                            ▼
                                      thefactory-backend
```

The renderer and preload layer are **unchanged**. The switch happens inside the main process: each IPC handler either delegates to the local manager or to the backend proxy.

---

## Design Approach

### Option A: Service interface abstraction

Define a common interface for each domain that both the local manager and the backend proxy implement:

```typescript
interface IProjectsService {
  list(): Promise<Project[]>
  get(id: string): Promise<Project>
  create(data: ProjectInput): Promise<Project>
  update(id: string, data: ProjectPatch): Promise<Project>
  delete(id: string): Promise<void>
  subscribe(callback: (projects: Project[]) => void): () => void
}

// Local implementation (existing manager, adapted)
class LocalProjectsService implements IProjectsService { ... }

// Remote implementation (calls backend API)
class RemoteProjectsService implements IProjectsService { ... }
```

The IPC handlers in the main process call whichever implementation is active based on the current mode.

### Option B: Backend proxy as a drop-in manager replacement

Create a single `BackendProxyManager` that handles all IPC keys when in connected mode, forwarding each to the corresponding backend endpoint. Simpler but less modular.

**Recommendation: Option A.** It's more work upfront but makes the codebase cleaner and testable. Each service interface also becomes the contract that the web app's API client must satisfy.

---

## Mode Switching

### User experience

- Settings screen gets a new "Connection" section
- User can enter a backend URL and credentials
- Toggle between "Local" and "Connected" mode
- Mode persists in app settings
- On mode switch:
  - Active operations are stopped/cancelled
  - All contexts in the renderer refresh their data from the new source
  - A confirmation dialog warns about the switch

### Technical concerns

- Some data may exist locally but not on the backend (and vice versa)
- Mode switch is a full reset of all managers/services -- not a hot-swap of individual operations
- WebSocket connection to backend must be managed (connect, reconnect, disconnect)
- Credentials for the backend need secure storage (Electron's `safeStorage` or keytar)

---

## What Changes Per Domain

| Domain | Local mode (existing) | Connected mode (new) |
|---|---|---|
| **Projects** | `.factory/` on disk | Backend API |
| **Stories** | `.factory/stories/*.json` | Backend API |
| **Chats** | `.factory/chats/` | Backend API |
| **Files** | Local filesystem | Backend API (read/write on server) |
| **Git** | Local git CLI | Backend API (git on server) |
| **Completions** | Direct LLM API calls via thefactory-tools | Backend API (backend calls LLM) |
| **Agent runs** | Local thefactory-tools orchestrator | Backend API (backend runs agents) |
| **Database** | Local PostgreSQL via thefactory-db | Backend API (backend manages DB) |
| **Tests** | Local process via thefactory-tools | Backend API (backend runs tests) |
| **Code intel** | Local tree-sitter | Backend API |
| **Settings** | Local app settings file | Split: app settings local, project settings on backend |
| **LLM configs** | Local storage | Backend API (API keys stored server-side) |
| **Notifications** | Local + OS | Local + OS (backend sends events via WS, client shows notifications) |

---

## Implementation Strategy

### Step 1: Define service interfaces

Extract interfaces from existing managers. Each manager in `src/logic/` already has a clear method set defined by its `getHandlersAsync()`. Formalize these as TypeScript interfaces.

Key files to refactor:
- `src/logic/projects/ProjectsManager.ts`
- `src/logic/stories/StoriesManager.ts`
- `src/logic/chat/ChatsManager.ts`
- `src/logic/files/FilesManager.ts`
- `src/logic/git/GitManager.ts`
- `src/logic/db/DatabaseManager.ts`
- `src/logic/factory/FactoryToolsManager.ts`
- `src/logic/factory/FactoryCompletionManager.ts`

### Step 2: Create remote service implementations

For each interface, create a class that calls the backend API. These are essentially the same HTTP/WS clients that the web app uses, so this code should be developed in coordination with the web app's API client.

### Step 3: Create the mode switcher

- Add connection settings to app settings
- Add a `ConnectionManager` that manages the backend connection (HTTP client + WebSocket)
- Modify `managers.ts` (the initialization file) to instantiate either local or remote services based on settings

### Step 4: Update the settings UI

- Add connection settings screen
- Backend URL, credentials input
- Mode toggle with confirmation
- Connection status indicator

---

## Shared Code with Web App

The remote service implementations (HTTP/WS clients) are structurally identical to what the web app needs. This code should ideally be written once and shared. Options:

1. **Copy and maintain separately** -- simplest, acceptable divergence since the web app's client lives in a different repo
2. **Extract to a shared package** -- a lightweight `@thefactory/api-client` package. This is essentially what `thefactory-overseer-common` would have been, but scoped narrowly to the API client
3. **Generate from OpenAPI spec** -- if the backend publishes an OpenAPI schema, clients can be auto-generated

Recommendation: start with option 1. If the backend API stabilizes and the clients stay in sync, extract to a shared package later. This is a decision point after Phase 1 is complete.

---

## Fallback: Backend-Only Mode

If maintaining dual local+remote proves too complex:

1. The backend is required to always be running (can be started as a subprocess by the Electron app)
2. All managers are replaced with remote service implementations
3. The main process becomes a thin shell: Electron window + backend subprocess + WebSocket connection
4. `thefactory-tools` and `thefactory-db` are removed as direct dependencies of overseer-local
5. The IPC layer is preserved (renderer doesn't change), but every IPC handler delegates to HTTP/WS

This dramatically simplifies overseer-local at the cost of requiring the backend. For single-user local use, the backend runs as a local subprocess on `localhost`.
