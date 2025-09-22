# Architecture Overview

Purpose

- Provide a high-level map of how the Electron app integrates with thefactory-tools (agents) and thefactory-db (data storage).
- Explain data flow between the main process, preload/IPC surface, renderer, and the external packages.

Scope

- Main process managers that wire up DB, agents, ingestion, and other services.
- How agent runs are started and observed from the UI.
- How data is persisted and retrieved using thefactory-db.

Core Components

- Electron Main Process (src/)
  - DatabaseManager (src/db/DatabaseManager.js)
    - Manages thefactory-db connection lifecycle via openDatabase({ connectionString }).
    - Exposes DB status and CRUD/search for entities/documents over IPC.
    - Emits DB status updates to the renderer.
  - FactoryToolsManager (src/factory-tools/FactoryToolsManager.js)
    - Integrates with thefactory-tools to run agents (createOrchestrator, createAgentRunStore, createPricingManager).
    - Starts story/feature runs on request, forwards credentials/LLM config, and injects dbConnectionString from DatabaseManager.
    - Streams run events to the renderer over IPC; persists run history locally (.factory directory via run store).
  - DocumentIngestionManager (src/document_ingestion/DocumentIngestionManager.js)
    - Watches project files (via FilesManager) and upserts documents into thefactory-db (via DatabaseManager).
- Preload (src/preload.js)
  - Defines a safe IPC surface for the renderer.
  - Exposes dbService and factoryService, among other app services.
- Renderer (src/renderer)
  - Consumes dbService for DB status and document/entity CRUD/search.
  - Consumes factoryService to start/cancel/list agent runs and subscribe to run updates.
- External Packages
  - thefactory-db
    - External data storage client used by DatabaseManager and renderer types (e.g., thefactory-db/dist/types).
    - Provides entities/documents CRUD, search, and match APIs.
  - thefactory-tools
    - Orchestrator and tooling for running agents, tracking run history, and pricing.
    - The orchestrator accepts a dbConnectionString so agents can use the shared DB when needed (e.g., reading project knowledge or persisting artifacts/metadata).

High-Level Data Flow

1) Startup and Wiring (src/managers.js)
- Main process constructs and initializes all managers (DatabaseManager, FactoryToolsManager, Files/Projects/Stories/Chats/Settings, DocumentIngestionManager, etc.).
- FactoryToolsManager is given a reference to DatabaseManager so it can pass the active DB connection string into agent runs.

2) DB Connection Lifecycle (src/db/DatabaseManager.js)
- Renderer calls dbService.connect(connectionString) via IPC.
- DatabaseManager opens the DB with thefactory-db, updates internal status, and emits DB status to the renderer (IPC_HANDLER_KEYS.DB_SUBSCRIBE).
- All DB document/entity operations are handled by DatabaseManager through IPC (e.g., DB_DOCUMENTS_ADD, DB_ENTITIES_SEARCH).

3) Document Ingestion (src/document_ingestion/DocumentIngestionManager.js)
- Triggered explicitly from the renderer (DOCUMENT_INGESTION_ALL or DOCUMENT_INGESTION_PROJECT) or implicitly via file change handlers.
- For each file, classifyDocumentType, compute content hash/metadata, and upsert into thefactory-db through DatabaseManager.
- Documents are stored with their source path and metadata (ext, size, mtime, contentHash) to enable efficient sync and queries.

4) Running Agents with thefactory-tools (src/factory-tools/FactoryToolsManager.js)
- Renderer requests a run via factoryService.startStoryRun or startFeatureRun, providing agentType, project/story/feature identifiers, LLM config, and optional credentials.
- FactoryToolsManager starts a run using the orchestrator created by thefactory-tools and includes the current dbConnectionString from DatabaseManager.
- Orchestrator emits run events (updates, completed, cancelled, error); FactoryToolsManager forwards these over IPC (FACTORY_RUNS_SUBSCRIBE) to update the UI in real time.
- Run history and ratings are persisted locally through createAgentRunStore in the .factory directory.
- Pricing data is managed via createPricingManager and can be listed/refreshed from the renderer.

Renderer Integration Surface (src/preload.js)

- dbService
  - connect, getStatus, subscribe to DB status.
  - CRUD, search, match for entities/documents via IPC handlers in DatabaseManager.
- factoryService
  - startStoryRun, startFeatureRun, cancelRun, list active/history runs, delete history, rate run.
  - subscribeRuns to receive orchestrator updates in real time.
- documentIngestionService
  - ingestAllProjects, ingestProject triggers ingestion pipelines.

Storage Overview

- thefactory-db (external):
  - Primary storage for entities and documents used across the app and by agents.
  - Connection string is configured via app settings or environment (e.g., THEFACTORY_DB_URL) and passed to both DatabaseManager and the orchestrator.
- .factory directory (local):
  - Local store for agent run history and pricing caches used by thefactory-tools (createAgentRunStore, createPricingManager).

IPC Contract Summary (src/ipcHandlersKeys.js)

- DB: DB_CONNECT, DB_GET_STATUS, DB_SUBSCRIBE, DB_ENTITIES_*, DB_DOCUMENTS_*.
- Factory (runs): FACTORY_RUNS_START, FACTORY_RUNS_CANCEL, FACTORY_RUNS_LIST_ACTIVE, FACTORY_RUNS_LIST_HISTORY, FACTORY_RUNS_DELETE_HISTORY, FACTORY_RUNS_RATE, FACTORY_RUNS_SUBSCRIBE.
- Document ingestion: DOCUMENT_INGESTION_ALL, DOCUMENT_INGESTION_PROJECT.

Configuration

