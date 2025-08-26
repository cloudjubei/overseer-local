# File Organisation

This document describes how files and directories are organised in this repository to keep the project navigable, consistent, and easy to evolve.

## Top-Level Directory Layout
- src/: Electron + React + TypeScript app (electron-vite)
- src/types/: Shared TypeScript types (generated from docs where applicable)
- docs/: Project documentation and specifications.
- tasks/: Per-task workspaces containing task metadata and tests.
  - tasks/{id}/task.json: Canonical task definition for a single task.
  - tasks/{id}/tests/: Deterministic tests validating each feature in the task.
- scripts/: Project automation scripts (e.g., setup-linting-formatting).
- .env, and other setup files may exist as needed.

Notes:
- All changes should be localized to the smallest reasonable scope (task- or doc-specific) to reduce coupling.
- Documentation in docs/ is the single source of truth for specs and formats.

## File Naming Conventions
- Tasks and features:
  - Task directories are numeric IDs: tasks/{id}/ (e.g., tasks/1/).
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

## Example Tree (illustrative)
The following tree is graphical and illustrative of a typical repository layout:

```
repo_root/
├─ .env
├─ .gitignore
├─ forge-config.js
├─ package.json
├─ package-lock.json
├─ README.md
├─ src/
│   ├─ index.css
│   ├─ index.html
│   ├─ index.js
│   ├─ preload.js
│   ├─ docs/
│   │  └─ indexer.js
│   ├─ main/
│   │  └─ ipc/
│   │     └─ docs.js               # IPC handlers for Docs index and file content (and saving)
│   ├─ renderer/
│   │   ├─ App.tsx                 # React app with sidebar navigation (Home, Docs)
│   │   ├─ types.ts                # Renderer-local types (e.g., View)
│   │   ├─ components/
│   │   │  ├─ Sidebar.tsx          # Sidebar component (Tailwind/shadcn-styled)
│   │   │  └─ ui/
│   │   │     ├─ toast.tsx
│   │   │     ├─ modal.tsx
│   │   │     ├─ alert.tsx
│   │   │     └─ index.ts
│   │   └─ docsBrowserView.js      # Legacy docs browser and WYSIWYG editor (ToastUI)
│   ├─ tasks/
│   │  └─ indexer.js               # Logical Tasks indexer, validator, and file watcher
│   └─ types/
│      └─ tasks.ts                 # TypeScript interfaces for task schema
├─ docs/
│  ├─ FILE_ORGANISATION.md
│  ├─ LINTING_AND_FORMATTING.md
│  ├─ COMPONENTS_AND_THEMING.md
│  └─ tasks/
│     ├─ task_example.json
│     └─ task_format.py            # Python source-of-truth schema
├─ tasks/
│  └─ 1/
│     ├─ task.json
│     └─ tests/
│        └─ test_1_1.py
├─ vite.main.config.js            # Vite config for main process
├─ vite.preload.config.js         # Vite config for preload scripts
└─ vite.renderer.config.js        # Vite config for renderer (React)
```

## Logical Tasks Indexer
- Location: src/tasks/indexer.js
- Purpose: Scans tasks/{id}/ directories under the selected project root to build an in-memory index of tasks and features; watches for file changes and refreshes the index.
- API:
  - Class TasksIndexer(projectRoot)
    - getIndex(): returns the current index snapshot
    - init(): builds the index and starts watchers
    - buildIndex(): triggers a full rescan
    - stopWatching(): stops all watchers
  - Additional exports:
    - validateTask(task): validates a parsed task.json object
    - STATUSES: Set of allowed status codes
  - Index shape:
    - { root, tasksDir, updatedAt, tasksById, featuresByKey, errors, metrics: { lastScanMs, lastScanCount } }
