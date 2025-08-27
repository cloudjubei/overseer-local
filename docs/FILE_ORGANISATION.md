# File Organisation

This document describes how files and directories are organised in this repository to keep the project navigable, consistent, and easy to evolve.

## Top-Level Directory Layout
- src/: Electron + React + TypeScript app (electron-vite)
- src/types/: Shared TypeScript types (generated from docs where applicable)
- src/styles/: Shared CSS assets and design tokens.
  - src/styles/design-tokens.css: CSS variable-based design tokens (Monday-inspired palette + semantics). Supports light/dark via .dark or [data-theme="dark"]. Includes typography, spacing, radii, elevation, motion, and z-index tokens.
  - src/styles/foundations/: Foundational CSS not specific to components (metrics, global control sizes).
    - foundations/metrics.css: Root control sizes, paddings, focus ring width, and sidebar metrics.
  - src/styles/primitives/: Low-level reusable effects/utilities.
    - primitives/effects.css: Focus ring utility, pressable, elevation helpers, hover-raise, reveal-on-hover, DnD helpers, view transition keyframes.
  - src/styles/components/: Reusable component styles.
    - components/buttons.css: .btn variants and states.
    - components/forms.css: .ui-input, .ui-textarea, .ui-select and generic form layouts.
    - components/feedback.css: Spinner and Skeleton styles.
    - components/badges.css: Status badges and priority tags.
    - components/tooltip.css: Tooltip.
    - components/overlays.css: Command menu, help overlay.
    - components/cards.css: Task card.
    - components/segmented.css: Segmented control (pill-style switch) used for List ↔ Board view toggle.
  - src/styles/layout/: Layout building blocks like sidebar/nav.
    - layout/nav.css: Sidebar and navigation styles.
  - src/styles/screens/: Screen-scoped styles that compose primitives/components.
    - screens/tasks.css: Tasks list and toolbar styles + DnD transitions. Includes interactive status bullet and status picker patterns used in the list view.
    - screens/task-details.css: Task details panel and features list.
    - screens/board.css: Board (kanban) columns and interactions.
    - screens/docs.css: Documents view.
    - screens/settings.css: Settings view.
- src/renderer/: React renderer (screens, components, hooks, services, navigation).
  - src/renderer/components/ui/: Shared UI primitives.
    - Button.tsx: Button component with variants and loading state.
    - Spinner.tsx: Inline spinner.
    - Select.tsx, Input.tsx, Tooltip.tsx, etc.
    - SegmentedControl.tsx: Accessible segmented (radiogroup) control with icons/labels used for List ↔ Board toggle.
  - src/renderer/components/tasks/: Task-specific UI pieces.
    - StatusBadge.tsx: Status pill (soft/bold variants) using status tokens.
    - PriorityTag.tsx: Priority tags P0–P3.
    - StatusBullet.tsx: Interactive status bullet trigger + inline popover picker for changing a task’s status in the list (hover enlarges, shows edit glyph, click to open picker).
  - src/renderer/screens/
    - TasksView.tsx: Top-level tasks screen wrapper (routes between list and details views).
  - src/renderer/tasks/: Screens and views for tasks.
    - TasksListView.tsx: List view with search/filter, DnD, inline status bullet editor.
    - TaskDetailsView.tsx: Right-side details panel.
    - BoardView.tsx: Kanban-style board with columns by status.
  - src/renderer/navigation/: Navigation state + modal host.
    - Navigator.tsx
  - src/renderer/services/: Renderer-side service modules (IPC access)
    - projectsService.ts: Lists and gets child projects via preload window.projectsIndex.
  - src/renderer/projects/: Renderer-side project context
    - ProjectContext.tsx: Tracks active project (main vs child), exposes hooks to switch and consume active project across the app.
- src/tools/: Library of standard tools for agents.
  - src/tools/standardTools.js: Defines tool schemas and implementations for standard agent tools.
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

## New: Projects subsystem
- src/projects/: Main-process indexer for child projects under projects/
  - src/projects/indexer.js: Scans the projects/ directory for .json files, validates them against ProjectSpec, builds an index, and watches for changes. Emits 'projects-index:update' via IPC.
  - src/projects/validator.js: Runtime validation of ProjectSpec objects.
- src/renderer/services/projectsService.ts: Renderer-side service that accesses window.projectsIndex to list and load child projects.
- src/renderer/projects/ProjectContext.tsx: Renderer-side provider and hooks to manage the active project context (main vs child projects) across the app. Persists selection and stays in sync with the projects index.
- IPC exposure:
  - Preload: window.projectsIndex with get() and subscribe(callback) methods.
  - Main: ipcMain.handle('projects-index:get') returns the latest projects index snapshot.

Projects directory expectations
- Location: <project-root>/projects/
- Files: One or more .json config files matching the ProjectSpec interface (see src/types/tasks.ts).
- Security: ProjectSpec.path is normalized and must resolve under projects/; configs escaping this directory are ignored and reported as errors.

## File Naming Conventions
- Tasks and features:
  - Task directories are numeric IDs: tasks/{id}/ (e.g., tasks/1/).
  - Tests are named per-feature: tasks/{task_id}/tests/test_{task_id}_{feature_number}.py (e.g., tasks/15/tests/test_15_3.py).
- Javascript/TypeScript modules: camelCase.js/ts. For schema mirrors adjacent to Python specs, a matching snake_case.ts is acceptable under docs/.
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
│  ├─ ux/
│  ├─ styleguide/
│  └─ tailwind.config.tokens.example.js
├─ src/
│  ├─ chat/
│  ├─ docs/
│  ├─ tasks/
│  ├─ projects/               ← NEW: child projects indexer + validator
│  │  ├─ indexer.js
│  │  └─ validator.js
│  ├─ types/
│  ├─ renderer/
│  │  ├─ services/
│  │  │  └─ projectsService.ts
│  │  ├─ projects/
│  │  │  └─ ProjectContext.tsx  ← NEW: active project provider + hooks
│  │  └─ ...
│  ├─ styles/
│  ├─ tools/
│  ├─ index.css
│  ├─ main.js                 ← wired IPC for projects-index
│  └─ preload.js              ← exposes window.projectsIndex API
├─ tasks/
├─ projects/                  ← Scanned JSON configs for child projects
├─ package.json
└─ ...
```
