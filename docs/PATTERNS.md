PATTERNS: MANAGER (MAIN-PROCESS SERVICE)

Overview

- Managers are main-process services responsible for a domain (stories, projects, files, etc.).
- They encapsulate IPC handlers, coordinate storage and validation, and broadcast updates to the renderer.
- Each manager exposes a typed, safe API to the renderer via preload.

Core Anatomy

- Location: src/<domain>/<Domain>Manager.js
  - Example: src/stories/StoriesManager.js
  - Managers may depend on other managers (dependency injection via constructor).
  - Supporting files (storage, validator, etc.) live in the same domain folder (e.g., src/stories/StoriesStorage.js).

- Initialization: src/managers.js
  - Creates one instance per manager and stores them as module-level exports (e.g., storiesManager).
  - initManagers(projectRoot, mainWindow) constructs all managers, wires dependencies, and awaits init() in order.
  - stopManagers() gracefully stops watchers/listeners across all managers.

- IPC Keys: src/ipcHandlersKeys.js
  - Single source of truth for all IPC channels (invoke and subscribe).
  - Keys are namespaced per domain, e.g.:
    - Stories: stories:subscribe, stories:list, stories:get, stories:create, stories:update, stories:delete, stories-feature:* ...
    - Projects: projects:* ; Files: files:* ; etc.
  - Managers import these keys and register ipcMain.handle for request/response channels.

- Preload Exposure: src/preload.js
  - Creates per-domain API objects that call ipcRenderer.invoke on request channels and set up ipcRenderer.on for subscriptions.
  - Uses contextBridge.exposeInMainWorld('<domain>Service', API) to expose to the renderer (e.g., 'storiesService').

- Renderer Consumption: src/renderer/services/<domain>Service.ts
  - Declares the typed interface for the service and exports an implementation bound to window.<domain>Service.
  - Example: src/renderer/services/storiesService.ts exports storiesService using ...window.storiesService.

- Types: src/types/external.d.ts
  - Extends the Window interface with all exposed services so TypeScript code in the renderer can use them safely.
  - Example: adds window.storiesService, window.projectsService, etc.

Lifecycle (End-to-End)

1) Define IPC channels
- Add new channels in src/ipcHandlersKeys.js for the domain.
- Include both request/response channels (for ipcRenderer.invoke) and subscribe/broadcast channels (for ipcRenderer.on and webContents.send).

2) Implement the Manager
- Create src/<domain>/<Domain>Manager.js.
- Constructor signature typically: (projectRoot, mainWindow, ...deps).
- init() should:
  - Prepare domain storage/state (instantiate storage, warm caches, etc.).
  - Register IPC handlers (ipcMain.handle) for request/response channels.
  - Set up any file/system watchers.
- stopWatching() should clean up watchers/subscriptions.
- For subscriptions, broadcast updates via mainWindow.webContents.send(<SUBSCRIBE_KEY>, payload).
- Example (Stories): src/stories/StoriesManager.js
  - Uses ipcMain.handle to register handlers for STORIES_LIST, STORIES_GET, STORIES_CREATE, etc.
  - Delegates storage to StoriesStorage (constructed with window to send updates).

3) Wire into the app
- Update src/managers.js
  - Import the new manager.
  - Add a module-level export (e.g., export let myDomainManager).
  - Instantiate it in initManagers(...) with dependencies.
  - await manager.init().
  - In stopManagers(), call manager.stopWatching().

4) Preload surface
- Update src/preload.js
  - Create a <DOMAIN>_API object mapping methods to ipcRenderer.invoke with IPC_HANDLER_KEYS.
  - Provide subscribe(callback) that listens to <SUBSCRIBE_KEY> and returns an unsubscribe function.
  - Expose via contextBridge.exposeInMainWorld('<domain>Service', <DOMAIN>_API).

5) Renderer service wrapper
- Create src/renderer/services/<domain>Service.ts
  - Define a TypeScript interface that mirrors the preload API.
  - Export const <domain>Service: <Interface> = { ...window.<domain>Service }.

6) Global typing
- Update src/types/external.d.ts to add window.<domain>Service to the global Window interface.

Concrete Example: Stories

- Manager: src/stories/StoriesManager.js
  - Registers handlers using IPC_HANDLER_KEYS.STORIES_LIST, STORIES_GET, STORIES_CREATE, STORIES_UPDATE, STORIES_DELETE, STORIES_FEATURE_*.
  - Delegates persistence to src/stories/StoriesStorage.js and emits updates to the renderer via the main window.

- Initialization: src/managers.js
  - storiesManager = new StoriesManager(projectRoot, mainWindow, projectsManager)
  - await storiesManager.init()

- IPC Keys: src/ipcHandlersKeys.js
  - STORIES_SUBSCRIBE, STORIES_LIST, STORIES_GET, STORIES_CREATE, STORIES_UPDATE, STORIES_DELETE, STORIES_FEATURE_GET/ADD/UPDATE/DELETE, STORIES_FEATURES_REORDER.

- Preload: src/preload.js
  - STORIES_API calls ipcRenderer.invoke for list/get/create/update/delete.
  - subscribe(callback) binds to IPC_HANDLER_KEYS.STORIES_SUBSCRIBE and returns unsubscribe.
  - Exposed as window.storiesService.

- Renderer: src/renderer/services/storiesService.ts
  - Exports storiesService and the StoriesService interface used throughout the UI.

- Types: src/types/external.d.ts
  - Declares storiesService on window, alongside other services.

Conventions and Guidelines

- Naming
  - Manager classes end with Manager (e.g., FilesManager, ProjectsManager).
  - Renderer services end with Service and map 1:1 to a main-process manager API.
  - IPC keys are lowercase, hyphen-separated segments with domain prefix (e.g., 'stories:list', 'files:read-directory').

- Error handling
  - Wrap ipcMain handlers in try/catch and return structured errors { ok: false, error } to the renderer.

- Subscriptions
  - Use a single SUBSCRIBE channel per domain to broadcast list/state updates when possible.
  - Unsubscribe by removing the listener returned from subscribe().

- Dependencies
  - Pass other managers as constructor dependencies when cross-domain coordination is required (e.g., StoriesManager uses ProjectsManager).

- Testing
  - In devtools, you can call window.<domain>Service.* to verify endpoints.
  - Ensure initManagers has run (app main process) before invoking renderer APIs.

Where to read more

- High-level map: docs/FILE_ORGANISATION.md
- Look at existing managers for reference: src/stories, src/files, src/projects, src/chat, src/db, etc.
