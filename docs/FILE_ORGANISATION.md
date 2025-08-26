# File Organisation

This document describes how files and directories are organised in this repository to keep the project navigable, consistent, and easy to evolve.

## Top-Level Directory Layout
- src/: Electron + React + TypeScript app (electron-vite)
- src/types/: Shared TypeScript types (generated from docs where applicable)
- src/styles/: Shared CSS assets and design tokens.
  - src/styles/design-tokens.css: CSS variable-based design tokens (Monday-inspired palette + semantics). Supports light/dark via .dark or [data-theme="dark"]. Includes typography, spacing, radii, elevation, motion, and z-index tokens.
- docs/: Project documentation and specifications.
  - BUILD_SIGNING.md: How to configure code signing for macOS and Windows using electron-builder (CSC_LINK, CSC_KEY_PASSWORD, APPLE_ID, etc.) and CI examples.
  - STANDARDS.md: UI standards and conventions for screens, modals, styling, hooks/services, and navigation.
  - design/: Design system references and tokens.
    - design/DESIGN_TOKENS.md: Design tokens spec (colors, semantics, accessibility) for CSS/Tailwind.
    - design/DESIGN_SYSTEM.md: Comprehensive design system documentation (principles, tokens, typography, spacing, elevation, motion, radii, theming, accessibility, extension guidance).
    - design/COMPONENTS.md: Component usage guidelines (states, variants, tokens) for Buttons, Inputs, Selects, Modals, Toasts, Tooltips, Spinner, Skeleton, Command Menu, Shortcuts Help, and task primitives.
    - design/MONDAY_PALETTE_REFERENCE.md: Approximate Monday.com palette anchors and notes.
  - ux/: UX research and guidelines.
    - ux/LINEAR_UX_GUIDELINES.md: Linear.app-inspired UX patterns and interaction controls with implementation guidance.
  - styleguide/: Living style guide that demonstrates tokens and components using actual CSS.
    - styleguide/index.html: Static style guide (light/dark + density toggle) importing src/styles/design-tokens.css and src/index.css.
    - styleguide/README.md: How to view and use the style guide.
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
│  │  ├─ DESIGN_SYSTEM.md
│  │  ├─ COMPONENTS.md
│  │  └─ MONDAY_PALETTE_REFERENCE.md
│  ├─ ux/
│  │  └─ LINEAR_UX_GUIDELINES.md
│  ├─ styleguide/
│  │  ├─ index.html
│  │  └─ README.md
│  └─ tailwind.config.tokens.example.js
├─ src/
│  ├─ chat/
│  │  ├─ providers/
│  │  │  ├─ base.js
│  │  │  ├─ openai.js
│  │  │  └─ litellm.js
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
│  │  │  │  ├─ Toast.tsx
│  │  │  │  ├─ Tooltip.tsx
│  │  │  │  ├─ Spinner.tsx
│  │  │  │  ├─ Skeleton.tsx
│  │  │  │  ├─ CommandMenu.tsx
│  │  │  │  └─ ShortcutsHelp.tsx
│  │  │  └─ tasks/
│  │  │     ├─ StatusBadge.tsx
│  │  │     ├─ PriorityTag.tsx
│  │  │     └─ TaskCard.tsx
│  │  ├─ services/
│  │  │  ├─ chatService.ts             # Wraps window.chat API
│  │  │  ├─ docsService.ts             # Wraps window.docsIndex API + helpers
│  │  │  └─ tasksService.ts            # Wraps window.tasksIndex API
│  │  ├─ hooks/
│  │  │  ├─ useChats.ts
│  │  │  ├─ useDocsIndex.ts
│  │  │  ├─ useDocsAutocomplete.ts
│  │  │  ├─ useLLMConfig.ts
│  │  │  ├─ useNextTaskId.ts
│  │  │  └─ useShortcuts.tsx
│  │  ├─ screens/
│  │  │  ├─ SidebarView.tsx
│  │  │  ├─ TasksView.tsx
│  │  │  ├─ DocumentsView.tsx
│  │  │  ├─ ChatView.tsx               # UI consumes hooks/services
│  │  │  └─ SettingsView.tsx           # Settings screen with theme and LLM configurations
│  │  ├─ tasks/
│  │  │  ├─ TaskCreateView.tsx         
│  │  │  ├─ TaskEditView.tsx           # Always in Modal
│  │  │  ├─ FeatureCreateView.tsx      
│  │  │  ├─ FeatureEditView.tsx        # Always in Modal
│  │  │  ├─ TaskDetailsView.tsx        # Details + features
│  │  │  └─ TasksListView.tsx          # List, filters, reorder
│  │  ├─ App.tsx
│  │  └─ types.ts
│  ├─ styles/
│  │  └─ design-tokens.css
│  ├─ index.css
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
- Added foundational tokens for typography, spacing, radii, elevation, motion, and z-index to src/styles/design-tokens.css.
- Created a comprehensive design system guide (DESIGN_SYSTEM.md) and component guidelines (COMPONENTS.md).
- Introduced a living style guide at docs/styleguide/index.html showcasing tokens and components with light/dark and density toggles.
- These changes support Monday-inspired visuals and Linear-grade interactions with improved accessibility and maintainability.
