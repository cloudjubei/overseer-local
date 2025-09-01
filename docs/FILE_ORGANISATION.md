# File Organisation

This document describes how files and directories are organised in this repository to keep the project navigable, consistent, and easy to evolve.

## Top-Level Directory Layout
- docs/: Project documentation and specs (single source of truth for protocols, formats, and guidelines).
- src/: Application source (Electron main + React renderer + tooling).
  - src/styles/: Shared CSS assets and design tokens, grouped by role (foundations, primitives, components, layout, screens).
  - src/types/: Shared TypeScript types.
  - src/renderer/: React renderer (components, screens, hooks, services, navigation, preview runtime).
    - src/renderer/components/: Reusable UI and domain-specific components.
    - src/renderer/screens/: High-level screens (Tasks, Documents, Chat, Settings, etc.).
    - src/renderer/tasks/: Task/feature create/edit/list/board views.
    - src/renderer/navigation/: Navigation state and modal host.
    - src/renderer/services/: Frontend services (chat/docs/tasks/projects/files/notifications).
    - src/renderer/hooks/: React hooks (theme, shortcuts, tasks index, dependency resolver, etc.).
    - src/renderer/preview/: Component preview runtime and provider registry for isolated previews.
  - src/chat/: Chat providers, manager, and storage.
  - src/tools/: Developer and agent tooling (preview analysis, formatting, compile checks, docker helpers).
    - src/tools/preview/: Preview analyzer tooling.
  - src/capture/: Screenshot capture service (main process).
  - src/files/: Files manager and per-project storage.
  - src/projects/: Projects manager and indexing.
  - src/tasks/: Tasks manager and per-project storage.
  - src/notifications/: Notifications manager and IPC integration.
- scripts/: Project automation scripts and CLIs (e.g., preview scanning).
- build/: Packaging resources for electron-builder (icons, entitlements, etc.).

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
