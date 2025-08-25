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
│   ├─ task_create.html           # Popup window for creating a new task
│   ├─ preload.js
│   ├─ renderer/
│   │   ├─ App.tsx                # React entry mounting legacy list/details views
│   │   ├─ TaskCreateView.tsx     # React entry wrapping task create view
│   │   ├─ FeatureCreateView.tsx  # React form for creating a new feature
│   │   ├─ components/
│   │   │   ├─ stringListEditor.js    # Reusable multi-row text input component
│   │   │   └─ ui/                   # Common UI primitives (shadcn-like)
│   │   │      ├─ toast.tsx          # ToastProvider, useToast, Toaster
│   │   │      ├─ modal.tsx          # Modal & AlertDialog popups
│   │   │      ├─ alert.tsx          # Inline alert banners
│   │   │      └─ index.ts           # Barrel exports
│   │   ├─ utils/
│   │   │   ├─ dom.js             # $, createEl helpers for DOM
│   │   │   ├─ routing.js         # parseRoute, routeName, parseTaskIdFromLocation
│   │   │   ├─ status.js          # STATUS_LABELS/OPTIONS, cssStatus, statusBadge
│   │   │   └─ tasks.js           # toTasksArray, filterTasks, countFeatures, computeNextTaskId
│   │   ├─ tasksListView.js       # Legacy Tasks list UI (DOM-based), now using utils
│   │   ├─ taskDetailsView.js     # Legacy Task details UI (DOM-based), now using utils
│   │   ├─ featureCreateView.js   # Legacy feature create (DOM-based), now using utils
│   │   └─ taskCreateView.js      # Legacy task create (DOM-based), now using utils
│   ├─ tasks/
│   │  └─ indexer.js              # Logical Tasks indexer, validator, and file watcher
│   └─ types/
│      └─ tasks.ts                # TypeScript interfaces for task schema
├─ docs/
│  ├─ FILE_ORGANISATION.md
│  ├─ LINTING_AND_FORMATTING.md
│  ├─ COMPONENTS_AND_THEMING.md   # How to use the common UI primitives
│  └─ tasks/
│     ├─ task_example.json
│     └─ task_format.py           # Python source-of-truth schema
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
    - tasks:add (invoke) creates a new task directory tasks/{id}/ and writes a minimal valid task.json, then triggers an index rebuild
    - feature-create:open (invoke) opens a modal popup window for adding a new feature to a task
    - task-create:open (invoke) opens a modal popup window for creating a new task
  - Preload exposes window.tasksIndex with:
    - getSnapshot() and onUpdate(cb) for renderer use
    - updateTask(taskId, data) to persist edits to a task (title/description)
    - updateFeature(taskId, featureId, data) to persist edits to a feature
    - addFeature(taskId, feature) to create a new feature under a task
    - addTask(task) to create a new task; accepts { id?, status?, title, description } and returns { ok, id? }
    - openFeatureCreate(taskId) to open the popup create window for a given task id
    - openTaskCreate() to open the popup window for creating a new task

## Renderer UI
- Location: src/renderer/
- Purpose:
  - App.tsx mounts the React app and renders containers for the legacy list and details views while we migrate. This ensures the app uses React for the UI entry point.
  - TaskCreateView.tsx wraps the legacy task creation UI in a React entry.
  - FeatureCreateView.tsx implements the popup form for creating a new feature using React.
- Shared Utilities and Components:
  - components/ui/: Common UI primitives (toast, modal/alert dialog, alert banners) styled with Tailwind-like utilities for easy theming (shadcn-inspired).
  - utils/dom.js: DOM query and element creation helpers ($, createEl)
  - utils/status.js: Status labels/options and statusBadge rendering helper
  - utils/routing.js: parseRoute, routeName, and parseTaskIdFromLocation
  - utils/tasks.js: Common task helpers (filtering, counting, next-id computation)
  - components/stringListEditor.js: Reusable multi-row text input editor

Performance
- See docs/tasks/INDEXING_PERFORMANCE.md for measurement methodology and indicative results.