- DB connection: provided by the renderer via dbService.connect(connectionString) and persisted in app settings (renderer UI for settings in src/renderer/screens/settings/database/DatabaseSettings.tsx).
- Agent pricing and run history paths derive from the project root (.factory directory) managed by FactoryToolsManager.

Conceptual Diagram

App (Renderer) -> IPC (preload) -> Main Process
- DB operations: renderer -> DB_API -> DatabaseManager -> thefactory-db
- Agent runs: renderer -> FACTORY_API -> FactoryToolsManager -> orchestrator (thefactory-tools)
  - orchestrator receives dbConnectionString (from DatabaseManager) to access the same DB when needed
- Ingestion: renderer -> DOCUMENT_INGESTION_API -> DocumentIngestionManager -> DatabaseManager -> thefactory-db

Related Docs and Pointers

- File map and entry points: docs/FILE_ORGANISATION.md
- Package registry and interfaces: docs/PACKAGES.md
- Patterns and conventions: docs/PATTERNS.md
- Multi-platform roadmap: docs/MULTI_PLATFORM_ARCHITECTURE.md


Agent Prompting Strategy

Goal
- Ensure agents receive the minimum sufficient context about architecture, packages, and patterns at the right time without exceeding the model context window.

Current injection point
- The system prompt is built in thefactory-tools/src/orchestrator.ts within constructSystemPrompt(...).
- Suggested approach: add a ContextAssembler that selects, summarizes, and injects small, targeted doc slices from this repository (e.g., docs/ARCHITECTURE.md, docs/PATTERNS.md, docs/FILE_ORGANISATION.md, docs/PACKAGES.md) based on the story type and target area.

What to inject and when
- Always include
  - Project mission and top-level layout: a 10–20 line digest derived from docs/FILE_ORGANISATION.md.
  - Architectural core: a short summary from docs/ARCHITECTURE.md (Main process vs Preload vs Renderer, DB, agents).
  - A DocIndex: a compact list of available deep-dive docs with one-line descriptions and paths (ARCHITECTURE.md, PATTERNS.md, PACKAGES.md, design/styleguide/ux pointers).
- Conditional, by story area (heuristics)
  - Main-process manager or IPC changes: include the Managers pattern from docs/PATTERNS.md (anatomy, IPC keys, preload exposure, renderer service, typings).
  - UI components/screens: include a short “GO TO UI” summary (if present under docs/ux) and links to docs/styleguide and docs/design; do not inline full style guides.
  - DB or ingestion work: include the DB and ingestion sections of this file plus a brief reminder of the IPC contract and data flow.
  - Agents/orchestrator features: include a paragraph on how the orchestrator integrates, how dbConnectionString is passed, and how runs and pricing are stored.
  - Packages/new dependencies: include the relevant excerpt from docs/PACKAGES.md describing purpose and primary interfaces.
- On-demand expansion
  - Instruct agents explicitly: “If you need more detail, request specific sections by path and heading (e.g., docs/PATTERNS.md#Preload-Exposure).” This avoids preloading entire documents.

Token budgeting policy
- Reserve a fixed budget for documentation context (e.g., 800–1500 tokens depending on model).
- Prioritize in this order: Story-specific pattern snippet > Architecture digest > DocIndex.
- If the budget is exceeded, drop long examples and keep only rules, headings, and API names.

Implementation outline in constructSystemPrompt
- Introduce a ContextAssembler module with utilities
  - getDocDigest(path, maxTokens): load, strip examples, summarize key headers and bullet points.
  - pickDocs(story): map from story classification to required docs (see heuristics above).
  - buildDocIndex(): 6–12 bullets listing key docs with 1-liners and paths.
  - cacheDigestsByHash(): compute and cache content hashes for docs to avoid recomputation.
- Extend constructSystemPrompt(...)
  - Accept options such as featureArea, changedPaths, uiWork, mainProcessWork, dbWork to guide doc selection.
  - Compose the final system prompt sections in order: Role and guardrails -> Architecture digest -> Pattern snippet(s) -> DocIndex -> Story-specific instructions.
  - Append a short instruction telling the agent how to request additional sections by file path and heading if needed.

Classification signals for doc selection
- changedPaths contain src/<domain>/<Domain>Manager.js or src/ipcHandlersKeys.js -> include PATTERNS Manager section.
- changedPaths touch src/preload.js or src/renderer/services -> include Preload Exposure and Renderer Consumption from PATTERNS.md.
- changedPaths under src/renderer or docs/ux/styleguide/design -> include UI “GO TO” summary and styleguide links.
- story title/description mentions DB, entities, documents, ingestion -> include DB/ingestion digest from this file.
- mentions orchestrator, pricing, runs -> include orchestrator integration digest.
- mentions packages or dependencies -> include PACKAGES.md excerpt.

Safety and scope
- Only inject public project documentation. Never include secrets or runtime environment values from .env.
- Prefer summaries over raw code; include concrete IPC keys and API names only when necessary.

Agent-facing prompt tips (to include verbatim in the system prompt)
- “Follow the Managers pattern documented in docs/PATTERNS.md when touching main-process services.”
- “Use the IPC keys from src/ipcHandlersKeys.js; expose APIs via src/preload.js and update src/types/external.d.ts.”
- “For UI, follow docs/ux ‘GO TO UI’ and docs/styleguide; ask for specific components or tokens if needed.”
- “If additional details are required, request the exact doc section by path and heading.”

Maintenance
- Keep docs/ARCHITECTURE.md, docs/PATTERNS.md, docs/PACKAGES.md, and docs/FILE_ORGANISATION.md current.
- When adding significant UI guidance, place a concise ‘GO TO UI’ entry point under docs/ux and link it from FILE_ORGANISATION.md and the DocIndex.
- Recompute cached digests when file hashes change.
