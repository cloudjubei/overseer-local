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
    - CollapsibleSidebar.tsx: Reusable collapsible navigation sidebar component, used in main app navigation and screens like Settings.
  - src/renderer/components/tasks/: Task-specific UI pieces.
    - StatusBadge.tsx: Status pill (soft/bold variants) using status tokens.
    - PriorityTag.tsx: Priority tags P0–P3.
    - StatusBullet.tsx: Interactive status bullet trigger + inline popover picker for changing a task’s status in the list (hover enlarges, shows edit glyph, click to open picker).
  - src/renderer/preview/: Component preview infrastructure (Storybook-like isolated renderer)
    - previewHost.tsx: React PreviewHost component that dynamically loads a component module and mounts it with provided props and providers. Wraps content in a stable `#preview-stage` container and signals readiness via `window.__PREVIEW_READY` + `preview:ready` event.
    - main.tsx: Entry point that boots the preview host.
    - previewTypes.ts: Types for declaring preview metadata and provider registry.
    - previewRegistry.tsx: Lightweight registry for provider factories and composition helpers.
    - withPreview.tsx: Helpers to resolve providers and apply wrappers based on meta + URL.
    - mocks/coreMocks.tsx: Default providers (theme, router, frame) and in-memory mocks (tasks, notifications, llm).
    - Usage: visit /preview.html?id=renderer/components/ui/Button.tsx#default&props=%7B%22children%22%3A%22Click%20me%22%7D&theme=light
      - id: path (relative to src/) plus optional #ExportName (default: default)
      - props: URL-encoded JSON of props (or base64 if props_b64=1)
      - needs: comma-separated dependency keys to include (in addition to defaults)
      - theme: light | dark (applies data-theme attr)
  - src/renderer/screens/
    - TasksView.tsx: Top-level tasks screen wrapper (routes between list and details views).
  - src/renderer/tasks/: Screens and views for tasks.
    - TasksListView.tsx: List view with search/filter, DnD, inline status bullet editor.
    - TaskDetailsView.tsx: Right-side details panel.
    - BoardView.tsx: Kanban-style board with columns by status.
  - src/renderer/navigation/: Navigation state + modal host.
    - Navigator.tsx
    - ModalHost.tsx
  - src/renderer/settings/
    - SettingsLLMConfigModal.tsx: Modal used for adding/editing LLM provider configurations. Opened via Navigator + ModalHost.
  - src/renderer/services/
    - chatService.ts
    - docsService.ts
    - tasksService.ts
    - notificationsService.ts
  - src/renderer/hooks/
    - useChats.ts
    - useDocsIndex.ts
    - useDocsAutocomplete.ts
    - useLLMConfig.ts
    - useNextTaskId.ts
    - useShortcuts.tsx
    - useTheme.ts
    - useNotifications.ts
    - useNotificationPreferences.ts
  - src/renderer/screens/
    - SidebarView.tsx
    - TasksView.tsx
    - DocumentsView.tsx
    - ChatView.tsx
    - SettingsView.tsx
    - NotificationsView.tsx
  - src/renderer/tasks/
    - TaskCreateView.tsx
    - TaskEditView.tsx
    - FeatureCreateView.tsx
    - FeatureEditView.tsx
  - src/renderer/App.tsx
  - src/renderer/types.ts
- src/chat/ (providers and manager) – may be supplied by preload/main glue.
- src/tools/
  - standardTools.js
  - preview/: Preview analyzer tooling
    - analyzer.js: Library to analyze TSX components for preview capability.
  - Agent-facing tools:
    - preview_screenshot (in standardTools.js): Captures screenshots of components (preview.html) or any URL using Puppeteer. Supports scripted interactions and before/after capture. See docs/PREVIEW_TOOL.md.
    - ts_compile_check (in standardTools.js): Type-checks specified TypeScript/TSX files using the project tsconfig.json and returns per-file compile status and diagnostics (no emit).
    - format_files (in standardTools.js): Formats specified files using Prettier and returns per-file statuses (changed/unchanged/skipped/errors). Writes changes by default and respects .prettierignore/config.
