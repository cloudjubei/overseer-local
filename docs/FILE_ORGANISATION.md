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
- Updated: src/renderer/screens/SidebarView.tsx — refactored to use Navigator for view state and navigation instead of manual hash parsing; retains collapsible sidebar with persisted state.
- Updated: src/renderer/screens/DocumentsView.tsx — wrapped in a flex column with min-h-0 and proper overflow to prevent oversized content.
- Updated: src/renderer/screens/ChatView.tsx — refactored to separate logic from UI using new hooks/services; layout uses fixed-width left chat list and flexible right pane with min-w-0/min-h-0 for correct resizing.
- Updated: src/renderer/screens/TasksView.tsx — renders only list/details; modals handled by global ModalHost via Navigator.

New navigation layer:
- Added: src/renderer/navigation/Navigator.tsx — app-wide navigation context that parses location.hash into currentView, tasksRoute, and modal state. Exposes openModal/closeModal and navigation helpers.
- Added: src/renderer/navigation/ModalHost.tsx — central modal renderer that overlays the active screen and mounts task-related modals.
- Added: src/renderer/navigation/index.ts — re-exports Navigator hooks/components.

UI utilities for consistency:
- Added: src/renderer/components/ui/index.ts — barrel exports for Modal/AlertDialog and Toast utilities.
- Added: src/renderer/components/ui/toast.tsx — lightweight ToastProvider and useToast hook used by task modals.
- Added: src/renderer/components/ui/modal.ts — compatibility re-export to satisfy existing lower-case import paths (e.g., ChatView).

Task modal components and hooks:
- Updated: src/renderer/tasks/TaskCreateView.tsx — now uses extracted hook useNextTaskId for ID calculation and subscription.
- Unchanged interface but compatible: src/renderer/tasks/TaskEditView.tsx, src/renderer/tasks/FeatureCreateView.tsx, src/renderer/tasks/FeatureEditView.tsx — continue to accept onRequestClose and use it instead of window.close() when provided.
- Added: src/renderer/hooks/useNextTaskId.ts — encapsulates next-ID calculation and subscription to the tasks index.

Logic/UI split: services and hooks for renderer logic
- Added: src/renderer/services/chatService.ts — wraps window.chat API with typed methods (getCompletion/list/create/load/save/delete).
- Added: src/renderer/services/docsService.ts — wraps window.docsIndex API and provides extractPathsFromIndexTree helper.
- Added: src/renderer/hooks/useChats.ts — manages chats list, current chat, messages and sending flow (including completion + persistence) for ChatView.
- Added: src/renderer/hooks/useDocsIndex.ts — subscribes to the docs index and provides a derived flat docsList for UI consumption.
- Added: src/renderer/hooks/useDocsAutocomplete.ts — encapsulates @-mention detection, matching against docsList, cursor position calculation, and selection behavior for ChatView.
- Added: src/renderer/hooks/useLLMConfig.ts — centralizes LLM configuration loading/saving via LLMConfigManager and exposes isConfigured flag.
- Updated: src/renderer/types.ts — now defines shared ChatMessage and LLMConfig types alongside NavigationView.

Example Tree (illustrative):
```
repo_root/
├─ docs/
│  ├─ FILE_ORGANISATION.md
│  └─ BUILD_SIGNING.md
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
│  │  ├─ services/
│  │  │  ├─ chatService.ts             # Wraps window.chat API
│  │  │  └─ docsService.ts             # Wraps window.docsIndex API + helpers
│  │  ├─ hooks/
│  │  │  ├─ useChats.ts                # Chat state + send flow
│  │  │  ├─ useDocsIndex.ts            # Subscribe to docs index, expose docsList
│  │  │  ├─ useDocsAutocomplete.ts     # @mention detection and suggestion UI logic
│  │  │  ├─ useLLMConfig.ts            # LLM config management
│  │  │  └─ useNextTaskId.ts           # Next task ID calculation
│  │  ├─ screens/
│  │  │  ├─ SidebarView.tsx
│  │  │  ├─ TasksView.tsx
│  │  │  ├─ DocumentsView.tsx
│  │  │  └─ ChatView.tsx               # Now focused on UI; logic via hooks/services
│  │  ├─ tasks/
│  │  │  ├─ TaskCreateView.tsx         # Uses useNextTaskId
│  │  │  ├─ TaskEditView.tsx
│  │  │  ├─ FeatureCreateView.tsx
│  │  │  └─ FeatureEditView.tsx
│  │  ├─ App.tsx
│  │  └─ types.ts                      # +ChatMessage/LLMConfig
│  ├─ index.css
│  ├─ main.js
│  └─ preload.js
└─ …
```

Notes on the refactor
- ChatView is now UI-only: data fetching, completion flow, and mention logic live in hooks/services. This makes the chat UI easier to maintain and test and clarifies responsibilities.
- SidebarView uses the centralized Navigator state and helpers for consistency and to avoid duplicate hash parsing logic.
- A new services layer wraps window APIs to simplify mocking and future evolution of IPC boundaries.
- All new files are documented above; no file was deleted. Existing imports that referenced Modal via lowercase path still work thanks to the compatibility re-export under components/ui/modal.ts.
