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
- Updated: src/renderer/App.tsx — now wraps the app with ToastProvider and a new NavigatorProvider; adds a global ModalHost to render modals above screens.
- Updated: src/renderer/screens/SidebarView.tsx — refactored into a flexible layout with a collapsible left sidebar and a scrollable content area; sidebar width transitions between 56 and 14 tailwind units, collapsed state persisted in localStorage.
- Updated: src/renderer/screens/DocumentsView.tsx — wrapped in a flex column with min-h-0 and proper overflow to prevent oversized content.
- Updated: src/renderer/screens/ChatView.tsx — adjusted layout to use fixed-width left chat list and flexible right pane with min-w-0/min-h-0 for correct resizing.
- Updated: src/renderer/screens/TasksView.tsx — simplified to render only list/details; modals removed from here and moved to global ModalHost via Navigator.

New navigation layer:
- Added: src/renderer/navigation/Navigator.tsx — app-wide navigation context that parses location.hash into currentView, tasksRoute, and modal state. Exposes openModal/closeModal and navigation helpers.
- Added: src/renderer/navigation/ModalHost.tsx — central modal renderer that overlays the active screen and mounts task-related modals.
- Added: src/renderer/navigation/index.ts — re-exports Navigator hooks/components.

UI utilities for consistency:
- Added: src/renderer/components/ui/index.ts — barrel exports for Modal/AlertDialog and Toast utilities.
- Added: src/renderer/components/ui/toast.tsx — lightweight ToastProvider and useToast hook used by task modals.
- Added: src/renderer/components/ui/modal.ts — compatibility re-export to satisfy existing lower-case import paths (e.g., ChatView).

Task modal components updated to support global navigator:
- Updated: src/renderer/tasks/TaskCreateView.tsx — accepts onRequestClose and uses it instead of window.close() when provided.
- Updated: src/renderer/tasks/FeatureCreateView.tsx — accepts onRequestClose and uses it instead of window.close() when provided.
- Updated: src/renderer/tasks/TaskEditView.tsx — accepts onRequestClose and uses it instead of window.close() when provided.
- Updated: src/renderer/tasks/FeatureEditView.tsx — accepts onRequestClose and uses it instead of window.close() when provided.

## Example Tree (illustrative)
The following tree is graphical and illustrative of a typical repository layout:

```
repo_root/
├─ docs/
│  ├─ FILE_ORGANISATION.md
│  ├─ BUILD_SIGNING.md
│  └─ …
├─ src/
│  ├─ renderer/
│  │  ├─ navigation/
│  │  │  ├─ Navigator.tsx              # Global navigation state (screen + modal)
│  │  │  ├─ ModalHost.tsx              # Renders modals globally above screens
│  │  │  └─ index.ts                   # Re-exports
│  │  ├─ components/
│  │  │  └─ ui/
│  │  │     ├─ Modal.tsx               # Reusable Modal + AlertDialog
│  │  │     ├─ modal.ts                # Compatibility re-export
│  │  │     ├─ toast.tsx               # ToastProvider + useToast (lightweight)
│  │  │     └─ index.ts                # Barrel exports
│  │  ├─ screens/
│  │  │  ├─ SidebarView.tsx
│  │  │  ├─ TasksView.tsx              # Uses Navigator to render list/details only
│  │  │  ├─ DocumentsView.tsx
│  │  │  └─ ChatView.tsx
│  │  ├─ tasks/
│  │  │  ├─ TaskCreateView.tsx         # Updated to use onRequestClose
│  │  │  ├─ TaskEditView.tsx           # Updated to use onRequestClose
│  │  │  ├─ FeatureCreateView.tsx      # Updated to use onRequestClose
│  │  │  └─ FeatureEditView.tsx        # Updated to use onRequestClose
│  │  ├─ App.tsx                       # Wrapped with Toast + Navigator; includes ModalHost
│  │  └─ types.ts
│  ├─ index.css                         # Full-height layout + styles (updated)
│  ├─ main.js
│  └─ preload.js
└─ …
```

## Notes on Modals and Navigation
- Modals are now rendered by a global ModalHost mounted in App, ensuring they overlay the current screen properly (no underlying TasksView rendering issues).
- NavigatorProvider centralizes route parsing from location.hash into three concerns: currentView, tasksRoute, and modal.
- TasksView no longer owns modal routing; it focuses only on list/details rendering. Opening a modal uses Navigator (or existing hash changes) and closing a modal restores the last non-modal route.
- A compatibility re-export (components/ui/modal.ts) keeps existing lowercase imports working without refactors.