- src/capture/: Main-process screenshot capture service and related utilities.
  - screenshotService.js: Registers IPC handler 'screenshot:capture' to capture full-window or region screenshots with PNG/JPEG output and quality settings.
- scripts/: Project automation scripts (e.g., setup-linting-formatting).
  - preview-scan.js: CLI to scan a directory of components and output a preview analysis JSON report.
- build/: Packaging resources for electron-builder (icons, entitlements, etc.).
  - build/icons/icon.icns, icon.ico, icon.png
  - build/entitlements.mac.plist
- .env, forge.config.js, index.html, preview.html, package.json, postcss.config.js, tailwind.config.js, tsconfig.json, vite.*.config.mjs

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

## Preview System
- Dedicated component preview is provided via preview.html and the src/renderer/preview/ runtime.
- In dev, open http://localhost:<vite-port>/preview.html with query params:
  - id: module path under src (e.g., renderer/components/ui/Button.tsx#default)
  - props: URL-encoded JSON of props (or base64 if props_b64=1)
  - needs: Comma-separated provider keys to include (in addition to defaults)
  - theme: light | dark (applies data-theme on <html>)
- The preview stage element is available as `#preview-stage` and a `preview:ready` event fires after mount.

## Preview Analyzer
- Location: src/tools/preview/analyzer.js (library), scripts/preview-scan.js (CLI).
- Purpose: Analyze components to determine preview compatibility, required providers/mocks, props requirements, and blockers.
- Usage:
  - node scripts/preview-scan.js --dir src/renderer/components --out preview-metadata.json
- Output: JSON report with a summary and per-file analyses. See docs/PREVIEW_ANALYZER.md.

## Agent Preview Screenshot Tool
- Integrated into src/tools/standardTools.js as preview_screenshot.
- Allows agents to request a screenshot of a component (via preview.html) or any URL.
- Accepts parameters for component path (id), props override, provider needs, theme, screenshot dimensions, variant selection (hash), wait/clip options, and output path.
- Supports scripted interactions and before/after capture. See docs/PREVIEW_TOOL.md for details.
- Requires a running dev server; provide base_url or set PREVIEW_BASE_URL.

## TypeScript Compile Check Tool (Agent)
- Integrated into src/tools/standardTools.js as ts_compile_check.
- Purpose: Quickly verify whether specific TS/TSX files compile (type-check) successfully against the project tsconfig.json.
- Input: { files: string[], tsconfig_path?: string }
- Output: { ok: boolean, results: { file, ok, errors_count, warnings_count, diagnostics[], time_ms }[], errors_total, warnings_total }
- Notes: Uses TypeScript compiler API with noEmit to avoid generating output. Diagnostics include file, line/column, and message.

## Code Formatting Tool (Agent)
- Integrated into src/tools/standardTools.js as format_files.
- Purpose: Apply Prettier formatting to specific files after writes so agents can keep code consistent.
- Input: { files: string[], write?: boolean = true, ignore_path?: string }
- Behavior: Respects project Prettier config and .prettierignore. Returns per-file statuses (changed/unchanged/skipped/errors) and writes changes when write is true.
- Output: { ok: boolean, results: { file, ok, skipped, reason?, changed, written?, time_ms, message? }[], changed_count, skipped_count, error_count }

## Repository Tree
```
repo_root/
├─ docs/
│  ├─ FILE_ORGANISATION.md
│  ├─ COMPONENT_PREVIEWS.md
│  ├─ PREVIEW_ANALYZER.md
│  ├─ PREVIEW_TOOL.md
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
│  │  ├─ preview/
│  │  │  ├─ main.tsx
│  │  │  ├─ previewHost.tsx
│  │  │  ├─ previewTypes.ts
│  │  │  ├─ previewRegistry.tsx
│  │  │  ├─ withPreview.tsx
│  │  │  └─ mocks/
│  │  │     └─ coreMocks.tsx
│  │  └─ ...
│  ├─ tools/
│  │  ├─ standardTools.js   ← includes preview_screenshot, ts_compile_check, format_files tools
│  │  └─ preview/
│  │     └─ analyzer.js
│  └─ capture/
│     └─ screenshotService.js
├─ scripts/
│  └─ preview-scan.js
├─ preview.html
├─ index.html
├─ package.json
└─ ...
```
