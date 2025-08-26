# File Organisation

This document describes how files and directories are organised in this repository to keep the project navigable, consistent, and easy to evolve.

## Top-Level Directory Layout
- src/: Electron + React + TypeScript app (electron-vite)
- src/types/: Shared TypeScript types (generated from docs where applicable)
- src/styles/: Shared CSS assets and design tokens.
  - src/styles/design-tokens.css: CSS variable-based design tokens (Monday-inspired palette + semantics). Supports light/dark via .dark or [data-theme="dark"].
- docs/: Project documentation and specifications.
  - BUILD_SIGNING.md: How to configure code signing for macOS and Windows using electron-builder (CSC_LINK, CSC_KEY_PASSWORD, APPLE_ID, etc.) and CI examples.
  - STANDARDS.md: UI standards and conventions for screens, modals, styling, hooks/services, and navigation.
  - design/: Design system references and tokens.
    - design/DESIGN_TOKENS.md: Design tokens spec (colors, semantics, accessibility) for CSS/Tailwind.
    - design/MONDAY_PALETTE_REFERENCE.md: Approximate Monday.com palette anchors and notes.
  - ux/: UX research and guidelines.
    - ux/LINEAR_UX_GUIDELINES.md: Linear.app-inspired UX patterns and interaction controls with implementation guidance.
  - tailwind.config.tokens.example.js: Example Tailwind extension mapping to CSS variable tokens.
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
│  ├─ BUILD_SIGNING.md
│  ├─ design/
│  │  ├─ DESIGN_TOKENS.md
│  │  └─ MONDAY_PALETTE_REFERENCE.md
│  ├─ ux/
│  │  └─ LINEAR_UX_GUIDELINES.md
│  └─ tailwind.config.tokens.example.js
├─ src/
│  ├─ chat/
│  │  └─ manager.js
│  ├─ docs/
│  │  └─ indexer.js
│  ├─ tasks/
│  │  ├─ indexer.js
│  │  └─ validator.js
│  ├─ types/
│  │  ├─ external.d.ts
│  │  └─ tasks.ts
│  ├─ renderer/
│  │  ├─ navigation/
│  │  │  ├─ Navigator.tsx
│  │  │  └─ ModalHost.tsx
│  │  ├─ components/
│  │  │  ├─ ui/
│  │  │  │  ├─ Alert.tsx
│  │  │  │  ├─ Button.tsx
│  │  │  │  ├─ Input.tsx
│  │  │  │  ├─ Modal.tsx
│  │  │  │  ├─ Select.tsx
│  │  │  │  └─ Toast.tsx
│  │  │  └─ tasks/
│  │  │     ├─ StatusBadge.tsx           ← new: tokenized Monday-style status badge
│  │  │     ├─ PriorityTag.tsx           ← new: priority chip (parsed from title, P0..P3)
│  │  │     └─ TaskCard.tsx              ← new: board/list card with status + priority
│  │  ├─ hooks/
│  │  │  ├─ useChats.ts
│  │  │  ├─ useDocsIndex.ts
│  │  │  ├─ useDocsAutocomplete.ts
│  │  │  ├─ useLLMConfig.ts
│  │  │  └─ useNextTaskId.ts
│  │  ├─ screens/
│  │  │  ├─ SidebarView.tsx
│  │  │  ├─ TasksView.tsx
│  │  │  ├─ DocumentsView.tsx
│  │  │  └─ ChatView.tsx
│  │  ├─ services/
│  │  │  ├─ chatService.ts
│  │  │  ├─ docsService.ts
│  │  │  └─ tasksService.ts
│  │  ├─ tasks/
│  │  │  ├─ TaskCreateView.tsx
│  │  │  ├─ TaskEditView.tsx
│  │  │  ├─ TaskDetailsView.tsx
│  │  │  ├─ FeatureCreateView.tsx
│  │  │  ├─ FeatureEditView.tsx
│  │  │  ├─ TasksListView.tsx            ← updated: List/Board, DnD reorder, inline status
│  │  │  └─ BoardView.tsx                ← new: kanban board view with DnD status change
│  │  ├─ App.tsx
│  │  └─ types.ts
│  ├─ styles/
│  │  └─ design-tokens.css
│  ├─ index.css                           ← updated: board styles, priority tags, refined toolbar
│  ├─ main.js
│  └─ preload.js
├─ .env
├─ forge.config.js
├─ index.html
├─ package.json
├─ postcss.config.js
├─ README.md
├─ tailwind.config.js
├─ tsconfig.json
├─ vite.main.config.mjs
├─ vite.preload.config.mjs
├─ vite.renderer.config.mjs
└─ …
```

Notes on recent changes
- Added new token-aligned components under src/renderer/components/tasks: StatusBadge, PriorityTag, TaskCard.
- Enhanced src/renderer/tasks/TasksListView.tsx to include Monday-like colorful status indicators, priority chips, drag-and-drop reordering (list), inline status change, and a Linear-inspired toolbar with List/Board toggle.
- Added src/renderer/tasks/BoardView.tsx for a kanban board layout with drag-and-drop to change task status across columns.
- Updated src/index.css with board styles, refined toolbar, and priority chip styles using semantic design tokens.

Rationale
- Components encapsulate visual tokens and patterns for reuse across list and board views, aligning with docs/design/DESIGN_TOKENS.md and LINEAR_UX_GUIDELINES.md.
- Board view and DnD interactions improve efficiency while maintaining accessibility and keyboard support.
