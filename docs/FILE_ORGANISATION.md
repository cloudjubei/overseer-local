# File Organisation

This document describes how files and directories are organised in this repository to keep the project navigable, consistent, and easy to evolve.

## Top-Level Directory Layout
- docs/: Project documentation and specs (single source of truth for protocols, formats, and guidelines).
- src/: Application source (Electron main + React renderer + tooling).
  - src/styles/: Shared CSS assets and design tokens, grouped by role (foundations, primitives, components, layout, screens).
  - src/types/: Shared TypeScript types.
  - src/renderer/: React renderer (components, screens, hooks, services, navigation, preview runtime).
    - src/renderer/components/: Reusable UI and domain-specific components.
      - src/renderer/components/tasks/: Task-related UI elements (status controls, dependency bullets, etc.).
      - src/renderer/components/agents/: Agent-related UI elements (AgentRunBullet and future agent widgets).
    - src/renderer/screens/: High-level screens (Tasks, Documents, Chat, Settings, Agents, etc.).
    - src/renderer/tasks/: Task/feature create/edit/list/board views.
    - src/renderer/navigation/: Navigation state and modal host.
    - src/renderer/services/: Frontend services (chat/docs/tasks/projects/files/notifications/user-preferences).
      - src/renderer/services/agentsService.ts: In-memory orchestrator client that starts/monitors agent runs using the local factory-ts bridge. Tracks provider/model, costs, and token usage across runs.
    - src/renderer/hooks/: React hooks (theme, shortcuts, tasks index, dependency resolver, etc.).
      - src/renderer/hooks/useAgents.ts: Hook to subscribe to active agent runs and start/cancel them.
    - src/renderer/preview/: Component preview runtime and provider registry for isolated previews.
  - src/tools/: Developer and agent tooling (preview analysis, formatting, compile checks, docker helpers).
    - src/tools/preview/: Preview analyzer tooling.
    - src/tools/factory/: Integration layer for the local factory-ts package (orchestrator bridge and helpers).
      - src/tools/factory/orchestratorBridge.ts: Renderer bridge that calls Electron preload API to start runs and receive events from the main process. Avoids importing Node-only modules in the renderer.
      - src/tools/factory/mainOrchestrator.js: Electron main-side IPC handlers that manage factory-ts orchestrator runs and stream events to renderers.
  - src/chat/: Chat providers, manager, and storage.
  - src/capture/: Screenshot capture service (main process).
  - src/files/: Files manager and per-project storage.
  - src/projects/: Projects manager and indexing.
  - src/tasks/: Tasks manager and per-project storage.
  - src/notifications/: Notifications manager and IPC integration.
  - src/preferences/: Preferences manager and user settings storage (system-wide user preferences such as last active project, task view mode, list sorting, notification settings), with IPC exposure.
  - src/main.js: Electron main process entry that owns the factory-ts orchestrator and bridges runs/events over IPC.
  - src/preload.js: Preload script exposing a minimal window.factory API to the renderer (startTaskRun, startFeatureRun, cancelRun, subscribe).
- scripts/: Project automation scripts and CLIs (e.g., preview scanning, runAgent.mjs runner for factory-ts).
- build/: Packaging resources for electron-builder (icons, entitlements, etc.).
- packages/: Local monorepo packages used by the app.
  - packages/factory-ts/: Agent orchestration library used by the app and CLI. See packages/factory-ts/FACTORY_TS_OVERVIEW.md.
    - packages/factory-ts/src/taskUtils.ts: TypeScript implementation mirroring Python task_utils.py, used by orchestrator.ts for file/task/feature/test operations and Git commits.

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
- Main process: src/main.js owns the orchestrator (createOrchestrator) and exposes IPC handlers for starting runs and streaming events via src/tools/factory/mainOrchestrator.js.
- Preload: src/preload.js exposes window.factory with methods used by the renderer to interact with the orchestrator safely.
- Renderer bridge: src/tools/factory/orchestratorBridge.ts calls the preload API, avoiding Node-only modules in the renderer to prevent node:path externalization issues.
- Renderer service/hook: src/renderer/services/agentsService.ts and src/renderer/hooks/useAgents.ts can consume the renderer bridge and receive EventSource-like streams.
- CLI: scripts/runAgent.mjs streams JSONL events for a run. Build the package with npm run factory:build and then use npm run run:agent.

Also note: orchestratorBridge start functions are async (await preload invoke). Ensure callers handle Promises appropriately.