- Integration:
  - The Electron main process instantiates the indexer and exposes IPC channels:
    - tasks-index:get (invoke) returns the index snapshot
    - tasks-index:update (event) pushes updates on changes
    - tasks:update (invoke) updates a task's fields (currently title and description) in tasks/{id}/task.json and triggers an index rebuild
    - tasks-feature:update (invoke) updates a feature in tasks/{id}/task.json and triggers an index rebuild
    - tasks-feature:add (invoke) appends a new feature to tasks/{id}/task.json and triggers an index rebuild
    - tasks-features:reorder (invoke) reorders a task's features and renumbers their ids to `${taskId}.N`, updates dependencies across tasks, and triggers an index rebuild
    - tasks:add (invoke) creates a new task directory tasks/{id}/ and writes a minimal valid task.json, then triggers an index rebuild
    - tasks:reorder (invoke) reorders tasks globally, renumbers task directory ids to 1..N per the new order, updates each affected task.json id, updates dotted feature ids and dependencies across all tasks, and triggers an index rebuild
    - feature-create:open (invoke) opens a modal popup window for adding a new feature to a task
    - task-create:open (invoke) opens a modal popup window for creating a new task

## Logical Docs Indexer
- Location: src/docs/indexer.js
- Purpose: Scans the project's docs/ directory (and all subdirectories) for Markdown (.md) files to build an in-memory documentation index; watches for file changes and refreshes the index.
- API:
  - Class DocsIndexer(projectRoot, options?)
    - getIndex(): returns the current index snapshot
    - init(): builds the index and starts a cross-platform watcher (polling)
    - buildIndex(): triggers a full rescan and rebuilds the index tree
    - stopWatching(): stops the watcher
    - onUpdate(cb): subscribes to index updates; returns an unsubscribe function
  - Options:
    - pollingIntervalMs (number, default 1000): how frequently to poll for file changes
    - maxTitleBytes (number, default 64KB): maximum bytes to read from each file to extract a title and headings
  - Index shape:
    - { root, docsDir, updatedAt, tree, files, errors, metrics: { lastScanMs, lastScanCount } }
    - tree: a directory tree beginning at docs/, where each node has:
      - type: 'dir' | 'file'
      - name, relPath, absPath
      - For 'dir': dirs[] and files[] arrays with child nodes
      - For 'file': size, mtimeMs, title (first H1 or filename), headings[] (array of { level, text })
- Notes:
  - The watcher uses a portable polling strategy to detect changes across platforms, avoiding native watcher limitations.
  - Only files with a .md extension are indexed (case-insensitive). Non-Markdown files are ignored.
  - Basic metadata is extracted without rendering Markdown; rendering and sanitization are handled in the renderer layer.
- Integration (IPC):
  - The Electron main process instantiates a singleton DocsIndexer and exposes channels via src/main/ipc/docs.js:
    - docs-index:get (invoke) returns the current index snapshot
    - docs-index:update (event) broadcasts updates when the index changes
    - docs-file:get (invoke) reads and returns the UTF-8 content of a .md file by relative path under docs/
    - docs-file:save (invoke) writes UTF-8 content to a .md file by relative path under docs/
  - Preload exposes a safe renderer bridge as window.docsIndex with methods:
    - get(): Promise resolving to the index snapshot
    - subscribe(cb): subscribe to updates; returns unsubscribe function
    - getFile(relPath): Promise resolving to the file content
    - saveFile(relPath, content): Promise resolving when save completes

## Notes on Renderer Layers
- The repository currently contains both a React renderer (src/renderer/App.tsx) and a legacy DOM-based renderer used by src/index.html.
- The legacy docs browser implementation lives at src/renderer/docsBrowserView.js and integrates with Toast UI Editor for WYSIWYG Markdown editing.
- Future work may consolidate the renderer into a single React app; until then, keep both layers working without conflict.

## Updates
- 2025-08-26: Added a Tailwind-styled Sidebar component (src/renderer/components/Sidebar.tsx) and updated App.tsx to use it with persistent layout; removed dependency on App.css in favor of Tailwind/shadcn classes. Added src/renderer/types.ts to centralize renderer-local types (View).
