# UI Development Guide

Purpose

- This is the single entry point for anyone building or changing UI in this project (agents and developers).
- It summarizes core principles and points you to detailed docs for components, tokens, and UX patterns.

How to use this guide

1) Skim the Core Principles below.
2) Open the Style Guide (docs/styleguide/index.html) to see live tokens and UI primitives.
3) Use semantic design tokens (see docs/design/DESIGN_TOKENS.md) — never hardcode colors.
4) Follow UI Standards (docs/STANDARDS.md) for structure, naming, navigation, and accessibility.
5) Consult UX Guidelines (docs/ux/LINEAR_UX_GUIDELINES.md) for interaction patterns and shortcuts.
6) For specific components or patterns, see docs/design/COMPONENTS.md.

Core principles (summary)

- Keyboard-first: all primary actions must be accessible via shortcuts and the command menu.
- Minimal chrome, maximal focus: prioritize content; keep UI chrome subtle.
- Instant feedback: optimistic updates, undo, subtle animations (<150ms).
- Inline over modal; modal over page: prefer inline edits; use right-side panels before full-page nav.
- Progressive disclosure: keep defaults minimal; reveal advanced fields on demand.
- Consistency and predictability: same behaviors and shortcuts across views.
- Accessibility by default: full keyboard navigation, visible focus, proper ARIA roles, AA contrast.

Implementation in this app

- Navigation and modals
  - Use Navigator for all route changes and to open/close modals and side panels.
  - Render all modals and panels through the global ModalHost (single host at app root).
- Components and reuse
  - Prefer shared primitives from src/renderer/components/ui (Button, Input, Select, Modal, Toast, etc.).
  - Use CommandMenu, SidePanel, InlineEditableText, and token pickers where applicable.
- Design tokens and theming
  - Import and use src/styles/design-tokens.css and project styles from src/index.css.
  - Map Tailwind classes to CSS variables (see docs/design/DESIGN_TOKENS.md and docs/tailwind.config.tokens.example.js).
- Shortcuts
  - Register shortcuts via the central registry with scopes (global, list, panel, modal).
  - Provide discoverability via a Shortcuts Help overlay (? key).
- Data and state
  - Use hooks for UI state and services for IPC/data access; prefer optimistic updates with rollback.

Design tokens (what and where)

- Read: docs/design/DESIGN_TOKENS.md for semantic tokens, palette anchors, light/dark themes, and Tailwind integration guidance.
- Source of truth: src/styles/design-tokens.css (CSS variables consumed across the app).
- Do not hardcode hex values; use semantic variables like surface.*, text.*, border.*, accent.*, status.*.

Components and patterns

- Browse the static Style Guide (no build required): open docs/styleguide/index.html in your browser.
  - It renders actual CSS tokens and demonstrates primitives: Colors, Typography, Buttons, Inputs, Badges, Priority/Status tags, Tooltip, Spinner, Skeleton, Card, overlays (Command Menu, Shortcuts Help, Toast), and a density toggle.
- For React behavior and APIs, read docs/design/COMPONENTS.md and follow the UX rules from docs/ux/LINEAR_UX_GUIDELINES.md.

UX patterns and shortcuts

- Read: docs/ux/LINEAR_UX_GUIDELINES.md for Linear.app-inspired flows and behaviors.
  - Global command menu (Cmd/Ctrl+K), search (/), new story (Cmd/Ctrl+N), Esc to close, roving focus in lists/grids.
  - Story flows: create (quick create + templates), inline editing, right-side Details panel, bulk editing, drag-and-drop on boards.
  - Micro-interactions: hover affordances, subtle transitions, toasts with Undo.
  - Performance guidance: virtualization for long lists/boards, debounced/coalesced updates, preload likely-needed data.

Accessibility checklist (quick)

- All interactive elements reachable by keyboard; visible focus rings.
- Appropriate ARIA roles (dialog, listbox, grid, toolbar, complementary regions for panels) and labels.
- Modals and panels: focus trap, Esc to close, return focus to the invoking control.
- Ensure WCAG AA contrast for text and key iconography; do not rely on color alone.
- Provide an ARIA live region for toasts and async status messages.

Renderer structure and conventions

- Follow docs/STANDARDS.md for placement and naming.
  - Screens: src/renderer/screens/<Name>View.tsx
  - Modals: src/renderer/stories/<Name>View.tsx (or components if generic)
  - Components: src/renderer/components/...
  - Hooks: src/renderer/hooks/useFeatureName.ts
  - Services (IPC): src/renderer/services/featureService.ts
  - Navigation host/helpers: src/renderer/navigation/
- Layout: flex-based, min-w-0 and min-h-0 on flexible containers; only one overflow-auto region per scroll area.

Before you open a PR (UI checklist)

- Tokens: Uses semantic tokens only; no hardcoded hex or bespoke colors.
- Accessibility: Keyboard reachable, focus visible, ARIA labels/roles correct; modals/panels trap focus and restore it.
- Shortcuts: Register appropriate shortcuts and confirm they appear in Shortcuts Help.
- Performance: Long lists/boards are virtualized; inline edits are debounced/coalesced.
- Consistency: Follows component behaviors in docs/design/COMPONENTS.md and UX in docs/ux/LINEAR_UX_GUIDELINES.md.
- Visual QA: Verified in docs/styleguide/index.html where relevant (colors, spacing, states), and within the app.

Deep dives and references

- UX guidelines: docs/ux/LINEAR_UX_GUIDELINES.md
- Style Guide (live tokens and primitives): docs/styleguide/index.html (overview: docs/styleguide/README.md)
- Components and behaviors: docs/design/COMPONENTS.md
- Design tokens and theming: docs/design/DESIGN_TOKENS.md and docs/design/MONDAY_PALETTE_REFERENCE.md
- General UI standards: docs/STANDARDS.md

Notes

- This guide is intentionally concise. For any UI work, start here, and then follow the links to details as needed.
