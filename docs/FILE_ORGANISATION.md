# File Organisation

Purpose

- Provide a high-level map of the repository so contributors and agents can quickly find the right area.
- This is not a change log and is not a per-file inventory.

Editing Rules (read before updating)

- Only document major directories and subsystems. Do not list individual files.
- Keep bullets short (one sentence) and avoid 'New:' or historical notes.
- When adding/removing a major directory or moving a subsystem, update a single bullet here.
- Prefer linking or pointing to deeper docs (README/OVERVIEW) rather than describing internals here.
- Never document build related artifacts.

Top-Level Layout

- docs/: Project-wide documentation and specs; single source of truth for protocols and workflows.
  - ui/: Central UI development guide (entry point for UI work; links to UX/styleguide/design docs).
- scripts/: Utility scripts for maintenance and data operations (e.g., date alteration for stories/features).
- assets/: App assets (e.g., synthesized sounds in sounds.ts; optional audio files if provided under assets/audio/).
- src/: Application source (Electron app: main, preload, renderer, and tooling).
  - db/: Main process database integration (thefactory-db connection lifecycle and IPC handlers for status, CRUD/search of entities/documents, including new handlers for features and timeline labels). Exposes DB status via IPC and preload (dbService).
  - document_ingestion/: Project file-to-DB ingestion and sync pipeline. Listens to FilesManager changes (add/change/delete/rename) and upserts/archives documents in thefactory-db; supports full-project ingestion via IPC (DOCUMENT_INGESTION_ALL / DOCUMENT_INGESTION_PROJECT).
  - factory-tools/: Main process integration with the 'thefactory-tools' library for agent runs, pricing, and tool management.
  - live-data/: Main process live data service and types for live data services.
  - renderer/: React UI (components, screens, hooks, services, navigation, preview runtime), including new screens like `ProjectTimelineView`.
    - components/agents/: Agent-specific UI (status chips, run bullets, model selectors, project/cost/token chips).
    - services/: Renderer-side services (e.g., pricingService for LLM price lookup via IPC, dbService for DB status and ingestion triggers, and new timelineService for features and labels).
    - hooks/useShortcuts: Keyboard shortcuts provider; respects user-selected modifier and avoids interfering with text input.
    - settings/: AppSettings React context provider used app-wide (singleton).
    - components/ui/icons: Central SVG icons. All icon components are exported from `Icons.tsx` and are accessible by name via the registry in `screens/projects/projectIcons.tsx`.
      - Directive: When adding an icon, export it from `Icons.tsx` and register it in `PROJECT_ICON_REGISTRY` using kebab-case of the component name without the 'Icon' prefix (e.g., `IconCheckCircle` -> `check-circle`). Render with `renderProjectIcon('check-circle', className)`.
    - screens/git/: Git workflows UI (Git view tabs, merge modal, and future conflict resolution).
  - tools/: Developer and agent tooling (preview analyzer, factory integration, helpers).
  - git-monitor/: Main process git monitoring manager (fetch/poll branches) with renderer service (gitMonitorService).
  - tests/: Main process tests manager bridging thefactory-tools test runner via IPC (exposed to renderer as testsService).
  - logic/git/CredentialsManager.ts: Main process GitHub credentials manager with IPC (credentialsService in preload) for CRUD and subscriptions.
  - main.js: Electron main process entry.
  - preload.js: Safe IPC surface exposed to the renderer (exposes live data API, db API, and new timelineService API).
- Root config files: package.json, tsconfig.json, tailwind/postcss configs, vite configs, forge config, .env.

Where to Learn More

- Architecture overview: docs/ARCHITECTURE.md
- Engineering patterns and project conventions: docs/PATTERNS.md
- UI development (start here): docs/ui/README.md

Conventions (brief)

- Keep cross-cutting documentation in docs/; place domain-specific or area-specific READMEs next to the code they describe.
- Use descriptive directory names and keep responsibilities separated by area (renderer vs main vs tools vs packages).

Notes

- If you are unsure whether something belongs here, it probably belongs in a local README under its directory, with this file providing only a one-line pointer to that area.
