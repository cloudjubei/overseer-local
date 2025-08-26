# File Organisation

This document describes how files and directories are organised in this repository to keep the project navigable, consistent, and easy to evolve.

## Top-Level Directory Layout
- src/: Electron + React + TypeScript app (electron-vite)
- src/types/: Shared TypeScript types (generated from docs where applicable)
- docs/: Project documentation and specifications.
  - BUILD_SIGNING.md: How to configure code signing for macOS and Windows using electron-builder (CSC_LINK, CSC_KEY_PASSWORD, APPLE_ID, etc.) and CI examples.
  - STANDARDS.md: UI standards and conventions for screens, modals, styling, hooks/services, and navigation.
- tasks/: Per-task workspaces containing task metadata and tests.
  - tasks/{id}/task.json: Canonical task definition for a single task.
  - tasks/{id}/tests/: Deterministic tests validating each feature in the task.
- scripts/: Project automation scripts (e.g., setup-linting-formatting).
- build/: Packaging resources for electron-builder (icons, entitlements, etc.).
  - build/icons/icon.icns: Placeholder macOS app icon to be replaced with a real ICNS file.
  - build/icons/icon.ico: Placeholder Windows app icon to be replaced with a real ICO file.
  - build/icons/icon.png: Placeholder Linux app icon to be replaced with a real 512x512 PNG file.
  - build/entitlements.mac.plist: macOS entitlements for main app (hardened runtime/JIT allowances).
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

## Repository Tree
```
repo_root/
├─ docs/
│  ├─ FILE_ORGANISATION.md
│  ├─ STANDARDS.md
│  └─ BUILD_SIGNING.md
├─ src/
│  ├─ renderer/
│  │  ├─ navigation/
│  │  │  ├─ Navigator.tsx              # Global navigation state (screen + modal)
│  │  │  └─ ModalHost.tsx              # Renders modals globally above screens via portal
│  │  ├─ components/
│  │  │  └─ ui/
│  │  │     ├─ Alert.tsx               # Reusable AlertDialog
│  │  │     ├─ Button.tsx              # Reusable Button
│  │  │     ├─ Modal.tsx               # Reusable Modal
│  │  │     └─ Toast.tsx               # ToastProvider + useToast (lightweight)
│  │  ├─ services/
│  │  │  ├─ chatService.ts             # Wraps window.chat API
│  │  │  ├─ docsService.ts             # Wraps window.docsIndex API + helpers
│  │  │  └─ tasksService.ts            # Wraps window.tasksIndex API
│  │  ├─ hooks/
│  │  │  ├─ useChats.ts                # Chat state + send flow
│  │  │  ├─ useDocsIndex.ts            # Subscribe to docs index, expose docsList
│  │  │  ├─ useDocsAutocomplete.ts     # @mention detection and suggestion UI logic
│  │  │  ├─ useLLMConfig.ts            # LLM config management
│  │  │  └─ useNextTaskId.ts           # Next task ID calculation (via tasksService)
│  │  ├─ screens/
│  │  │  ├─ SidebarView.tsx
│  │  │  ├─ TasksView.tsx
│  │  │  ├─ DocumentsView.tsx
│  │  │  └─ ChatView.tsx               # UI consumes hooks/services
│  │  ├─ tasks/
│  │  │  ├─ TaskCreateView.tsx         # Uses tasksService; closes via onRequestClose
│  │  │  ├─ TaskEditView.tsx           # Always in Modal; shows loading inside modal
│  │  │  ├─ FeatureCreateView.tsx      # Uses tasksService; closes via onRequestClose
│  │  │  └─ FeatureEditView.tsx        # Always in Modal; shows loading inside modal
│  │  ├─ App.tsx
│  │  └─ types.ts                      # +ChatMessage/LLMConfig
│  ├─ index.css
│  ├─ main.js
│  └─ preload.js
└─ …
```