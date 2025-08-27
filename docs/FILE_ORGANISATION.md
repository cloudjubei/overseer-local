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
│  ├─ renderer/
│  │  ├─ components/
│  │  │  ├─ ui/
│  │  │  │  ├─ Button.tsx
│  │  │  │  ├─ Spinner.tsx
│  │  │  │  └─ SegmentedControl.tsx
│  │  │  └─ tasks/
│  │  │     ├─ PriorityTag.tsx
│  │  │     ├─ StatusBadge.tsx
│  │  │     └─ StatusBullet.tsx   ← new
│  │  ├─ screens/
│  │  │  └─ TasksView.tsx
│  │  ├─ tasks/
│  │  │  ├─ TasksListView.tsx     ← updated to use StatusBullet
│  │  │  ├─ TaskDetailsView.tsx
│  │  │  └─ BoardView.tsx
│  │  ├─ navigation/
│  │  │  └─ Navigator.tsx
│  ├─ styles/
│  │  ├─ components/
│  │  │  ├─ buttons.css
│  │  │  ├─ forms.css
│  │  │  ├─ feedback.css
│  │  │  ├─ badges.css
│  │  │  ├─ tooltip.css
│  │  │  ├─ overlays.css
│  │  │  ├─ cards.css
│  │  │  └─ segmented.css
│  │  ├─ screens/
│  │  │  ├─ tasks.css             ← updated with status bullet + picker styles
│  │  │  ├─ board.css
│  │  │  └─ task-details.css
│  │  ├─ foundations/metrics.css
│  │  └─ primitives/effects.css
│  └─ index.css
└─ ...
```
