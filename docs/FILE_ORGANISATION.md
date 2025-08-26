# File Organisation

This document describes how files and directories are organised in this repository to keep the project navigable, consistent, and easy to evolve.

## Top-Level Directory Layout
- src/: Electron + React + TypeScript app (electron-vite)
- src/types/: Shared TypeScript types (generated from docs where applicable)
- docs/: Project documentation and specifications.
  - BUILD_SIGNING.md: How to configure code signing for macOS and Windows using electron-builder (CSC_LINK, CSC_KEY_PASSWORD, APPLE_ID, etc.) and CI examples.
- tasks/: Per-task workspaces containing task metadata and tests.
  - tasks/{id}/task.json: Canonical task definition for a single task.
  - tasks/{id}/tests/: Deterministic tests validating each feature in the task.
- scripts/: Project automation scripts (e.g., setup-linting-formatting).
- build/: Packaging resources for electron-builder (icons, entitlements, etc.).
  - build/icons/icon.icns: Placeholder macOS app icon to be replaced with a real ICNS file.
  - build/icons/icon.ico: Placeholder Windows app icon to be replaced with a real ICO file.
  - build/icons/icon.png: Placeholder Linux app icon to be replaced with a real 512x512 PNG file.
  - build/entitlements.mac.plist: macOS entitlements for main app (hardened runtime/JIT allowances).
  - build/entitlements.mac.inherit.plist: macOS entitlements inherited by helper processes.
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

## Repository Tree (updated)
Key changes for responsive layout and sidebar:
- Updated: src/index.css — removed fixed body max-width/padding, added full-height layout for html/body/#root; retained component styles.
- Updated: src/renderer/App.tsx — simplified ToastProvider usage and ensured root container uses full height/width.
- Updated: src/renderer/screens/SidebarView.tsx — refactored into a flexible layout with a collapsible left sidebar and a scrollable content area; sidebar width transitions between 56 and 14 tailwind units, collapsed state persisted in localStorage.
- Updated: src/renderer/screens/DocumentsView.tsx — wrapped in a flex column with min-h-0 and proper overflow to prevent oversized content.
- Updated: src/renderer/screens/ChatView.tsx — adjusted layout to use fixed-width left chat list and flexible right pane with min-w-0/min-h-0 for correct resizing.

## Example Tree (illustrative)
The following tree is graphical and illustrative of a typical repository layout:

```
repo_root/
├─ docs/
│  ├─ FILE_ORGANISATION.md
│  ├─ BUILD_SIGNING.md
│  └─ …
├─ src/
│  ├─ docs/
│  │  └─ indexer.js
│  ├─ renderer/
│  │  ├─ components/
│  │  │  ├─ MarkdownEditor.tsx
│  │  │  ├─ MarkdownRenderer.tsx
│  │  │  └─ ui/ …
│  │  ├─ docs/
│  │  │  └─ DocumentsBrowserView.tsx
│  │  ├─ screens/
│  │  │  ├─ SidebarView.tsx        # Collapsible, responsive sidebar + content layout
│  │  │  ├─ DocumentsView.tsx      # Uses min-h-0/overflow for resizing
│  │  │  ├─ ChatView.tsx           # Resizable split layout
│  │  │  └─ SettingsView.tsx
│  │  ├─ tasks/
│  │  │  ├─ TasksListView.tsx
│  │  │  └─ TaskDetailsView.tsx
│  │  ├─ App.tsx                   # App root with full-size container
│  │  └─ types.ts
│  ├─ tasks/
│  │  ├─ validator.js
│  │  └─ indexer.js
│  ├─ chat/
│  │  └─ manager.js
│  ├─ index.css                    # Full-height layout + styles (updated)
│  ├─ main.js
│  └─ preload.js
└─ …
```

## Notes on Responsiveness
- The app uses a common flex layout: a collapsible left sidebar and a main content area.
- min-h-0 and min-w-0 are applied to containers that must allow children with overflow-auto to scroll correctly in nested flex layouts, ensuring large viewers (e.g., docs) do not force the window to grow.
- Sidebar collapse state is saved as localStorage key "sidebar-collapsed".
