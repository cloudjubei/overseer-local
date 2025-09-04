# File Organisation

This document describes how files and directories are organised in this repository to keep the project navigable, consistent, and easy to evolve.

## Top-Level Directory Layout
- docs/: Project documentation and specs (single source of truth for protocols, formats, and guidelines).
- src/: Application source (Electron main + React renderer + tooling).
  - src/styles/: Shared CSS assets and design tokens, grouped by role (foundations, primitives, components, layout, screens).
    - New: src/styles/components/file-display.css contains layout and visuals for the FileDisplay UI component (icon+metadata grid, density presets, interactive states). Imported via src/index.css.
    - New: src/styles/components/file-mentions.css contains styling for inline @File mentions rendered as chips.
  - src/types/: Shared TypeScript types.
  - src/renderer/: React renderer (components, screens, hooks, services, navigation, preview runtime).
    - src/renderer/components/: Reusable UI and domain-specific components.
      - src/renderer/components/tasks/: Task-related UI elements (status controls, dependency bullets, etc.).
      - src/renderer/components/agents/: Agent-related UI elements (AgentRunBullet and future agent widgets). Now includes ChatConversation.tsx to render agent run chat with bubbles for thoughts and expandable tool call rows.
        - New: StatusChip.tsx renders a chip with a status icon for agent run states (running/completed/cancelled/error).
        - New: TurnChip.tsx renders a small chip showing the current/total turn number for a run.
      - src/renderer/components/ui/FileMentions.tsx: Utility component that scans text for @File tokens and renders inline chips with hoverable tooltips using FileDisplay.
    - src/renderer/screens/: High-level screens (Tasks, Documents, Chat, Settings, Agents, etc.).
    - src/renderer/tasks/: Task/feature create/edit/list/board views.
    - src/renderer/navigation/: Navigation state and modal host.
    - src/renderer/services/: Frontend services (chat/docs/tasks/projects/files/notifications/user-preferences).
      - src/renderer/services/agentsService.ts: In-memory orchestrator client that starts/monitors agent runs using the local factory-ts bridge. Tracks provider/model, costs, and token usage across runs. On app start, it bootstraps from both active in-memory runs and persisted history loaded via preload factory IPC.
    - src/renderer/hooks/: React hooks (theme, shortcuts, tasks index, blocker resolver, etc.).
      - src/renderer/hooks/useAgents.ts: Hook to subscribe to active agent runs and start/cancel them.
    - src/renderer/preview/: Component preview runtime and provider registry for isolated previews.
  - src/tools/: Developer and agent tooling (preview analysis, formatting, compile checks, docker helpers).
    - src/tools/preview/: Preview analyzer tooling.
    - src/tools/factory/: Integration layer for the local factory-ts package (orchestrator bridge and helpers).
      - src/tools/factory/orchestratorBridge.ts: Renderer bridge that calls Electron preload API to start runs and receive events from the main process. Avoids importing Node-only modules in the renderer.
      - src/tools/factory/mainOrchestrator.js: Electron main-side IPC handlers that manage factory-ts orchestrator runs and stream events to renderers. Now persists metadata and conversation snapshots for runs via the factory-ts HistoryStore, and exposes IPC endpoints to list history and fetch messages.
      - Update: mainOrchestrator.js now loads the workspace .env file (projectRoot/.env) on startup so Git credentials and other environment variables are available to the factory orchestrator and GitManager.
  - src/chat/: Chat providers, manager, and storage.
  - src/capture/: Screenshot capture service (main process).
  - src/files/: Files manager and per-project storage.
  - src/projects/: Projects manager and indexing.
  - src/tasks/: Tasks manager and per-project storage.
  - src/notifications/: Notifications manager and IPC integration.
  - src/preferences/: Preferences manager and user settings storage (system-wide user preferences such as last active project, task view mode, list sorting, notification settings), with IPC exposure.
  - src/main.js: Electron main process entry that owns the factory-ts orchestrator and exposes IPC handlers for starting runs and streaming events via src/tools/factory/mainOrchestrator.js.
  - src/preload.js: Preload script exposing a minimal window.factory API to the renderer (startTaskRun, startFeatureRun, cancelRun, subscribe, listActiveRuns). New: listRunHistory and getRunMessages to access persisted history.
