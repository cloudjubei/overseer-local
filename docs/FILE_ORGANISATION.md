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
    - components/file-display.css: Styles for the reusable FileDisplay component (name, size, date, type). Used across selectors, chat references, and listings.
  - src/styles/layout/: Layout building blocks like sidebar/nav.
    - layout/nav.css: Sidebar and navigation styles.
  - src/styles/screens/: Screen-scoped styles that compose primitives/components.
    - screens/tasks.css: Tasks list and toolbar styles + DnD transitions. Includes interactive status bullet and status picker patterns used in the list view.
    - screens/task-details.css: Task details panel and features list.
    - screens/board.css: Board (kanban) columns and interactions.
    - screens/settings.css: Settings view.
- src/renderer/: React renderer (screens, components, hooks, services, navigation).
  - src/renderer/components/ui/: Shared UI primitives.
    - Button.tsx: Button component with variants and loading state.
    - Spinner.tsx: Inline spinner.
    - Select.tsx, Input.tsx, Tooltip.tsx, etc.
    - SegmentedControl.tsx: Accessible segmented (radiogroup) control with icons/labels used for List ↔ Board toggle.
    - CollapsibleSidebar.tsx: Reusable collapsible navigation sidebar component, used in main app navigation and screens like Settings.
    - FileDisplay.tsx: Reusable file summary display showing name, size, last modified date, and file type. Supports compact density and interactive states. Clicking an interactive FileDisplay navigates to the full Files screen view for that file, with unsaved changes protection.
    - FileSelector.tsx: Reusable searchable file selector component using FileDisplay; supports multi-select and is used in Feature create/edit forms to populate the context field.
  - src/renderer/components/files/: File-specific viewers and editors used within the Files screen.
    - MarkdownEditor.tsx: Markdown editor with split edit/preview experience. Used when viewing .md/.mdx files. Registers unsaved-changes checks so navigation away prompts if there are pending edits.
    - BasicFileViewer.tsx: Fallback/basic viewer for non-Markdown files. Displays text for text/code files and shows file information when content viewing isn’t feasible.
  - src/renderer/components/tasks/: Task-specific UI pieces.
    - StatusBadge.tsx: Status pill (soft/bold variants) using status tokens.
    - StatusBullet.tsx: Interactive status bullet trigger + inline popover picker for changing a task’s status in the list (hover enlarges, shows edit glyph, click to open picker).
    - DependencyBullet.tsx: Reusable bullet for task/feature dependencies with hover summary and click navigation. Now uses the central dependencyResolver service for resolution and summaries.
    - FeatureSummaryCallout.tsx: Summary card for feature on hover.
    - TaskSummaryCallout.tsx: Summary card for task on hover.
    - ContextFileChip.tsx: Small inline display for a selected context file with remove action. Used in FeatureForm. Now interactive to navigate to Files screen with unsaved changes protection.
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
      - needs: Comma-separated dependency keys to include (in addition to defaults)
      - theme: light | dark (applies data-theme on <html>)
  - src/renderer/screens/
    - SidebarView.tsx
    - TasksView.tsx
    - FilesView.tsx ← Files screen shows a directory tree of all files; uses MarkdownEditor for Markdown files and BasicFileViewer for other types. Selection is synced with URL hash (#files/<path> or legacy #documents/<path>), and navigation is guarded by unsaved-changes prompts.
    - ChatView.tsx ← Chat interface. Supports `@` typing to open a Files selector and renders references using FileDisplay.
    - SettingsView.tsx
    - NotificationsView.tsx
  - src/renderer/navigation/: Navigation state + modal host.
    - Navigator.tsx
    - ModalHost.tsx
    - UnsavedChanges.ts ← Global registry and helpers for unsaved-changes prompts.
    - filesNavigation.ts ← Helpers to navigate to a file in the Files screen and parse file from hash (supports #files and legacy #documents).
  - src/renderer/services/
    - chatService.ts
    - fileService.ts ← Generic project file indexer service + content access. Indexes all files and exposes file metadata (name, size, mtime, type). Provides readFileText/readFileBinary best-effort bridges. Also exports a simple inferFileType(name) helper.
    - tasksService.ts
    - notificationsService.ts
    - dependencyResolver.ts ← Project-wide dependency resolution and validation service.
  - src/renderer/hooks/
    - useChats.ts
    - useFilesIndex.ts ← Hook to access the files index snapshot and flattened file list.
    - useFilesAutocomplete.ts
    - useReferencesAutocomplete.ts ← Autocomplete for `#` references in chat and editors.
    - useLLMConfig.ts
    - useNextTaskId.ts
    - useShortcuts.tsx
    - useTheme.ts
    - useNotifications.ts
    - useNotificationPreferences.ts
    - useTasksIndex.ts: Hook to access the tasks index snapshot.
    - useDependencyResolver.ts ← Hook for dependency resolver.

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
  - needs: Comma-separated dependency keys to include (in addition to defaults)
  - theme: light | dark (applies data-theme on <html>)

## Preview Analyzer
- Location: src/tools/preview/analyzer.js (library), scripts/preview-scan.js (CLI).
- Purpose: Analyze components to determine preview compatibility, required providers/mocks, props requirements, and blockers.

## Agent Preview Tools
- See docs/PREVIEW_TOOL.md and docs/PREVIEW_RUN_TOOL.md for usage details.

## New Components/Services
- src/renderer/navigation/UnsavedChanges.ts: Initializes a simple registry to track unsaved changes across editors and forms. Provides confirmDiscardIfUnsaved used before navigation.
- src/renderer/navigation/filesNavigation.ts: Navigation utility to open the Files screen focused on a specific file and parse file from hash. Used by FileDisplay and FilesView.
- src/renderer/components/files/MarkdownEditor.tsx: Markdown editor for .md/.mdx with split view. Registers unsaved state with UnsavedChanges.
- src/renderer/services/fileService.ts: File index and content access with graceful fallbacks. Exports inferFileType for UI components.
- src/renderer/hooks/useFilesIndex.ts: Hook to access the file index and groupings.
- FilesView replaces the previous DocumentsView; legacy '#documents' hashes are still supported and routed to the Files screen.
- src/files/indexer.js: Main-process FilesIndexer that scans and watches the current project scope directory for all files (excluding common build and VCS folders). On changes, it rebuilds the index and publishes it to the renderer via both an IPC event ('files-index:update'). The renderer's FileService consumes a global window.filesIndex proxy exposed by preload for synchronous access.
- main process wiring: src/main.js initializes FilesIndexer and exposes IPC handlers 'files-index:get' and 'files:set-context' to switch scope based on projects configuration. FilesIndexer is the only source of the files listing; UI accesses it exclusively via renderer FileService. Legacy DocsIndexer and related IPC routes have been removed and superseded by FilesIndexer + FileService.
- Preload wiring: src/preload.js exposes `window.filesIndex` (with a synchronous list() and files getter) and `window.files` helpers (readFile/readFileBinary/writeFile/ensureDir/upload) used by renderer FileService as optional bridges.
