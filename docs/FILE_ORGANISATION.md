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
    - components/segmented.css: Segmented control (pill-style switch) used for List ↔ Board toggle.
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
    - Modal.tsx ← NEW: Lightweight modal wrapper reusing overlays styles for dialogs.
  - src/renderer/components/tasks/: Task-specific UI pieces.
    - StatusBadge.tsx: Status pill (soft/bold variants) using status tokens.
    - PriorityTag.tsx: Priority tags P0–P3.
    - StatusBullet.tsx: Interactive status bullet trigger + inline popover picker for changing a task’s status in the list (hover enlarges, shows edit glyph, click to open picker).
  - src/renderer/screens/
    - TasksView.tsx: Top-level tasks screen wrapper (routes between list and details views).
  - src/renderer/tasks/: Screens and views for tasks.
    - TasksListView.tsx: List view with search/filter, DnD, inline status bullet editor. Project-aware (reacts to active project context).
    - TaskDetailsView.tsx: Right-side details panel. Project-aware and resubscribes on project change.
    - BoardView.tsx: Kanban-style board with columns by status. Project-aware.
  - src/renderer/navigation/: Navigation state + modal host.
    - Navigator.tsx
    - SidebarView.tsx ← UPDATED: Now includes a Manage button to open Project Manager modal and uses ProjectSpec.title.
  - src/renderer/services/: Renderer-side service modules (IPC access)
    - projectsService.ts: Lists and gets child projects via preload window.projectsIndex; now also supports create/update/delete.
    - docsService.ts: Project-aware docs service; subscribes to docs index updates; can switch context via window.docsIndex.setContext.
    - tasksService.ts: Tasks service using project-aware tasks index; subscriptions return an unsubscribe function.
    - chatService.ts ← UPDATED: Now includes setContext(projectId) to scope chats directory per project via IPC.
    - notificationsService.ts ← UPDATED: Renderer-local notifications are now scoped per project (storage keys include projectId) and expose setContext(projectId).
  - src/renderer/projects/: Renderer-side project context and management UI
    - ProjectContext.tsx: Tracks active project (main vs child), exposes hooks to switch and consume active project across the app. Propagates context to tasks, docs, chat, and notifications via preload APIs/services.
    - ProjectManagerModal.tsx ← NEW: Modal UI to create, edit, and delete child projects with validation.
    - validateProject.ts ← NEW: Client-side validation mirroring ProjectSpec rules.
- src/projects/: Main-process indexer for child projects under projects/
  - src/projects/indexer.js: Scans the projects/ directory for .json files, validates them against ProjectSpec, builds an index, and watches for changes. Emits 'projects-index:update' via IPC. UPDATED to expose configPathsById mapping for maintenance.
  - src/projects/validator.js: Runtime validation of ProjectSpec objects.
- src/docs/: Project-aware docs indexer and IPC.
- src/tasks/: Project-aware tasks indexer and IPC.
- src/chat/: Chat manager and providers
  - src/chat/manager.js ← UPDATED: Supports getDefaultChatsDir() and setChatsDir(dir) to switch chats storage based on active project.
  - src/chat/providers/*: LLM provider integrations (OpenAI, LiteLLM, LM Studio).
- src/index.css: Imports styles.
- src/main.js: Electron main process and IPC wiring, including projects CRUD handlers. ← UPDATED: Adds 'chat:set-context' to switch chats directory per project.
- src/preload.js: Exposes window.projectsIndex with get/subscribe and CRUD methods; exposes tasksIndex/docsIndex setContext; exposes chat.setContext for project-aware chat. ← UPDATED

## New: Projects management UI and IPC
- Renderer adds a Projects Manager modal accessible from the sidebar Projects section. Users can create, edit, and delete child projects.
- Validation occurs client-side and server-side (main process uses src/projects/validator.js).
- Main process adds IPC handlers:
  - 'projects:create' → writes a new JSON under projects/<id>.json
  - 'projects:update' → updates existing project JSON (renames file if id changed)
  - 'projects:delete' → removes the project JSON
- Projects indexer now includes configPathsById to track each project's config file path relative to projects/ for safe updates/deletes. Renderer ignores this field.

## Project-aware Chat and Notifications ← NEW
- Chat
  - Preload exposes chat.setContext(projectId) that calls 'chat:set-context' IPC.
  - Main handles 'chat:set-context' and switches ChatManager's chatsDir to either <appRoot>/chats (main) or <projects>/<project.path>/chats (child), creating the directory if needed.
  - ChatManager (src/chat/manager.js) now has getDefaultChatsDir() and setChatsDir(dir), used by IPC.
- Notifications
  - Renderer-only persistence is scoped per project by namespacing storage keys (app_notifications__<projectId>, notification_preferences__<projectId>).
  - notificationsService exposes setContext(projectId); ProjectContext calls this when active project changes.
  - OS notifications include metadata.projectId to allow routing when clicked.

Notes:
- Projects are stored as JSON files under <project-root>/projects/. Each JSON follows ProjectSpec (id, title, description, path, repo_url, requirements[]).
- The UI surfaces basic metadata: ID, Title, Description, Path (under projects/), and Repository URL.
- Requirements can be left empty; the validator requires an array, defaults to [].
