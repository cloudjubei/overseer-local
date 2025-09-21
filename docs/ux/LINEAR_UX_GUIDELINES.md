# Linear.app-inspired UX Guidelines

Purpose

- Capture best-in-class UX patterns inspired by Linear.app and adapt them to our story management app.
- Define interaction models, controls, and behaviors to achieve speed, clarity, and power-user efficiency.
- Align with our Renderer-driven navigation (Navigator + ModalHost) and existing UI components and design tokens.

Guiding Principles

- Keyboard-first: every primary action should be executable via shortcuts and the command menu.
- Minimal chrome, maximal focus: keep the interface clean and emphasize the content (stories) over UI furniture.
- Instant feedback: optimistic updates, subtle animations, and undo affordances.
- Inline over modal, modal over page: inline edits by default; side-panel or lightweight modal when necessary.
- Progressive disclosure: show advanced fields when needed; keep defaults minimal.
- Consistency and predictability: uniform behaviors across views, with the same shortcuts and UI patterns.
- Accessibility as table stakes: ensure full keyboard navigation and screen reader support.

Core Navigation Patterns

- Global command menu: a universal entry point (Cmd/Ctrl+K) to search and execute actions; type-to-filter.
- Left sidebar navigation: high-level areas (Inbox/My Stories, All Stories, Boards, Projects, Docs, Chat), collapsible groups.
- Contextual panels: story details open in a right-side panel/sheet over list or board; never lose context.
- Persistent filters and views: list and board views remember sort/filter/group; support quick toggles.
- Search first: top-level search (/) focuses the command/search input; results include stories, projects, views.

Keyboard Shortcuts (Recommended Mapping)
Note: Provide consistent shortcut semantics; do not rely on platform-specific nonstandard keys. Ensure shortcut discoverability via a Help overlay.

- Global
  - Cmd/Ctrl+K: Open command menu
  - /: Focus search
  - ?: Open shortcuts help
  - Cmd/Ctrl+N: New story (from anywhere)
  - Esc: Close modals/panels, clear focus when appropriate
- Selection and Navigation
  - Up/Down: Move row selection in lists
  - Left/Right: Collapse/expand groups or move across board columns when focused
  - Enter: Open selected story in details panel
  - Shift+Up/Down: Multi-select range in lists
  - Cmd/Ctrl+A: Select all (within the current list/filter)
- Story Actions (when a story or multi-selection is active)
  - E: Edit title inline (focus title field)
  - S: Change status (open status picker)
  - A: Change assignee (open assignee picker)
  - P: Change priority (open priority picker)
  - L: Manage labels/tags (open label picker)
  - D: Set due date (open date picker)
  - M: Move to project (open project picker)
  - T: Toggle substory creation inline
  - . (dot): Open quick actions menu for selected items
  - Backspace/Delete: Archive/delete (with confirm + undo)
- Panels/Modals
  - Cmd/Ctrl+Enter: Save and close
  - Esc: Cancel/close (respect unsaved changes confirmation)

Story Lifecycle Flows

- Create Story
  - Quick create
    - Trigger via Cmd/Ctrl+N or a prominent New Story button.
    - Present a small modal or inline composer with: Title (required), Assignee (optional), Status (defaults), Project (optional).
    - Advanced fields available via a disclosure toggle or keyboard commands (e.g., press P to set priority).
    - Optimistic create: insert into current list/board immediately; show Undo toast.
  - Templates
    - Allow selection of templates in quick create via command menu or a small dropdown.
- Edit Story
  - Inline editing by default: title, status, assignee, priority editable in-place in both lists and panels.
  - Details panel
    - Opens over current view without navigation; panel width responsive (~480-640px)
    - Sections: Header (title, status, assignee, priority, due), Description (rich text/markdown), Substories, Attachments, Activity/Comments.
    - Keyboard-optimized field focus order and shortcuts to jump among sections.
- Change Status
  - Drag-and-drop between board columns.
  - Press S to open a status picker with type-ahead; arrow keys to navigate; Enter to confirm.
  - Bulk status changes supported for multi-selection.
