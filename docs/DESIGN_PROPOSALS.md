# DESIGN PROPOSALS — Next‑Gen Task UI

This document proposes three distinct, best‑in‑class UI directions for the Task application, inspired by leading products (Linear, Notion, Asana, Trello, ClickUp, Jira, Monday, Todoist). Each proposal includes principles, layout, key interactions, visual language, implementation notes mapped to our codebase, risks, and KPIs.

Summary
- Proposal A: Linear‑style Minimal, Keyboard‑First
- Proposal B: Notion/Asana‑style Flexible Workspace with Multi‑Views
- Proposal C: Power Board + Timeline (Jira/ClickUp level density and control)

Competitor Patterns Observed
- Clean, low‑chrome UIs with generous whitespace and clear hierarchy (Linear, Notion)
- Multi‑view datasets: List, Board, Calendar, Timeline, Table (Notion, Asana, Monday)
- Split list/detail with persistent right drawer for context (Linear, Asana)
- Global Command Palette (Cmd/Ctrl+K), robust keyboard shortcuts (Linear, Jira)
- Quick‑add everywhere; inline editing (Notion, Asana)
- Status chips, assignee avatars, priority, labels, due dates, custom fields (All)
- Saved views, powerful filtering/sorting/grouping (ClickUp, Monday, Jira)
- Real‑time updates, optimistic UI, offline‑friendly cues (Linear, Notion)

Repo Integration Notes
- Current structure aligns well: Electron + React + TS (renderer), shared UI primitives (src/renderer/components/ui), utilities for tasks, and indexer IPC. We can progressively enhance legacy DOM views or migrate fully to React entries (preferred).

----------------------------------------------------------------
Proposal A — Linear‑style Minimal, Keyboard‑First

Goal: Speed and clarity. Focused list/detail workflow with zero distraction and comprehensive keyboard control.

Core Layout
- Left: Projects/Tasks navigation (collapsible). Medium density.
- Middle: Tasks list with compact rows; status, title, key metadata; inline edit.
- Right: Task details panel (always visible on desktop) with tabs: Details, Activity, Subtasks, Linked items.
- Top: Slim header with search, Command Palette, global filters, account menu.

Key Interactions
- Global Command Palette (Cmd/Ctrl+K) for: create task, change status, assign, navigate.
- Keyboard shortcuts for everything (j/k to move, o to open, e to edit, s to change status, a to assign, l to label, d to due date).
- Inline edit in list; optimistic save via IPC tasks:update / tasks-feature:update.
- Multi‑select with batch actions (status change, assign, label).

Visual Language
- Neutral gray canvas; single accent color for primary actions.
- Typography: Inter or system UI; 14–15px base with tight line‑height for lists.
- Subtle shadows/elevation cues; micro‑animations under 150ms.
- Status chips: +, ~, -, ?, = mapped to semantic colors (Done ✓ green 600, In Progress blue 600, Pending gray 500, Blocked red 600, Deferred amber 600).

Accessibility
- 4.5:1 contrast for body text; focus rings visible on all interactive elements.
- Full keyboard navigation, ARIA roles for list/grid and details region.

Implementation Plan (mapped to repo)
- Components: Build in src/renderer/components/ui (use existing modal/toast primitives). Add commandPalette.tsx, kbdShortcuts.ts, statusBadge.tsx.
- Views: Convert legacy tasksListView.js and taskDetailsView.js into React screens in src/renderer/App.tsx with split‑pane.
- State: Subscribe to window.tasksIndex.onUpdate; local optimistic updates with rollback on IPC failure.
- Styling: Introduce CSS variables in src/index.css for tokens (colors, spacing, radii).
- Performance: Virtualized list (e.g., react‑window) for large task sets.

Risks
- Power users may need custom fields and views quickly.
KPIs
- Time‑to‑create/edit task, keyboard usage rate, list scroll FPS, error rollback rate.

Image References (Inspiration)
- Linear list/detail and shortcuts: https://linear.app/ — Brand/press kit and product shots
- Linear keyboard palette: https://linear.app/keyboard-shortcuts (if redirected, see product docs)

----------------------------------------------------------------
Proposal B — Notion/Asana‑style Flexible Workspace with Multi‑Views

Goal: Versatility. The same dataset available as List, Board, Calendar, and Timeline, with a rich task description editor (blocks), and saved views.

Core Layout
- Header: View selector tabs (List, Board, Table, Calendar, Timeline), global filters, Save view.
- Content: View container switches component; List and Table share columns; Board is Kanban by status; Calendar shows due dates; Timeline groups by assignee.
- Right: Contextual details drawer that opens on selection (consistent across views).

Key Interactions
- Quick‑add in each view (inline in List/Table, column add in Board, click‑to‑create in Calendar).
- Rich text block editor for task description with checklists, code, images, attachments.
- Custom fields: type, priority, estimate, tags; column show/hide and reordering; saved view configs persisted.

Visual Language
- Softer gradients and rounded radii (8–10px). Neutral background with light panels.
- Typography: Inter/Plus Jakarta, 15–16px base in content views; 14px in dense tables.
- Color accents per view to improve orientation.

Accessibility
- Screen‑reader friendly tab switching and ARIA roles per view.
- Drag‑and‑drop announced and keyboard reorder fallback.

