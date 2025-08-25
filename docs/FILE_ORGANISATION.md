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
│   ├─ feature_create.html        # Popup window for creating a new feature
│   ├─ preload.js
│   ├─ renderer/
│   │   ├─ tasksListView.js       # Tasks list UI (search + filters, view-only)
│   │   ├─ taskDetailsView.js     # Task details UI with features list (includes edit for task title/description; includes feature edit)
│   │   └─ featureCreateView.js   # Popup create feature form (same fields as edit mode)
│   ├─ tasks/
│   │  └─ indexer.js              # Logical Tasks indexer, validator, and file watcher
│   └─ types/
│      └─ tasks.ts                # TypeScript interfaces for task schema
├─ docs/
│  ├─ FILE_ORGANISATION.md
│  ├─ LINTING_AND_FORMATTING.md
│  └─ tasks/
│     ├─ task_example.json
│     └─ task_format.py           # Python source-of-truth schema
└─ tasks/
   └─ 1/
      ├─ task.json
      └─ tests/
         └─ test_1_1.py
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
    - tasks:add (invoke) creates a new task directory tasks/{id}/ and writes a minimal valid task.json, then triggers an index rebuild
    - feature-create:open (invoke) opens a modal popup window for adding a new feature to a task
  - Preload exposes window.tasksIndex with:
    - getSnapshot() and onUpdate(cb) for renderer use
    - updateTask(taskId, data) to persist edits to a task (title/description)
    - updateFeature(taskId, featureId, data) to persist edits to a feature
    - addFeature(taskId, feature) to create a new feature under a task
    - addTask(task) to create a new task; accepts { id?, status?, title, description } and returns { ok, id? }
    - openFeatureCreate(taskId) to open the popup create window for a given task id

## Renderer UI
- Location: src/renderer/
- Purpose:
  - tasksListView.js: Renders a client-side tasks list with text search and status filtering. Accessible labels and keyboard navigation (arrow keys between rows) are provided. Empty states are handled. Clicking a task navigates to its details via URL hash (#task/{id}). Includes a Create Task mode with an inline form to add a new task (ID, status, title, description). On success, navigates to the new task.
  - taskDetailsView.js: Renders a task details page showing task metadata and its features.
    - Provides a Back button.
    - Includes inline edit mode for the task's title and description with Save/Cancel; saving persists via IPC and re-renders on index updates.
    - Includes inline edit mode for a feature allowing editing: status, title, description, plan, context, acceptance, dependencies, and rejection.
    - Includes a Create mode to add a new feature implemented as a popup window (feature_create.html) with the same fields as edit mode.
  - featureCreateView.js: Implements the popup form for creating a new feature, including dependency suggestions and resolution.
- Integration: Loaded from src/index.html (main window) and src/feature_create.html (popup), subscribes to window.tasksIndex to receive index snapshots/updates and re-renders accordingly.

Performance
- See docs/tasks/INDEXING_PERFORMANCE.md for measurement methodology and indicative results.