- Bulk Editing
  - Multi-select stories via Shift/Click or keyboard.
  - Show a contextual bulk action bar (sticky footer or header) with status, assignee, labels, project, priority, delete/archive.
  - All actions keyboard-accessible via quick actions or command menu.
- Comments and Activity
  - Comment composer with Cmd/Ctrl+Enter to submit; supports mentions, inline formatting.
  - Activity feed shows changes with compact timestamps and actor avatars.
  - Edits and comments should be undoable where safe and show toasts.
- Substories and Relations
  - Inline add substory beneath parent; Tab/Shift+Tab to indent/outdent where appropriate.
  - Relations (blocks/blocked-by, duplicates, relates-to) via a relation picker; display chips in details.

Modals and Panels Behavior

- Modals
  - Lightweight and non-blocking where possible; small quick-create modal preferred to heavy forms.
  - Focus trapping, Esc to close, Cmd/Ctrl+Enter to save, consistent primary/secondary button order.
  - Support nested pickers within modals with clear escape/back behavior.
- Panels (Right-side sheets)
  - Non-modal feel with background scroll preserved.
  - Maintain selection in the underlying list; closing returns focus to the previously focused row/card.
  - Support deep-linking via URL state (Navigator route) for shareable links.

Forms and Inline Editing

- Inline fields use a single-click or Enter to edit; Esc cancels.
- Editable tokens for status, assignee, labels; type-ahead pickers with keyboard navigation.
- Description editor supports markdown shortcuts and slash-commands (e.g., /date, /checklist).
- Validate on submit; keep inline validation concise and next to fields.

Micro-interactions

- Subtle hover reveals: show quick affordances (assign, status change) on hover, but keep layout stable.
- Animated transitions under 150ms; no large motion; use ease-out for entrance, ease-in for exit.
- Toasters for successes and errors; include Undo when applicable; disappear after 3–5 seconds.
- Optimistic updates with rollback on failure; never block the UI on network unless required.

Performance and Perceived Speed

- Virtualize long lists and board columns.
- Debounced network writes for inline edits; coalesce updates.
- Preload likely-needed data (assignees, statuses, labels) for instant pickers.
- Cache recent searches and command menu results.

Accessibility

- Full keyboard reachability with visible focus rings.
- Roving tabindex for lists and grids; ARIA roles: listbox, grid, dialog, toolbar as appropriate.
- Command menu announced as a dialog with search input labeled; results list with role=listbox and option.
- Panels are complementary regions with aria-label and proper focus management.
- Ensure color contrast meets WCAG AA; do not rely on color alone to convey status.

Implementation Guidelines for Our App

- Navigation and Structure
  - Use src/renderer/navigation/Navigator for all route changes and to open/close modals and panels.
  - Use ModalHost for rendering all modals and side-panels via portals; keep a single host at app root.
- Components
  - Reuse src/renderer/components/ui primitives (Button, Input, Select, Modal, Toast). Extend with:
    - CommandMenu: a headless command palette integrated with Navigator and services.
    - SidePanel: a right-side sheet pattern for story details.
    - InlineEditableText: title editing with confirm/cancel and debounced saves.
    - TokenPickers: AssigneePicker, StatusPicker, LabelPicker with type-ahead.
- Design Tokens
  - Use src/styles/design-tokens.css for colors, spacing, and shadows.
  - Map status and priority chips to semantic tokens (see docs/design/DESIGN_TOKENS.md and MONDAY_PALETTE_REFERENCE.md for color anchors).
- Shortcuts Infrastructure
  - Centralize keyboard shortcuts in a registry with context-aware scopes (global, list, panel, modal).
  - Display a Shortcuts Help modal (triggered by ?) enumerating active shortcuts by scope.
  - Ensure Navigator hooks expose a registerShortcut API for screens/components.
- State and Data
  - Optimistic updates for create/edit/status changes; reconcile on server response.
  - Bulk operations batched; show consolidated toasts with undo.
- Accessibility and QA
  - All dialogs/panels must be focus-trapped and labeled.
  - Roving focus in lists; Enter to open details; Esc to close details returns focus to list item.
  - Provide ARIA live region for toasts and async statuses.

Notes and References

- See docs/STANDARDS.md for app-wide UI conventions, and docs/design/ for color and token references.