- scripts/: Project automation scripts and CLIs (e.g., preview scanning, runAgent.mjs runner for factory-ts).
- build/: Packaging resources for electron-builder (icons, entitlements, etc.).
- packages/: Local monorepo packages used by the app.
  - packages/factory-ts/: Agent orchestration library used by the app and CLI. See packages/factory-ts/FACTORY_TS_OVERVIEW.md.
    - packages/factory-ts/src/taskUtils.ts: TypeScript implementation mirroring Python task_utils.py, used by orchestrator.ts for file/task/feature/test operations and Git commits.
    - packages/factory-ts/src/orchestrator.ts: Orchestrator that mirrors Python run_local_agent.py conversation loop. Also provides runIsolatedOrchestrator which mirrors Python run.py by copying the repository to a temporary workspace, running the orchestrator inside it, and then cleaning up. It preserves .git and ignores venv, __pycache__, .idea, and *.pyc. Update: runIsolatedOrchestrator now accepts an optional repoRoot absolute path and handles packaged Electron (asar) environments by avoiding copying from virtual paths. It resolves a real filesystem directory using process.resourcesPath or stripping app.asar and prefers app.asar.unpacked when present.
    - packages/factory-ts/src/completion.ts: Self-contained CompletionClient that supports OpenAI-compatible chat APIs and a mock client.
    - packages/factory-ts/src/pricing.ts: Pricing manager that loads/saves local model prices, estimates costs per-provider/model, and can refresh from configurable supplier URLs. Stores data under .factory/prices.json.
    - packages/factory-ts/src/index.ts: Public entry exporting createOrchestrator, createPricingManager and a file-backed createHistoryStore. HistoryStore persists run metadata under .factory/history/runs.json and per-run messages under .factory/history/runs/<runId>.messages.json.
    - packages/factory-ts/assets/default-prices.json: Built-in default price list used on first run or if local file is missing.
    - packages/factory-ts/src/gitManager.ts: Git integration improved to load .env from the repo root automatically, accept multiple credential env var names (GIT_PAT/GIT_TOKEN/GITHUB_TOKEN/GH_TOKEN, GIT_USER_NAME/GIT_USERNAME, and GIT_REPO_URL/REPO_URL), fall back to SSH where possible, and provide clearer error messages. This ensures local commits always succeed and pushes use any available credentials or SSH agent.

Also present at repo root:
- .env, forge.config.js, index.html, preview.html, package.json, postcss.config.js, tailwind.config.js, tsconfig.json, vite.*.config.mjs

Notes:
- All changes should be localized to the smallest reasonable scope (task- or doc-specific) to reduce coupling.
- Documentation in docs/ is the single source of truth for specs and formats.

## File Naming Conventions
- Tasks and features:
  - Task directories are uuids: tasks/{id}/
  - Tests are named per-feature: tasks/{task_id}/tests/test_{task_id}_{feature_number}.py (e.g., tasks/15/tests/test_15_3.py).
- Python modules: snake_case.py (e.g., task_format.py, run_local_agent.py).
- Javascript/TypeScript modules: camelCase.js/ts (e.g., taskFormat.js, runLocalAgent.ts). For schema mirrors adjacent to Python specs, a matching snake_case.ts is acceptable under docs/.
- Documentation files: UPPERCASE or Title_Case for project-wide specs (e.g., TESTING.md, FILE_ORGANISATION.md). Place task-related docs under docs/tasks/.
- JSON examples/templates: Use .json with clear, descriptive names (e.g., task_example.json).

