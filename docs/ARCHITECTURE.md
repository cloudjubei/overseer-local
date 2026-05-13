# Architecture Overview

`overseer-local` is an Electron app — a main process plus a React 19 renderer — that integrates `thefactory-tools` (agents), `thefactory-db` (data storage), and `thefactory-ui` (the shared UI package).

## Where UI conventions live

The renderer consumes [`thefactory-ui`](../../thefactory-ui/). UI conventions — Save buttons as icon-only, modal Cancel removed, custom theme colours as arb-value CSS-var syntax, the 2-line CSS shim pipeline, `Select` vs `NativeSelect` naming — live in [thefactory-ui/docs/ARCHITECTURE.md § Consumer-facing UI conventions](../../thefactory-ui/docs/ARCHITECTURE.md#consumer-facing-ui-conventions). Read that section first when touching anything under `src/renderer/`.

This file documents what's specific to `overseer-local`: the Electron chrome, the IPC contract, and the renderer's local UI pieces.

## Renderer: local UI pieces

These pieces are in this repo because they wire local data or implement project-specific behaviour:

- **Wrappers around package primitives that wire local data** — [`FileMentionsTextarea.tsx`](../src/renderer/src/components/ui/FileMentionsTextarea.tsx), [`FileSelector.tsx`](../src/renderer/src/components/ui/FileSelector.tsx), [`RichText.tsx`](../src/renderer/src/components/ui/RichText.tsx). They feed `useFiles()` / `useStories()` data into the package primitives.
- **Project-specific composites** — [`CommandMenu.tsx`](../src/renderer/src/components/ui/CommandMenu.tsx), [`ContextInfoButton.tsx`](../src/renderer/src/components/ui/ContextInfoButton.tsx), [`ErrorBubble.tsx`](../src/renderer/src/components/ui/ErrorBubble.tsx), [`DiagnosticsOverlay.tsx`](../src/renderer/src/components/ui/DiagnosticsOverlay.tsx), [`ShortcutsHelp.tsx`](../src/renderer/src/components/ui/ShortcutsHelp.tsx).
- **App-level CSS rules** in [`src/renderer/src/styles/app.css`](../src/renderer/src/styles/app.css) — body, html, .empty.

Everything else — icons (action + navigation + project-decoration sets), the project-icon picker registry (`PROJECT_ICON_REGISTRY` / `PROJECT_ICONS` / `renderProjectIcon`), all primitive components, and screen-level CSS (`stories.css`, `story-details.css`, `board.css`, `docs.css`, `settings.css`) — ships from `thefactory-ui`. [`src/renderer/src/screens/projects/projectIcons.tsx`](../src/renderer/src/screens/projects/projectIcons.tsx) is a re-export shim from `thefactory-ui/web` so legacy local-import paths keep working.

## Core components

### Electron main process (`src/`)

- **DatabaseManager** ([`src/db/DatabaseManager.js`](../src/db/DatabaseManager.js))
  - Manages `thefactory-db` connection lifecycle via `openDatabase({ connectionString })`.
  - Exposes DB status and CRUD/search for entities/documents over IPC.
  - Emits DB status updates to the renderer.
- **FactoryToolsManager** ([`src/factory-tools/FactoryToolsManager.js`](../src/factory-tools/FactoryToolsManager.js))
  - Integrates with `thefactory-tools` to run agents (`createOrchestrator`, `createAgentRunStore`, `createPricingManager`).
  - Starts story/feature runs, forwards credentials / LLM config, and injects `dbConnectionString` from `DatabaseManager`.
  - Streams run events to the renderer over IPC; persists run history locally (`.factory` directory via run store).
- **DocumentIngestionManager** ([`src/document_ingestion/DocumentIngestionManager.js`](../src/document_ingestion/DocumentIngestionManager.js))
  - Watches project files (via `FilesManager`) and upserts documents into `thefactory-db` via `DatabaseManager`.

### Preload ([`src/preload.js`](../src/preload.js))

Defines the IPC surface exposed to the renderer. Surfaces include `dbService`, `factoryService`, `documentIngestionService`.

### Renderer (`src/renderer`)

- Consumes `dbService` for DB status and document/entity CRUD/search.
- Consumes `factoryService` to start/cancel/list agent runs and subscribe to run updates.
- Renders UI via `thefactory-ui` primitives + the local UI pieces listed above.

### External packages

- **`thefactory-db`** — external data storage client used by `DatabaseManager` and renderer types. Provides entities/documents CRUD, search, and match APIs.
- **`thefactory-tools`** — orchestrator and tooling for running agents, tracking run history, and pricing. The orchestrator accepts a `dbConnectionString` so agents can use the shared DB.
- **`thefactory-ui`** — shared UI package. See [thefactory-ui/docs/ARCHITECTURE.md](../../thefactory-ui/docs/ARCHITECTURE.md).

## High-level data flow

1. **Startup and wiring** ([`src/managers.js`](../src/managers.js)). Main process constructs and initialises all managers. `FactoryToolsManager` gets a reference to `DatabaseManager` so it can pass the active DB connection string into agent runs.

2. **DB connection lifecycle** ([`src/db/DatabaseManager.js`](../src/db/DatabaseManager.js)). Renderer calls `dbService.connect(connectionString)` via IPC. `DatabaseManager` opens the DB with `thefactory-db`, updates internal status, and emits status to the renderer (`IPC_HANDLER_KEYS.DB_SUBSCRIBE`). All DB document/entity operations are handled by `DatabaseManager` through IPC (e.g. `DB_DOCUMENTS_ADD`, `DB_ENTITIES_SEARCH`).

3. **Document ingestion** ([`src/document_ingestion/DocumentIngestionManager.js`](../src/document_ingestion/DocumentIngestionManager.js)). Triggered from the renderer (`DOCUMENT_INGESTION_ALL` / `DOCUMENT_INGESTION_PROJECT`) or by file-change handlers. For each file: classify document type, compute content hash/metadata, upsert into `thefactory-db` through `DatabaseManager`.

4. **Running agents** ([`src/factory-tools/FactoryToolsManager.js`](../src/factory-tools/FactoryToolsManager.js)). Renderer requests a run via `factoryService.startRun`. `FactoryToolsManager` starts the run using the orchestrator created by `thefactory-tools` and includes the current `dbConnectionString`. The orchestrator emits run events (updates, completed, cancelled, error); `FactoryToolsManager` forwards them over IPC (`FACTORY_RUNS_SUBSCRIBE`). Run history and ratings are persisted locally through `createAgentRunStore` in the `.factory` directory. Pricing data is managed via `createPricingManager`.

## Renderer integration surface ([`src/preload.js`](../src/preload.js))

- **`dbService`** — `connect`, `getStatus`, `subscribe` to DB status. CRUD, search, match for entities/documents.
- **`factoryService`** — `startRun`, `cancelRun`, list active/history runs, delete history, rate run. `subscribeRuns` for orchestrator updates.
- **`documentIngestionService`** — `ingestAllProjects`, `ingestProject` triggers ingestion pipelines.

## Storage

- **`thefactory-db`** (external) — primary storage for entities and documents used across the app and by agents. Connection string is configured via app settings or environment (e.g. `THEFACTORY_DB_URL`) and passed to both `DatabaseManager` and the orchestrator.
- **`.factory` directory** (local) — agent run history and pricing caches managed by `thefactory-tools`.

## IPC contract ([`src/ipcHandlersKeys.js`](../src/ipcHandlersKeys.js))

- **DB:** `DB_CONNECT`, `DB_GET_STATUS`, `DB_SUBSCRIBE`, `DB_ENTITIES_*`, `DB_DOCUMENTS_*`.
- **Factory (runs):** `FACTORY_RUNS_START`, `FACTORY_RUNS_CANCEL`, `FACTORY_RUNS_LIST_ACTIVE`, `FACTORY_RUNS_LIST_HISTORY`, `FACTORY_RUNS_DELETE_HISTORY`, `FACTORY_RUNS_RATE`, `FACTORY_RUNS_SUBSCRIBE`.
- **Document ingestion:** `DOCUMENT_INGESTION_ALL`, `DOCUMENT_INGESTION_PROJECT`.

## Configuration

- **DB connection** — provided by the renderer via `dbService.connect(connectionString)` and persisted in app settings (renderer UI at [`src/renderer/src/screens/settings/database/DatabaseSettings.tsx`](../src/renderer/src/screens/settings/database/DatabaseSettings.tsx)).
- **Agent pricing and run history** — paths derive from the project root (`.factory` directory) managed by `FactoryToolsManager`.

## Conceptual diagram

```
App (Renderer) -> IPC (preload) -> Main Process
- DB operations:  renderer -> DB_API -> DatabaseManager -> thefactory-db
- Agent runs:     renderer -> FACTORY_API -> FactoryToolsManager -> orchestrator (thefactory-tools)
                  └─ orchestrator receives dbConnectionString to access the shared DB
- Ingestion:      renderer -> DOCUMENT_INGESTION_API -> DocumentIngestionManager -> DatabaseManager -> thefactory-db
```

## Related docs

- File map and entry points: [docs/FILE_ORGANISATION.md](./FILE_ORGANISATION.md)
- Engineering patterns: [docs/PATTERNS.md](./PATTERNS.md)
- Package registry and interfaces: [docs/PACKAGES.md](./PACKAGES.md)
- Multi-platform roadmap: [docs/MULTI_PLATFORM_ARCHITECTURE.md](./MULTI_PLATFORM_ARCHITECTURE.md)
- Shared UI package: [thefactory-ui/docs/ARCHITECTURE.md](../../thefactory-ui/docs/ARCHITECTURE.md)

---

## Agent prompting strategy

Agents receive a curated slice of project documentation in their system prompt. The system prompt is built in `thefactory-tools/src/orchestrator.ts` inside `constructSystemPrompt(...)`. A `ContextAssembler` selects, summarises, and injects targeted doc slices based on the story type and the touched paths.

### Always-included context

- Project mission and top-level layout — a 10–20 line digest derived from `docs/FILE_ORGANISATION.md`.
- Architectural core — a short summary from `docs/ARCHITECTURE.md` (Main process vs Preload vs Renderer, DB, agents).
- A `DocIndex` — a compact list of deep-dive docs with one-line descriptions and paths.

### Conditional context (selected by story area)

- **Main-process manager or IPC changes** — include the Managers pattern from `docs/PATTERNS.md`.
- **UI components/screens** — include the "GO TO UI" summary from `docs/ux` and links to `docs/styleguide` and `docs/design`, plus the [Consumer-facing UI conventions](../../thefactory-ui/docs/ARCHITECTURE.md#consumer-facing-ui-conventions) from `thefactory-ui`.
- **DB or ingestion work** — include the DB and ingestion sections of this file plus the IPC contract.
- **Agents / orchestrator features** — include a paragraph on orchestrator integration, `dbConnectionString` passing, run / pricing storage.
- **Packages / new dependencies** — include the relevant excerpt from `docs/PACKAGES.md`.

Agents are instructed to request specific sections by path and heading (e.g. `docs/PATTERNS.md#Preload-Exposure`) when they need more detail than the injected digest covers.

### Token budgeting

A fixed budget of 800–1500 tokens is reserved for documentation context (model-dependent). Priority order: story-specific pattern snippet > architecture digest > DocIndex. Beyond budget, long examples drop and rules / headings / API names stay.

### `ContextAssembler` utilities

- `getDocDigest(path, maxTokens)` — load, strip examples, summarise key headers and bullet points.
- `pickDocs(story)` — map from story classification to required docs.
- `buildDocIndex()` — 6–12 bullets listing key docs with 1-liners and paths.
- `cacheDigestsByHash()` — compute and cache content hashes for docs.

`constructSystemPrompt(...)` accepts options (`featureArea`, `changedPaths`, `uiWork`, `mainProcessWork`, `dbWork`) and composes the final system prompt in order: role and guardrails → architecture digest → pattern snippet(s) → DocIndex → story-specific instructions → instructions for requesting additional sections.

### Classification signals

- `changedPaths` contain `src/<domain>/<Domain>Manager.js` or `src/ipcHandlersKeys.js` → include the PATTERNS Manager section.
- `changedPaths` touch `src/preload.js` or `src/renderer/services` → include Preload Exposure and Renderer Consumption from `PATTERNS.md`.
- `changedPaths` under `src/renderer` or `docs/ux`/`styleguide`/`design` → include UI "GO TO" summary, styleguide links, and the `thefactory-ui` consumer-conventions section.
- Story mentions DB, entities, documents, ingestion → include the DB/ingestion digest.
- Story mentions orchestrator, pricing, runs → include the orchestrator digest.
- Story mentions packages or dependencies → include the `PACKAGES.md` excerpt.

### Safety and scope

- Only public project documentation is injected. Secrets and `.env` values stay out.
- Summaries are preferred over raw code; concrete IPC keys and API names appear only when necessary.

### Verbatim agent-facing prompt tips

- "Follow the Managers pattern documented in `docs/PATTERNS.md` when touching main-process services."
- "Use the IPC keys from `src/ipcHandlersKeys.js`; expose APIs via `src/preload.js` and update `src/types/external.d.ts`."
- "For UI, follow `docs/ux` 'GO TO UI', `docs/styleguide`, and the consumer-facing conventions in `thefactory-ui/docs/ARCHITECTURE.md` — Save is icon-only, modal Cancel is removed, custom theme colours use arb-value CSS-var syntax."
- "Request additional doc sections by path and heading when needed."

### Maintenance

- Keep `docs/ARCHITECTURE.md`, `docs/PATTERNS.md`, `docs/PACKAGES.md`, and `docs/FILE_ORGANISATION.md` current.
- New UI guidance lands as a concise 'GO TO UI' entry under `docs/ux`, linked from `FILE_ORGANISATION.md` and the DocIndex.
- Cached digests recompute when file hashes change.