Implementation Plan (mapped to repo)
- Views: src/renderer/ components per view: ListView.tsx, BoardView.tsx, TableView.tsx, CalendarView.tsx, TimelineView.tsx. Mount via App.tsx router.
- Reuse: status.js for badges; tasks.js for transforms. Extend toTasksArray for view models.
- Editor: Lightweight block editor for descriptions (e.g., tiptap/ProseMirror or simple Markdown editor) mounted in TaskDetails.
- Persistence: Extend tasks-feature:update to handle custom fields; augment src/types/tasks.ts as mirror of docs/tasks/task_format.py if needed.
- Saved Views: Store JSON in app config or per project file; initial MVP: in‑memory plus localStorage.

Risks
- Scope creep: block editor and multi‑views add complexity.
KPIs
- View switch latency, saved view creation rate, inline edit completion without opening details.

Image References (Inspiration)
- Notion database views (board/list/calendar): https://www.notion.so/ — Product pages and guides
- Asana list/board/timeline views: https://asana.com/guide/help/views
- Monday multi‑views: https://monday.com/ (product screenshots)

----------------------------------------------------------------
Proposal C — Power Board + Timeline (Jira/ClickUp‑level control)

Goal: Advanced planning for large teams with dense information, batch ops, automations, and analytics‑friendly layout.

Core Layout
- Left: Filters and saved views panel with quick chips for assignee, status, priority, labels, date range.
- Main: Board with swimlanes (by assignee, priority, or epic) and WIP limits; switch to Timeline/Gantt with grouping.
- Right: Insights/Context drawer with metrics (cycle time, WIP by status), and task details.

Key Interactions
- Batch select and operations bar (change status, assign, label, estimate, move to sprint).
- Automations: simple rules like When status changes to Done -> set completion date; When priority = High -> notify.
- Reordering across swimlanes; keyboard and mouse parity.

Visual Language
- Higher information density; compact spacing, smaller type (13–14px body), crisp grid lines.
- Color semantics for priority and SLA; chips and flags.

Accessibility
- Focus states for dense grids; sticky headers/columns with proper aria semantics.

Implementation Plan (mapped to repo)
- Board: BoardView.tsx with swimlanes; Drag & Drop via @dnd‑kit; maintain reorder IPC via tasks‑features:reorder.
- Timeline: TimelineView.tsx with virtualized horizontal scroll; map dependencies visually from Feature.dependencies.
- Filters/Saved Views: Extend window.tasksIndex.getSnapshot to compute facets; persist configs via Electron store.
- Automations: MVP in renderer as client rules; later, persist rule definitions alongside project config.

Risks
- Complexity and cognitive load; requires careful defaults and onboarding.
KPIs
- Batch operation throughput, time‑to‑find tasks with filters, WIP limit adherence.

Image References (Inspiration)
- Jira boards/backlog/timeline: https://www.atlassian.com/software/jira/features
- ClickUp views and automations: https://clickup.com/features
- Trello swimlanes/kanban inspiration: https://trello.com/guide/trello-101

----------------------------------------------------------------
Design System and Tokens (common to all proposals)
- Colors (CSS variables in src/index.css):
  - --bg, --panel, --text, --muted, --border, --primary, --primary-contrast, --success, --warning, --danger.
- Radii: --radius-sm: 6px, --radius-md: 8px, --radius-lg: 12px.
- Spacing scale: 4, 8, 12, 16, 20, 24, 32.
- Shadows: --shadow-1 (subtle), --shadow-2 (lifted).
- Motion: 120–180ms ease for standard transitions; prefer transform over layout.

Navigation and IA
- Global: Projects (future), Tasks, Features, Views, Settings.
- Quick‑Add: Floating or header button; keyboard shortcut (Cmd/Ctrl+N).
- Search: Fuzzy search tasks/features, activated from header and Cmd/Ctrl+K.

Accessibility and i18n
- Labels, roles, and names on all actionable elements; skip‑to‑content; focus management on modal open/close.
- Pluralization and date formats prepared for i18n.

Responsive
- Desktop first; tablet collapses right drawer to modal; mobile stacks list/detail with bottom tabs.

Recommended Roadmap
- Phase 1 (1–2 sprints): Proposal A core (split‑pane, shortcuts, command palette, virtualized list). Establish tokens.
- Phase 2 (2–3 sprints): Add Proposal B views (Board, Calendar). Introduce saved views. Block editor MVP.
- Phase 3 (3–4 sprints): Proposal C enhancements (swimlanes, timeline, batch ops, basic automations).

Success Metrics (global)
- Create/edit task median time
- Shortcut adoption rate
- View switch latency and list scroll FPS
- Accessibility score (axe) and perceived usability (SUS)

Appendix — Additional Image/Resource Links
- Notion database docs: https://www.notion.so/help/guides
- Asana List view: https://asana.com/guide/help/views/list
- Linear brand assets (for style cues): https://linear.app/brand
- Todoist design cues for simplicity: https://todoist.com/product
- Basecamp (calm UI): https://basecamp.com/

Notes on Image Use
- Use references for visual direction. Do not embed proprietary assets in repo; link to public pages and recreate styles with our own components.
