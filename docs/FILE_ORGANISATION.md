# File Organisation

Purpose

- Provide a high-level map of the repository so contributors and agents can quickly find the right area.
- This is not a change log and is not a per-file inventory.

Editing Rules (read before updating)

- Only document major directories and subsystems. Do not list individual files.
- Keep bullets short (one sentence) and avoid "New:" or historical notes.
- When adding/removing a major directory or moving a subsystem, update a single bullet here.
- Prefer linking or pointing to deeper docs (README/OVERVIEW) rather than describing internals here.
- Never document build related artifacts.

Top-Level Layout

- docs/: Project-wide documentation and specs; single source of truth for protocols and workflows.
- src/: Application source (Electron app: main, preload, renderer, and tooling).
  - db/: Main process database integration (thefactory-db connection lifecycle and IPC handlers for status and CRUD/search of entities/documents). Exposes DB status via IPC and preload (dbService).
  - document_ingestion/: Project file-to-DB ingestion and sync pipeline. Listens to FilesManager changes (add/change/delete/rename) and upserts/archives documents in thefactory-db; supports full-project ingestion via IPC (DOCUMENT_INGESTION_ALL / DOCUMENT_INGESTION_PROJECT).
  - live-data/: Main process live data service and types for live data services.
    - providers/: Pluggable provider implementations (e.g., agent-prices bridge, generic fetch-json).
    - registry.js: Provider registry to map service ids to providers.
    - store.js: Persistence for service configs and cached snapshots by service id.
    - types.js: Shared types and helpers (freshness policy, normalization, freshness computation).
  - renderer/: React UI (components, screens, hooks, services, navigation, preview runtime).
    - components/agents/: Agent-specific UI (status chips, run bullets, model selectors, project/cost/token chips).
    - services/: Renderer-side services (e.g., pricingService for LLM price lookup via IPC, dbService for DB status and ingestion triggers).
    - hooks/useShortcuts: Keyboard shortcuts provider; respects user-selected modifier and avoids interfering with text input.
    - settings/: AppSettings React context provider used app-wide (singleton).
  - tools/: Developer and agent tooling (preview analyzer, factory integration, helpers).
  - git-monitor/: Main process git monitoring manager (fetch/poll branches) with renderer service (gitMonitorService).
  - main.js: Electron main process entry.
  - preload.js: Safe IPC surface exposed to the renderer (exposes live data API, db API).
- packages/: Local monorepo packages.
  - factory-ts/: Agent orchestration library (orchestrator, pricing, history, completion, git integration).
- scripts/: Project automation scripts and CLIs.
- Root config files: package.json, tsconfig.json, tailwind/postcss configs, vite configs, forge config, .env.

Where to Learn More

- Architecture overview: docs/ARCHITECTURE.md
- Agents and roles: packages/factory-ts/docs (AGENT_*.md).
- Factory TS overview and APIs: packages/factory-ts (see README/OVERVIEW files in that package).
- Preview system: see src/renderer/preview and related docs in docs/ (preview usage and analyzer).
- IPC and factory integration: src/tools/factory (renderer bridge and main process handlers).

Conventions (brief)

- Keep cross-cutting documentation in docs/; place domain-specific or area-specific READMEs next to the code they describe.
- Use descriptive directory names and keep responsibilities separated by area (renderer vs main vs tools vs packages).

Environment & Credentials

- .env at the repo root is used for local development (e.g., credentials consumed by tooling and factory-ts). For DB, THEFACTORY_DB_URL can be used if no app setting is provided.

Notes

- If you are unsure whether something belongs here, it probably belongs in a local README under its directory, with this file providing only a one-line pointer to that area.
