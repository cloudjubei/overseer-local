# DESIGN PROPOSALS — Next‑Gen Task UI

Repo Integration Notes
- Current structure aligns well: Electron + React + TS (renderer), shared UI primitives (src/renderer/components/ui), utilities for tasks, and indexer IPC.
- We should migrate fully to React entries.

----------------------------------------------------------------
Proposal — Linear‑style Minimal, Keyboard‑First

Goal: Speed and clarity. Focused list/detail workflow with zero distraction and comprehensive keyboard control.

Core Layout
- Left: Main navigation (collapsible). Medium density.
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
- Monday multi‑views: https://monday.com/ (product screenshots)
- ClickUp views and automations: https://clickup.com/features
- Trello swimlanes/kanban inspiration: https://trello.com/guide/trello-101