## Evolution Guidance
- Make minimal, incremental changes that are easy to review and test.
- Keep documentation authoritative: update docs first when changing schemas or protocols.
- Introduce shared utilities only when multiple tasks need them; otherwise keep helpers local to a task.
- Deprecate gradually: create new files/specs alongside old ones, migrate, then remove deprecated artifacts when tests prove stability.
- Each feature must have deterministic tests; do not mark features complete until tests pass.

## Preview System
- Dedicated component preview is provided via preview.html and the src/renderer/preview/ runtime.
- In dev, open http://localhost:<vite-port>/preview.html with query params:
  - id: module path under src (e.g., renderer/components/ui/Button.tsx#default)
  - props: URL-encoded JSON of props (or base64 if props_b64=1)
  - needs: Comma-separated dependency keys to include (in addition to defaults)
  - theme: light | dark (applies data-theme on <html>)

## Preview Analyzer
- Location: src/tools/preview/analyzer.js (library), scripts/preview-scan.js (CLI).
- Purpose: Analyze components to determine preview compatibility, required providers/mocks, props requirements, and blockers.

## Agent Preview Tools
- See docs/PREVIEW_TOOL.md and docs/PREVIEW_RUN_TOOL.md for usage details.

## Factory TS Integration
- Library location: packages/factory-ts (local package).
- Main process: src/main.js owns the factory-ts orchestrator and exposes IPC handlers for starting runs and streaming events via src/tools/factory/mainOrchestrator.js.
- Preload: src/preload.js exposes window.factory with methods used by the renderer to interact with the orchestrator safely.
- Renderer bridge: src/tools/factory/orchestratorBridge.ts calls the preload API, avoiding Node-only modules in the renderer to prevent node:path externalization issues.
- Renderer service/hook: src/renderer/services/agentsService.ts and src/renderer/hooks/useAgents.ts can consume the renderer bridge and receive EventSource-like streams.
- CLI: scripts/runAgent.mjs streams JSONL events for a run. Build the package with npm run factory:build and then use npm run run:agent.

The orchestrator now calculates token usage and costs for LLM calls and emits run/usage events:
- Tokens are accumulated across the run (promptTokens, completionTokens).
- Costs are computed using per-provider/model prices stored under .factory/prices.json via the PricingManager.
- The main process exposes pricing IPC handlers:
  - factory:pricing:get returns current prices and updatedAt.
  - factory:pricing:refresh optionally accepts { provider, url } to refresh from a configurable supplier URL.

History persistence for agent runs:
- Main process initializes a HistoryStore (packages/factory-ts) under .factory/history/.
- Run metadata is persisted continuously to .factory/history/runs.json.
- Conversation messages are saved per-run in .factory/history/runs/<runId>.messages.json based on llm/messages snapshot events.
- Renderer can load history via preload factory API: listRunHistory() and getRunMessages(runId).
- agentsService bootstraps runs from both active (in-memory) and persisted history on start.

### Isolated Orchestrator and Packaged App Environments
- packages/factory-ts/src/orchestrator.ts: runIsolatedOrchestrator accepts an optional repoRoot absolute path and will avoid copying from Electron's app.asar virtual filesystem. If not provided, it attempts to resolve a real filesystem directory using Electron's process.resourcesPath, or by stripping the .asar segment and preferring app.asar.unpacked when present. Pass an absolute projectDir to copy only that directory into the temp workspace.

### Environment Variables and Git Credentials
- On app start (main process), src/tools/factory/mainOrchestrator.js now loads the workspace .env file from projectRoot/.env. This ensures that GIT credentials (GIT_PAT/GIT_TOKEN/GITHUB_TOKEN/GH_TOKEN, GIT_USER_NAME/GIT_USERNAME, GIT_USER_EMAIL, GIT_REPO_URL/REPO_URL) are available to the factory-ts GitManager.
- The factory-ts GitManager also attempts to load a .env from the repository root passed to it (and its parent), providing an additional safeguard when running in isolated workspaces.
